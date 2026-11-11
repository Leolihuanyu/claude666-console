package setting

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTopUpPriceTiers(t *testing.T) {
	tiers, err := ParseTopUpPriceTiers(`[{"min_amount":1000,"price":1.9},{"min_amount":250,"price":2}]`)
	require.NoError(t, err)
	assert.Equal(t, []TopUpPriceTier{{MinAmount: 250, Price: 2}, {MinAmount: 1000, Price: 1.9}}, tiers)

	for _, empty := range []string{"", "  ", "[]"} {
		tiers, err := ParseTopUpPriceTiers(empty)
		require.NoError(t, err)
		assert.Empty(t, tiers)
	}
}

func TestParseTopUpPriceTiersRejectsInvalidValues(t *testing.T) {
	for _, value := range []string{
		`{"min_amount":250,"price":2}`,
		`[{"min_amount":250,"price":2}`,
		`[{"min_amount":0,"price":2}]`,
		`[{"min_amount":-5,"price":2}]`,
		`[{"min_amount":250.5,"price":2}]`,
		`[{"min_amount":"250","price":2}]`,
		`[{"min_amount":250,"price":0}]`,
		`[{"min_amount":250}]`,
		`[{"min_amount":250,"price":2},{"min_amount":250,"price":1.9}]`,
	} {
		_, err := ParseTopUpPriceTiers(value)
		assert.Error(t, err, value)
		assert.Error(t, ValidateTopUpPriceTiers(value), value)
	}
}

func TestUpdateTopUpPriceTiersKeepsPreviousTiersOnError(t *testing.T) {
	original := TopUpPriceTiers
	t.Cleanup(func() { require.NoError(t, UpdateTopUpPriceTiersByJsonString(original)) })

	require.NoError(t, UpdateTopUpPriceTiersByJsonString(`[{"min_amount":250,"price":2},{"min_amount":1000,"price":1.9}]`))
	require.Error(t, UpdateTopUpPriceTiersByJsonString(`[{"min_amount":0,"price":2}]`))
	assert.Len(t, GetTopUpPriceTiers(), 2)

	_, ok := FindTopUpPriceTier(decimal.NewFromInt(249))
	assert.False(t, ok)
	tier, ok := FindTopUpPriceTier(decimal.NewFromInt(250))
	require.True(t, ok)
	assert.Equal(t, 2.0, tier.Price)
	tier, ok = FindTopUpPriceTier(decimal.NewFromInt(5000))
	require.True(t, ok)
	assert.Equal(t, 1.9, tier.Price)
}
