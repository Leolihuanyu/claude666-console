package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createAlipayTestOrder(t *testing.T, userID int, tradeNo string, amount int64, money float64, provider string, status string) *TopUp {
	t.Helper()
	order := &TopUp{
		UserId:          userID,
		Amount:          amount,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodAlipay,
		PaymentProvider: provider,
		Status:          status,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, order.Insert())
	return order
}

func useQuotaPerUnitForAlipayTest(t *testing.T) {
	t.Helper()
	old := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = old })
}

func TestRechargeAlipayAddsFirstTopUpBonusOnce(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	user := insertUserForPaymentGuardTest(t, 701, 0)
	first := createAlipayTestOrder(t, user.Id, "ALIPAYFIRST", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)
	second := createAlipayTestOrder(t, user.Id, "ALIPAYSECOND", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)

	alreadyDone, err := RechargeAlipay(first.TradeNo, "115.00", AlipayBonus{FirstTopUp: 4}, "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, (50+4)*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	_, err = RechargeAlipay(second.TradeNo, "115.00", AlipayBonus{FirstTopUp: 4}, "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, (50+4+50)*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeAlipayCreditsExactlyOnce(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	user := insertUserForPaymentGuardTest(t, 702, 0)
	order := createAlipayTestOrder(t, user.Id, "ALIPAYONCE", 10, 23, PaymentProviderAlipay, common.TopUpStatusPending)

	_, err := RechargeAlipay(order.TradeNo, "23.00", AlipayBonus{}, "127.0.0.1")
	require.NoError(t, err)
	alreadyDone, err := RechargeAlipay(order.TradeNo, "23.00", AlipayBonus{}, "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	assert.Equal(t, 10*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
	assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
}

func TestRechargeAlipaySkipsBonusAfterEarlierTopUp(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	user := insertUserForPaymentGuardTest(t, 703, 0)
	createAlipayTestOrder(t, user.Id, "EPAYEARLIER", 5, 11.5, PaymentProviderEpay, common.TopUpStatusSuccess)
	order := createAlipayTestOrder(t, user.Id, "ALIPAYLATER", 10, 23, PaymentProviderAlipay, common.TopUpStatusPending)

	_, err := RechargeAlipay(order.TradeNo, "23.00", AlipayBonus{FirstTopUp: 4}, "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, 10*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeAlipayRejectsWrongAmountAndForeignOrders(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	user := insertUserForPaymentGuardTest(t, 704, 0)
	order := createAlipayTestOrder(t, user.Id, "ALIPAYAMOUNT", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)
	epayOrder := createAlipayTestOrder(t, user.Id, "ALIPAYFOREIGN", 50, 115, PaymentProviderEpay, common.TopUpStatusPending)

	_, err := RechargeAlipay(order.TradeNo, "0.01", AlipayBonus{FirstTopUp: 4}, "127.0.0.1")
	assert.ErrorIs(t, err, ErrTopUpAmountMismatch)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))

	_, err = RechargeAlipay(epayOrder.TradeNo, "115.00", AlipayBonus{FirstTopUp: 4}, "127.0.0.1")
	assert.ErrorIs(t, err, ErrPaymentMethodMismatch)

	_, err = RechargeAlipay("ALIPAYMISSING", "115.00", AlipayBonus{FirstTopUp: 4}, "127.0.0.1")
	assert.ErrorIs(t, err, ErrTopUpNotFound)

	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func insertReferralTestUser(t *testing.T, id int, inviterID int) *User {
	t.Helper()
	user := &User{
		Id:        id,
		Username:  fmt.Sprintf("referral_user_%d", id),
		AffCode:   fmt.Sprintf("R%d", id),
		Status:    common.UserStatusEnabled,
		InviterId: inviterID,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func getAffQuotaForReferralTest(t *testing.T, userID int) (affQuota int, affHistory int) {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("aff_quota", "aff_history").Where("id = ?", userID).First(&user).Error)
	return user.AffQuota, user.AffHistoryQuota
}

var referralTestBonus = AlipayBonus{ReferralInviter: 5, ReferralInvitee: 3, ReferralMinTopUp: 20}

func TestRechargeAlipayPaysReferralOnceOnFirstQualifyingTopUp(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	inviter := insertReferralTestUser(t, 711, 0)
	invitee := insertReferralTestUser(t, 712, inviter.Id)
	first := createAlipayTestOrder(t, invitee.Id, "REFFIRST", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)
	second := createAlipayTestOrder(t, invitee.Id, "REFSECOND", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)

	bonus := referralTestBonus
	bonus.FirstTopUp = 4
	_, err := RechargeAlipay(first.TradeNo, "115.00", bonus, "127.0.0.1")
	require.NoError(t, err)
	// A duplicate notification for the same order must not pay again.
	alreadyDone, err := RechargeAlipay(first.TradeNo, "115.00", bonus, "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	_, err = RechargeAlipay(second.TradeNo, "115.00", bonus, "127.0.0.1")
	require.NoError(t, err)

	assert.Equal(t, (50+4+3+50)*500000, getUserQuotaForPaymentGuardTest(t, invitee.Id))
	affQuota, affHistory := getAffQuotaForReferralTest(t, inviter.Id)
	assert.Equal(t, 5*500000, affQuota)
	assert.Equal(t, 5*500000, affHistory)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, inviter.Id))
}

func TestRechargeAlipaySkipsReferralBelowMinimum(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	inviter := insertReferralTestUser(t, 721, 0)
	invitee := insertReferralTestUser(t, 722, inviter.Id)
	small := createAlipayTestOrder(t, invitee.Id, "REFSMALL", 10, 23, PaymentProviderAlipay, common.TopUpStatusPending)
	later := createAlipayTestOrder(t, invitee.Id, "REFLATER", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)

	_, err := RechargeAlipay(small.TradeNo, "23.00", referralTestBonus, "127.0.0.1")
	require.NoError(t, err)
	// The first top-up was too small, and a later large one is not the first.
	_, err = RechargeAlipay(later.TradeNo, "115.00", referralTestBonus, "127.0.0.1")
	require.NoError(t, err)

	assert.Equal(t, (10+50)*500000, getUserQuotaForPaymentGuardTest(t, invitee.Id))
	affQuota, affHistory := getAffQuotaForReferralTest(t, inviter.Id)
	assert.Zero(t, affQuota)
	assert.Zero(t, affHistory)
}

func TestRechargeAlipaySkipsReferralAfterEarlierTopUp(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	inviter := insertReferralTestUser(t, 731, 0)
	invitee := insertReferralTestUser(t, 732, inviter.Id)
	createAlipayTestOrder(t, invitee.Id, "REFEPAY", 5, 11.5, PaymentProviderEpay, common.TopUpStatusSuccess)
	order := createAlipayTestOrder(t, invitee.Id, "REFALIPAY", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)

	_, err := RechargeAlipay(order.TradeNo, "115.00", referralTestBonus, "127.0.0.1")
	require.NoError(t, err)

	assert.Equal(t, 50*500000, getUserQuotaForPaymentGuardTest(t, invitee.Id))
	affQuota, _ := getAffQuotaForReferralTest(t, inviter.Id)
	assert.Zero(t, affQuota)
}

func TestRechargeAlipaySkipsReferralWithoutInviter(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	alone := insertReferralTestUser(t, 741, 0)
	orphan := insertReferralTestUser(t, 742, 749) // inviter no longer exists
	aloneOrder := createAlipayTestOrder(t, alone.Id, "REFALONE", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)
	orphanOrder := createAlipayTestOrder(t, orphan.Id, "REFORPHAN", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)

	_, err := RechargeAlipay(aloneOrder.TradeNo, "115.00", referralTestBonus, "127.0.0.1")
	require.NoError(t, err)
	_, err = RechargeAlipay(orphanOrder.TradeNo, "115.00", referralTestBonus, "127.0.0.1")
	require.NoError(t, err)

	assert.Equal(t, 50*500000, getUserQuotaForPaymentGuardTest(t, alone.Id))
	assert.Equal(t, 50*500000, getUserQuotaForPaymentGuardTest(t, orphan.Id))
}

func TestInvitedRegistrationCountsWithoutSignUpReward(t *testing.T) {
	setupUserUpdateTestState(t)
	paymentSetting := operation_setting.GetPaymentSetting()
	original := []any{paymentSetting.ComplianceConfirmed, paymentSetting.ComplianceTermsVersion, common.QuotaForInviter}
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = original[0].(bool)
		paymentSetting.ComplianceTermsVersion = original[1].(string)
		common.QuotaForInviter = original[2].(int)
	})
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.QuotaForInviter = 0

	inviter := insertReferralTestUser(t, 751, 0)
	invitee := &User{
		Username:  "referral_invitee",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		InviterId: inviter.Id,
	}
	require.NoError(t, invitee.Insert(inviter.Id))

	var stored User
	require.NoError(t, DB.Select("aff_count", "aff_quota", "aff_history").Where("id = ?", inviter.Id).First(&stored).Error)
	assert.Equal(t, 1, stored.AffCount)
	assert.Zero(t, stored.AffQuota)
	assert.Zero(t, stored.AffHistoryQuota)
}

func TestTopUpPriceTiersOptionRejectsInvalidJSON(t *testing.T) {
	assert.Error(t, validateOptionValue("TopUpPriceTiers", `{"min_amount":250,"price":2}`))
	assert.Error(t, validateOptionValue("TopUpPriceTiers", `[{"min_amount":250,"price":-1}]`))
	assert.NoError(t, validateOptionValue("TopUpPriceTiers", `[{"min_amount":250,"price":2}]`))
}
