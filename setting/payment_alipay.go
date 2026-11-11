package setting

// Claude服务站: direct Alipay (alipay.trade.page.pay) instead of an Epay
// aggregator. Amounts follow the shared Price and MinTopUp settings.
var AlipayAppId = ""
var AlipayPrivateKey = ""
var AlipayPublicKey = ""
var AlipaySandboxEnabled = false

// AlipayFirstTopUpBonus is extra USD credited on a user's first successful
// online top-up; the site advertises "首充再送 $4".
var AlipayFirstTopUpBonus = 0.0

// Referral rewards are paid when an invited user's first successful money
// top-up completes, not at sign-up (QuotaForInviter/QuotaForInvitee stay 0
// because sign-up rewards are easy to farm with throwaway accounts). Only the
// direct Alipay path pays them, as it is the only one used.
//
// ReferralInviterBonus (USD) goes to the inviter's referral rewards
// (aff_quota), which they transfer to their balance themselves;
// ReferralInviteeBonus (USD) is added to the invitee's balance with the
// top-up. ReferralMinTopUp (USD) is the smallest first top-up that qualifies;
// 0 accepts any amount.
var ReferralInviterBonus = 0.0
var ReferralInviteeBonus = 0.0
var ReferralMinTopUp = 0
