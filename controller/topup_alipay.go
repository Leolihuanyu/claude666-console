package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/smartwalle/alipay/v3"
)

// Claude服务站: direct Alipay 电脑网站支付. The wallet's existing "alipay"
// pay method is routed here (see RequestEpay) so the web console needs no
// new payment flow: it posts the returned params to the Alipay gateway the
// same way it posts Epay forms.

const alipayOrderTimeout = "30m"

var (
	alipayClientMu  sync.Mutex
	alipayClientKey string
	alipayClientVal *alipay.Client
)

// getAlipayClient rebuilds the client only when the admin changes the keys,
// because parsing RSA keys on every request is wasteful.
func getAlipayClient() (*alipay.Client, error) {
	appId := strings.TrimSpace(setting.AlipayAppId)
	privateKey := strings.TrimSpace(setting.AlipayPrivateKey)
	publicKey := strings.TrimSpace(setting.AlipayPublicKey)
	if appId == "" || privateKey == "" || publicKey == "" {
		return nil, errors.New("alipay is not configured")
	}
	key := fmt.Sprintf("%s|%t|%s|%s", appId, setting.AlipaySandboxEnabled, common.Sha1([]byte(privateKey)), common.Sha1([]byte(publicKey)))

	alipayClientMu.Lock()
	defer alipayClientMu.Unlock()
	if alipayClientVal != nil && alipayClientKey == key {
		return alipayClientVal, nil
	}
	client, err := alipay.New(appId, privateKey, !setting.AlipaySandboxEnabled)
	if err != nil {
		return nil, fmt.Errorf("invalid alipay app private key: %w", err)
	}
	if err := client.LoadAliPayPublicKey(publicKey); err != nil {
		return nil, fmt.Errorf("invalid alipay public key: %w", err)
	}
	alipayClientVal, alipayClientKey = client, key
	return client, nil
}

func requestAlipayPay(c *gin.Context, userId int, amount int64, payMoney float64) {
	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Alipay client unavailable user_id=%d error=%q", userId, err.Error()))
		paymentError(c, common.NewMessage("Payment information has not been configured by administrator"))
		return
	}

	callback := strings.TrimRight(service.GetCallbackAddress(), "/")
	tradeNo := fmt.Sprintf("USR%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	totalAmount := fmt.Sprintf("%.2f", payMoney)

	var trade alipay.TradePagePay
	trade.NotifyURL = callback + "/api/alipay/notify"
	trade.ReturnURL = callback + "/api/alipay/return"
	trade.Subject = fmt.Sprintf("Claude服务站余额充值 $%d", amount)
	trade.OutTradeNo = tradeNo
	trade.TotalAmount = totalAmount
	trade.ProductCode = "FAST_INSTANT_TRADE_PAY"
	trade.TimeoutExpress = alipayOrderTimeout
	trade.GoodsType = "0"

	payURL, err := client.TradePagePay(trade)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Alipay failed to build payment user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Alipay failed to create top-up order user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("Alipay top-up order created user_id=%d trade_no=%s amount=%d money=%s", userId, tradeNo, amount, totalAmount))

	// The console posts data as form fields to url. The gateway decodes a POST
	// body with the charset named in the URL query (GBK when absent), so it
	// must stay there or Chinese subjects fail with invalid-signature.
	query := payURL.Query()
	params := make(map[string]string, len(query))
	for key, values := range query {
		if len(values) > 0 {
			params[key] = values[0]
		}
	}
	gateway := *payURL
	gateway.RawQuery = url.Values{"charset": {query.Get("charset")}}.Encode()
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": gateway.String()})
}

// withoutAlipayCertSN drops alipay_cert_sn before verification. This client
// uses the public-key mode; with a cert SN present the SDK would download a
// certificate from Alipay, letting forged requests trigger outbound calls.
func withoutAlipayCertSN(values url.Values) url.Values {
	cleaned := make(url.Values, len(values))
	for key, value := range values {
		if key != "alipay_cert_sn" {
			cleaned[key] = value
		}
	}
	return cleaned
}

