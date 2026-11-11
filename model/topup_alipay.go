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

// AlipayBonus is the extra credit RechargeAlipay may add, in USD. Every part
// is paid only on the user's first successful money top-up; 0 turns a part off.
type AlipayBonus struct {
	FirstTopUp float64
	// ReferralInviter goes to the inviter's referral rewards (aff_quota) and
	// ReferralInvitee to the invited user's balance, when the user was invited
	// and the top-up Amount is at least ReferralMinTopUp.
	ReferralInviter  float64
	ReferralInvitee  float64
	ReferralMinTopUp int64
}

func (b AlipayBonus) enabled() bool {
	return b.FirstTopUp > 0 || b.ReferralInviter > 0 || b.ReferralInvitee > 0
}

func quotaFromUSD(usd float64) (int, error) {
	if usd <= 0 {
		return 0, nil
	}
	quota, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromFloat(usd).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	)
	if err != nil {
		return 0, ErrInvalidTopUpQuota
	}
	return quota, nil
}

// RechargeAlipay completes an Alipay order the same way RechargeEpay does:
// row lock, status check and quota credit in one transaction, so duplicate
// notifications and the return-page query credit at most once, bonuses
// included.
//
// paidAmount is Alipay's total_amount in CNY.
func RechargeAlipay(tradeNo string, paidAmount string, bonus AlipayBonus, callerIp string) (alreadyDone bool, err error) {
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
	var referral referralReward
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
		if bonus.enabled() {
			// Locking the user first makes two first orders settling at the
			// same time take turns, so only one of them sees no earlier top-up.
			var user User
			if err := lockForUpdate(tx).Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(&user).Error; err != nil {
				return err
			}
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
				var err error
				if bonusQuota, err = quotaFromUSD(bonus.FirstTopUp); err != nil {
					return err
				}
				if referral, err = applyReferralBonus(tx, &user, topUp.Amount, bonus); err != nil {
					return err
				}
			}
		}

		var quotaErr error
		quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
			credit.Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}
		quotaToAdd += bonusQuota + referral.InviteeQuota
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

	common.SysLog(common.LogText("Alipay top-up succeeded trade_no=%s user_id=%d quota_to_add=%d bonus_quota=%d referral_invitee_quota=%d inviter_id=%d referral_inviter_quota=%d money=%.2f", topUp.TradeNo, topUp.UserId, quotaToAdd, bonusQuota, referral.InviteeQuota, referral.InviterId, referral.InviterQuota, topUp.Money))
	params := map[string]any{"provider": "支付宝", "quota": logger.FormatQuota(quotaToAdd), "bonus": logger.FormatQuota(bonusQuota), "referral": logger.FormatQuota(referral.InviteeQuota), "amount": fmt.Sprintf("¥%.2f", topUp.Money)}
	var message *common.Message
	switch {
	case bonusQuota > 0 && referral.InviteeQuota > 0:
		message = common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}} including first top-up bonus {{bonus}} and referral bonus {{referral}}, payment amount: {{amount}}", params)
	case bonusQuota > 0:
		message = common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}} including first top-up bonus {{bonus}}, payment amount: {{amount}}", params)
	case referral.InviteeQuota > 0:
		message = common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}} including referral bonus {{referral}}, payment amount: {{amount}}", params)
	default:
		message = common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", params)
	}
	RecordTopupLog(topUp.UserId, message, callerIp, topUp.PaymentMethod, PaymentProviderAlipay)
	if referral.InviterQuota > 0 {
		RecordLog(referral.InviterId, LogTypeSystem, common.NewMessage("Bonus for an invited user's first top-up {{quota}}", map[string]any{"quota": logger.FormatQuota(referral.InviterQuota)}))
	}
	return false, nil
}

type referralReward struct {
	InviterId    int
	InviteeQuota int
	InviterQuota int
}

// applyReferralBonus works out the referral rewards for a first top-up of
// amount by user and credits the inviter's share to their referral rewards
// inside tx. The invitee's share is left for the caller to add to the top-up
// credit.
func applyReferralBonus(tx *gorm.DB, user *User, amount int64, bonus AlipayBonus) (referralReward, error) {
	if bonus.ReferralInviter <= 0 && bonus.ReferralInvitee <= 0 {
		return referralReward{}, nil
	}
	if user.InviterId == 0 || user.InviterId == user.Id || amount < bonus.ReferralMinTopUp {
		return referralReward{}, nil
	}
	var inviter User
	if err := tx.Select("id").Where("id = ?", user.InviterId).First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return referralReward{}, nil
		}
		return referralReward{}, err
	}
	inviteeQuota, err := quotaFromUSD(bonus.ReferralInvitee)
	if err != nil {
		return referralReward{}, err
	}
	inviterQuota, err := quotaFromUSD(bonus.ReferralInviter)
	if err != nil {
		return referralReward{}, err
	}
	if inviterQuota > 0 {
		if err := tx.Model(&User{}).Where("id = ?", inviter.Id).Updates(map[string]any{
			"aff_quota":   gorm.Expr("aff_quota + ?", inviterQuota),
			"aff_history": gorm.Expr("aff_history + ?", inviterQuota),
		}).Error; err != nil {
			return referralReward{}, err
		}
	}
	return referralReward{InviterId: inviter.Id, InviteeQuota: inviteeQuota, InviterQuota: inviterQuota}, nil
}
