package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
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

	alreadyDone, err := RechargeAlipay(first.TradeNo, "115.00", 4, "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, (50+4)*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	_, err = RechargeAlipay(second.TradeNo, "115.00", 4, "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, (50+4+50)*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeAlipayCreditsExactlyOnce(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	user := insertUserForPaymentGuardTest(t, 702, 0)
	order := createAlipayTestOrder(t, user.Id, "ALIPAYONCE", 10, 23, PaymentProviderAlipay, common.TopUpStatusPending)

	_, err := RechargeAlipay(order.TradeNo, "23.00", 0, "127.0.0.1")
	require.NoError(t, err)
	alreadyDone, err := RechargeAlipay(order.TradeNo, "23.00", 0, "127.0.0.1")
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

	_, err := RechargeAlipay(order.TradeNo, "23.00", 4, "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, 10*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeAlipayRejectsWrongAmountAndForeignOrders(t *testing.T) {
	truncateTables(t)
	useQuotaPerUnitForAlipayTest(t)

	user := insertUserForPaymentGuardTest(t, 704, 0)
	order := createAlipayTestOrder(t, user.Id, "ALIPAYAMOUNT", 50, 115, PaymentProviderAlipay, common.TopUpStatusPending)
	epayOrder := createAlipayTestOrder(t, user.Id, "ALIPAYFOREIGN", 50, 115, PaymentProviderEpay, common.TopUpStatusPending)

	_, err := RechargeAlipay(order.TradeNo, "0.01", 4, "127.0.0.1")
	assert.ErrorIs(t, err, ErrTopUpAmountMismatch)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))

	_, err = RechargeAlipay(epayOrder.TradeNo, "115.00", 4, "127.0.0.1")
	assert.ErrorIs(t, err, ErrPaymentMethodMismatch)

	_, err = RechargeAlipay("ALIPAYMISSING", "115.00", 4, "127.0.0.1")
	assert.ErrorIs(t, err, ErrTopUpNotFound)

	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id))
}
