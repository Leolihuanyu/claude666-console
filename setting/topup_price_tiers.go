package setting

import (
	"encoding/json"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"

	"github.com/shopspring/decimal"
)

// TopUpPriceTier is a volume price: a single top-up of at least MinAmount USD
// is charged Price (CNY) per USD instead of the shared Price.
type TopUpPriceTier struct {
	MinAmount int64   `json:"min_amount"`
	Price     float64 `json:"price"`
}

// Claude服务站: TopUpPriceTiers is the raw option, e.g.
// [{"min_amount":250,"price":2}]. The parsed tiers below are kept sorted by
// MinAmount so the lookup can stop at the first tier that is too large.
var TopUpPriceTiers = "[]"

var (
	topUpPriceTiersMu sync.RWMutex
	topUpPriceTiers   []TopUpPriceTier
)

// ParseTopUpPriceTiers decodes and validates the option value. An empty value
// means no tiers.
func ParseTopUpPriceTiers(value string) ([]TopUpPriceTier, error) {
	raw := json.RawMessage(strings.TrimSpace(value))
	if len(raw) == 0 {
		return []TopUpPriceTier{}, nil
	}
	if common.GetJsonType(raw) != "array" {
		return nil, common.NewMessage("Top-up price tiers must be a JSON array")
	}
	// min_amount is decoded as a float first so 250.5 is reported as "not an
	// integer" instead of a generic type error.
	var entries []struct {
		MinAmount float64 `json:"min_amount"`
		Price     float64 `json:"price"`
	}
	if err := common.Unmarshal(raw, &entries); err != nil {
		return nil, common.NewMessage("Failed to parse top-up price tiers: {{error}}", map[string]any{"error": err.Error()})
	}
	tiers := make([]TopUpPriceTier, 0, len(entries))
	seen := make(map[int64]bool, len(entries))
	for _, entry := range entries {
		if entry.MinAmount <= 0 || entry.MinAmount != math.Trunc(entry.MinAmount) || entry.MinAmount > math.MaxInt32 {
			return nil, common.NewMessage("Top-up price tier min_amount must be a positive integer")
		}
		if !(entry.Price > 0) || math.IsInf(entry.Price, 0) {
			return nil, common.NewMessage("Top-up price tier price must be greater than 0")
		}
		minAmount := int64(entry.MinAmount)
		if seen[minAmount] {
			return nil, common.NewMessage("Duplicate top-up price tier for {{amount}}", map[string]any{"amount": minAmount})
		}
		seen[minAmount] = true
		tiers = append(tiers, TopUpPriceTier{MinAmount: minAmount, Price: entry.Price})
	}
	sort.Slice(tiers, func(i, j int) bool { return tiers[i].MinAmount < tiers[j].MinAmount })
	return tiers, nil
}

func ValidateTopUpPriceTiers(value string) error {
	_, err := ParseTopUpPriceTiers(value)
	return err
}

func UpdateTopUpPriceTiersByJsonString(value string) error {
	tiers, err := ParseTopUpPriceTiers(value)
	if err != nil {
		return err
	}
	topUpPriceTiersMu.Lock()
	defer topUpPriceTiersMu.Unlock()
	TopUpPriceTiers = value
	topUpPriceTiers = tiers
	return nil
}

// GetTopUpPriceTiers returns a copy of the tiers sorted by MinAmount.
func GetTopUpPriceTiers() []TopUpPriceTier {
	topUpPriceTiersMu.RLock()
	defer topUpPriceTiersMu.RUnlock()
	return append([]TopUpPriceTier(nil), topUpPriceTiers...)
}

// FindTopUpPriceTier returns the tier with the largest MinAmount not above
// amountUSD.
func FindTopUpPriceTier(amountUSD decimal.Decimal) (TopUpPriceTier, bool) {
	topUpPriceTiersMu.RLock()
	defer topUpPriceTiersMu.RUnlock()
	var found TopUpPriceTier
	ok := false
	for _, tier := range topUpPriceTiers {
		if amountUSD.LessThan(decimal.NewFromInt(tier.MinAmount)) {
			break
		}
		found, ok = tier, true
	}
	return found, ok
}
