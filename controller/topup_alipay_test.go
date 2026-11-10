package controller

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/smartwalle/alipay/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const alipayTestAppID = "2021000000000001"

func newRSAKeyPairForAlipayTest(t *testing.T) (privatePKCS8 string, publicPKIX string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	private, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	public, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	return base64.StdEncoding.EncodeToString(private), base64.StdEncoding.EncodeToString(public)
}

// setupAlipayNotifyTest configures the console as merchant and returns a
// client holding the "Alipay side" private key, used to sign notifications.
func setupAlipayNotifyTest(t *testing.T) *alipay.Client {
	t.Helper()
	confirmPaymentComplianceForTest(t)

	appPrivate, _ := newRSAKeyPairForAlipayTest(t)
	alipayPrivate, alipayPublic := newRSAKeyPairForAlipayTest(t)
	original := []any{setting.AlipayAppId, setting.AlipayPrivateKey, setting.AlipayPublicKey, setting.AlipaySandboxEnabled, setting.AlipayFirstTopUpBonus}
	t.Cleanup(func() {
		setting.AlipayAppId = original[0].(string)
		setting.AlipayPrivateKey = original[1].(string)
		setting.AlipayPublicKey = original[2].(string)
		setting.AlipaySandboxEnabled = original[3].(bool)
		setting.AlipayFirstTopUpBonus = original[4].(float64)
	})
	setting.AlipayAppId = alipayTestAppID
	setting.AlipayPrivateKey = appPrivate
	setting.AlipayPublicKey = alipayPublic
	setting.AlipaySandboxEnabled = true
	setting.AlipayFirstTopUpBonus = 4

	previousDB, previousLogDB, previousRedis, previousQuotaPerUnit := model.DB, model.LOG_DB, common.RedisEnabled, common.QuotaPerUnit
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))
	model.DB, model.LOG_DB, common.RedisEnabled, common.QuotaPerUnit = db, db, false, 500000
	t.Cleanup(func() {
		model.DB, model.LOG_DB, common.RedisEnabled, common.QuotaPerUnit = previousDB, previousLogDB, previousRedis, previousQuotaPerUnit
	})

	signer, err := alipay.New(alipayTestAppID, alipayPrivate, false)
	require.NoError(t, err)
	return signer
}

func signedAlipayNotification(t *testing.T, signer *alipay.Client, fields map[string]string) url.Values {
	t.Helper()
	values := url.Values{}
	for key, value := range fields {
		values.Set(key, value)
	}
	signature, err := signer.SignValues(values)
	require.NoError(t, err)
	values.Set("sign", base64.StdEncoding.EncodeToString(signature))
	values.Set("sign_type", "RSA2")
	return values
}

func postAlipayNotify(values url.Values) string {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/alipay/notify", strings.NewReader(values.Encode()))
	ctx.Request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	AlipayNotify(ctx)
	return recorder.Body.String()
}

func createAlipayOrderForNotifyTest(t *testing.T) (*model.User, *model.TopUp) {
	t.Helper()
	user := &model.User{Username: "alipay-notify-user", Password: "unused", Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, model.DB.Create(user).Error)
	order := &model.TopUp{
		UserId: user.Id, Amount: 50, Money: 115, TradeNo: "USR1NOALIPAYTEST",
		PaymentMethod: model.PaymentMethodAlipay, PaymentProvider: model.PaymentProviderAlipay,
		CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())
	return user, order
}

func userQuotaForAlipayTest(t *testing.T, id int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
}

func TestAlipayNotifyCreditsSignedPaymentWithFirstTopUpBonus(t *testing.T) {
	signer := setupAlipayNotifyTest(t)
	user, order := createAlipayOrderForNotifyTest(t)

	values := signedAlipayNotification(t, signer, map[string]string{
		"app_id": alipayTestAppID, "out_trade_no": order.TradeNo, "trade_no": "2026110922001",
		"trade_status": "TRADE_SUCCESS", "total_amount": "115.00", "notify_id": "n1",
	})
	assert.Equal(t, "success", postAlipayNotify(values))
	assert.Equal(t, (50+4)*500000, userQuotaForAlipayTest(t, user.Id))

	// Alipay retries notifications; a repeat must not credit again.
	assert.Equal(t, "success", postAlipayNotify(values))
	assert.Equal(t, (50+4)*500000, userQuotaForAlipayTest(t, user.Id))
}

func TestAlipayNotifyRejectsForgedOrForeignNotifications(t *testing.T) {
	signer := setupAlipayNotifyTest(t)
	user, order := createAlipayOrderForNotifyTest(t)
	fields := map[string]string{
		"app_id": alipayTestAppID, "out_trade_no": order.TradeNo,
		"trade_status": "TRADE_SUCCESS", "total_amount": "115.00",
	}

	tampered := signedAlipayNotification(t, signer, fields)
	tampered.Set("total_amount", "1150.00")
	assert.Equal(t, "fail", postAlipayNotify(tampered))

	fields["app_id"] = "2021999999999999"
	assert.Equal(t, "fail", postAlipayNotify(signedAlipayNotification(t, signer, fields)))

	fields["app_id"] = alipayTestAppID
	fields["total_amount"] = "0.01"
	assert.Equal(t, "success", postAlipayNotify(signedAlipayNotification(t, signer, fields)))

	assert.Equal(t, 0, userQuotaForAlipayTest(t, user.Id))
	assert.Equal(t, common.TopUpStatusPending, model.GetTopUpByTradeNo(order.TradeNo).Status)
}

func TestAlipayNotifyIgnoresUnpaidStatus(t *testing.T) {
	signer := setupAlipayNotifyTest(t)
	user, order := createAlipayOrderForNotifyTest(t)

	values := signedAlipayNotification(t, signer, map[string]string{
		"app_id": alipayTestAppID, "out_trade_no": order.TradeNo,
		"trade_status": "WAIT_BUYER_PAY", "total_amount": "115.00",
	})
	assert.Equal(t, "success", postAlipayNotify(values))
	assert.Equal(t, 0, userQuotaForAlipayTest(t, user.Id))
}

func TestRequestAlipayPayKeepsCharsetInGatewayURL(t *testing.T) {
	setupAlipayNotifyTest(t)
	user := &model.User{Username: "alipay-pay-user", Password: "unused", Status: common.UserStatusEnabled, Group: "default"}
	require.NoError(t, model.DB.Create(user).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/pay", nil)
	requestAlipayPay(ctx, user.Id, 1, 2.3)

	var body struct {
		Message string            `json:"message"`
		URL     string            `json:"url"`
		Data    map[string]string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, "success", body.Message)
	gateway, err := url.Parse(body.URL)
	require.NoError(t, err)
	assert.Equal(t, "utf-8", gateway.Query().Get("charset"))
	assert.Equal(t, "utf-8", body.Data["charset"])
	assert.Contains(t, body.Data["biz_content"], "Claude服务站余额充值")
}