// settleAlipayTrade credits a paid order. ok=false means Alipay should retry.
func settleAlipayTrade(ctx context.Context, tradeNo string, status alipay.TradeStatus, totalAmount string, callerIp string) (ok bool) {
	if status != alipay.TradeStatusSuccess && status != alipay.TradeStatusFinished {
		return true
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	alreadyDone, err := model.RechargeAlipay(tradeNo, totalAmount, setting.AlipayFirstTopUpBonus, callerIp)
	switch {
	case err == nil && alreadyDone:
		logger.LogInfo(ctx, common.LogText("Alipay duplicate settlement ignored trade_no=%s", tradeNo))
		return true
	case err == nil:
		logger.LogInfo(ctx, common.LogText("Alipay top-up succeeded trade_no=%s total_amount=%s", tradeNo, totalAmount))
		return true
	case errors.Is(err, model.ErrTopUpAmountMismatch):
		// Retrying cannot fix a wrong amount; leave the order pending for an admin.
		logger.LogError(ctx, common.LogText("Alipay paid amount mismatch trade_no=%s total_amount=%s", tradeNo, totalAmount))
		return true
	case errors.Is(err, model.ErrTopUpNotFound), errors.Is(err, model.ErrPaymentMethodMismatch), errors.Is(err, model.ErrTopUpStatusInvalid):
		logger.LogWarn(ctx, common.LogText("Alipay settlement rejected trade_no=%s error=%q", tradeNo, err.Error()))
		return true
	default:
		logger.LogError(ctx, common.LogText("Alipay settlement failed trade_no=%s error=%q", tradeNo, err.Error()))
		return false
	}
}

// AlipayNotify handles Alipay's asynchronous notification. Alipay retries
// until it reads the literal body "success".
func AlipayNotify(c *gin.Context) {
	ctx := c.Request.Context()
	if !isAlipayTopUpEnabled() {
		logger.LogWarn(ctx, common.LogText("Alipay notify rejected reason=disabled client_ip=%s", c.ClientIP()))
		c.String(http.StatusOK, "fail")
		return
	}
	client, err := getAlipayClient()
	if err != nil {
		logger.LogError(ctx, common.LogText("Alipay notify client unavailable error=%q", err.Error()))
		c.String(http.StatusOK, "fail")
		return
	}
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusOK, "fail")
		return
	}
	notification, err := client.DecodeNotification(ctx, withoutAlipayCertSN(c.Request.PostForm))
	if err != nil {
		logger.LogWarn(ctx, common.LogText("Alipay notify signature verification failed client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "fail")
		return
	}
	if notification.AppId != strings.TrimSpace(setting.AlipayAppId) {
		logger.LogWarn(ctx, common.LogText("Alipay notify app_id mismatch trade_no=%s app_id=%s", notification.OutTradeNo, notification.AppId))
		c.String(http.StatusOK, "fail")
		return
	}
	if !settleAlipayTrade(ctx, notification.OutTradeNo, notification.TradeStatus, notification.TotalAmount, c.ClientIP()) {
		c.String(http.StatusOK, "fail")
		return
	}
	c.String(http.StatusOK, "success")
}

// AlipayReturn is where the cashier sends the browser after payment. The
// notification may not have arrived yet (or may be blocked), so the order is
// confirmed with alipay.trade.query before showing the wallet.
func AlipayReturn(c *gin.Context) {
	ctx := c.Request.Context()
	walletURL := paymentReturnPath("/wallet")
	defer c.Redirect(http.StatusFound, walletURL)

	if !isAlipayTopUpEnabled() {
		return
	}
	client, err := getAlipayClient()
	if err != nil {
		return
	}
	query := c.Request.URL.Query()
	// Only signed returns trigger an API call, so this public endpoint cannot
	// be used to make us query Alipay at will.
	if err := client.VerifySign(ctx, withoutAlipayCertSN(query)); err != nil {
		logger.LogWarn(ctx, common.LogText("Alipay return signature verification failed client_ip=%s error=%q", c.ClientIP(), err.Error()))
		return
	}
	tradeNo := query.Get("out_trade_no")
	if tradeNo == "" {
		return
	}
	result, err := client.TradeQuery(ctx, alipay.TradeQuery{OutTradeNo: tradeNo})
	if err != nil {
		logger.LogError(ctx, common.LogText("Alipay trade query failed trade_no=%s error=%q", tradeNo, err.Error()))
		return
	}
	if result.IsFailure() {
		logger.LogWarn(ctx, common.LogText("Alipay trade query rejected trade_no=%s code=%s sub_code=%s", tradeNo, result.Code, result.SubCode))
		return
	}
	settleAlipayTrade(ctx, result.OutTradeNo, result.TradeStatus, result.TotalAmount, c.ClientIP())
}
