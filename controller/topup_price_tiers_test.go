package controller

import (
	"fmt"
	"maps"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTopUpPriceTierTest mirrors production: ¥2.3 per USD, enterprise users
// at a 0.7391 top-up ratio (about ¥1.7 per USD).
func setupTopUpPriceTierTest(t *testing.T, tiers string) {
	t.Helper()
	originalPrice := operation_setting.Price
	originalDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalOptions := append([]int(nil), operation_setting.GetPaymentSetting().AmountOptions...)
	originalDiscounts := maps.Clone(operation_setting.GetPaymentSetting().AmountDiscount)
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()
	originalTiers := setting.TopUpPriceTiers
	t.Cleanup(func() {
		operation_setting.Price = originalPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType
		operation_setting.GetPaymentSetting().AmountOptions = originalOptions
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
		require.NoError(t, setting.UpdateTopUpPriceTiersByJsonString(originalTiers))
	})

	operation_setting.Price = 2.3
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1,"enterprise":0.7391}`))
	require.NoError(t, setting.UpdateTopUpPriceTiersByJsonString(tiers))
}

func TestGetPayMoneyAppliesPriceTiers(t *testing.T) {
	setupTopUpPriceTierTest(t, `[{"min_amount":250,"price":2},{"min_amount":1000,"price":1.9}]`)

	testCases := []struct {
		name     string
		amount   int64
		group    string
		expected string
	}{
		{name: "below the threshold pays the regular price", amount: 249, group: "default", expected: "572.70"},
		{name: "at the threshold pays the tier price", amount: 250, group: "default", expected: "500.00"},
		{name: "above the threshold pays the tier price", amount: 300, group: "default", expected: "600.00"},
		{name: "the largest reached tier wins", amount: 1000, group: "default", expected: "1900.00"},
		{name: "a cheaper group ratio is kept", amount: 250, group: "enterprise", expected: "424.98"},
		{name: "a cheaper group ratio below the threshold is unchanged", amount: 100, group: "enterprise", expected: "169.99"},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, fmt.Sprintf("%.2f", getPayMoney(tc.amount, tc.group)))
		})
	}
	assert.Equal(t, 500.0, getPayMoney(250, "default"))
}

func TestGetPayMoneyWithoutTiersIsUnchanged(t *testing.T) {
	setupTopUpPriceTierTest(t, `[]`)

	assert.Equal(t, "575.00", fmt.Sprintf("%.2f", getPayMoney(250, "default")))
}

func TestTopUpPriceTiersForGroupListsOnlyCheaperTiers(t *testing.T) {
	setupTopUpPriceTierTest(t, `[{"min_amount":250,"price":2}]`)
	operation_setting.GetPaymentSetting().AmountOptions = []int{50, 250, 500}
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{500: 0.8}

	tiers := topUpPriceTiersForGroup("default")
	require.Len(t, tiers, 1)
	assert.Equal(t, int64(250), tiers[0].MinAmount)
	assert.InDelta(t, 2/2.3, tiers[0].Discount, 1e-9)

	discounts := topUpDiscountsWithTiers(tiers)
	assert.NotContains(t, discounts, 50)
	assert.InDelta(t, 2/2.3, discounts[250], 1e-9)
	assert.Equal(t, 0.8, discounts[500], "an explicit preset discount is kept")

	assert.Empty(t, topUpPriceTiersForGroup("enterprise"))
}
