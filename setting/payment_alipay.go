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
