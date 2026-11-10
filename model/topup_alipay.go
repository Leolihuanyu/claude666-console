package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	PaymentMethodAlipay   = "alipay"
	PaymentProviderAlipay = "alipay"
)

// ErrTopUpAmountMismatch means Alipay reported a paid amount different from
// the order. The order stays pending so an admin can look at it.
var ErrTopUpAmountMismatch = errors.New("topup paid amount mismatch")

// RechargeAlipay completes an Alipay order the same way RechargeEpay does:
// row lock, status check and quota credit in one transaction, so duplicate
// notifications and the return-page query credit at most once.
//
// paidAmount is Alipay's total_amount in CNY. bonusUSD is added when this is
// the user's first successful money top-up.
func RechargeAlipay(tradeNo string, paidAmount string, bonusUSD float64, callerIp string) (alreadyDone bool, err error) {
	if tradeNo == "" {
		return false, errors.New("payment order number not provided")
	}
	paid, err := decimal.NewFromString(paidAmount)
	if err != nil {
		return false, ErrTopUpAmountMismatch
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	var quotaToAdd, bonusQuota int
	topUp := &TopUp{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return ErrTopUpNotFound
		}
		if topUp.PaymentProvider != PaymentProviderAlipay {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}
		if !paid.Equal(decimal.NewFromFloat(topUp.Money).Round(2)) {
			return ErrTopUpAmountMismatch
		}

		credit := decimal.NewFromInt(topUp.Amount)
		if bonusUSD > 0 {
			var previous int64
			// Balance-paid subscriptions move no money, so they do not use up
			// the first top-up.
			if err := tx.Model(&TopUp{}).
				Where("user_id = ? AND status = ? AND payment_provider <> ? AND id <> ?",
					topUp.UserId, common.TopUpStatusSuccess, PaymentProviderBalance, topUp.Id).
				Count(&previous).Error; err != nil {
				return err
			}
			if previous == 0 {
				bonus, bonusErr := common.WalletQuotaFromDecimalStrict(
					decimal.NewFromFloat(bonusUSD).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
				)
				if bonusErr != nil {
					return ErrInvalidTopUpQuota
				}
				bonusQuota = bonus
			}
		}

		var quotaErr error
		quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
			credit.Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}
		quotaToAdd += bonusQuota
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}
		return creditTopUpQuota(tx, topUp.UserId, quotaToAdd, nil)
	})
	if err != nil {
		if !errors.Is(err, ErrTopUpNotFound) && !errors.Is(err, ErrPaymentMethodMismatch) &&
			!errors.Is(err, ErrTopUpStatusInvalid) && !errors.Is(err, ErrTopUpAmountMismatch) {
			common.SysError(common.LogText("alipay topup failed: %s", err.Error()))
		}
		return false, err
	}
	if alreadyDone {
		return true, nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quotaToAdd, common.LogText("alipay topup"))

	common.SysLog(common.LogText("Alipay top-up succeeded trade_no=%s user_id=%d quota_to_add=%d bonus_quota=%d money=%.2f", topUp.TradeNo, topUp.UserId, quotaToAdd, bonusQuota, topUp.Money))
	amount := fmt.Sprintf("¥%.2f", topUp.Money)
	if bonusQuota > 0 {
		RecordTopupLog(topUp.UserId, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}} including first top-up bonus {{bonus}}, payment amount: {{amount}}", map[string]any{"provider": "支付宝", "quota": logger.FormatQuota(quotaToAdd), "bonus": logger.FormatQuota(bonusQuota), "amount": amount}), callerIp, topUp.PaymentMethod, PaymentProviderAlipay)
	} else {
		RecordTopupLog(topUp.UserId, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "支付宝", "quota": logger.FormatQuota(quotaToAdd), "amount": amount}), callerIp, topUp.PaymentMethod, PaymentProviderAlipay)
	}
	return false, nil
}
