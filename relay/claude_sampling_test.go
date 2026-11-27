package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveUnsupportedClaudeSampling(t *testing.T) {
	temperature, topP, topK := 0.0, 0.9, 5
	budget := 1024
	tests := []struct {
		name        string
		model       string
		passThrough bool
		configured  []string
		removed     bool
	}{
		{name: "haiku 5.5", model: "claude-haiku-5-5", removed: true},
		{name: "dated sonnet 5.5", model: "claude-sonnet-5-5-20261001", removed: true},
		{name: "bedrock id", model: "us.anthropic.claude-haiku-5-5-v1:0", removed: true},
		{name: "opus 5.5 accepts sampling", model: "claude-opus-5-5"},
		{name: "sonnet 5 accepts sampling", model: "claude-sonnet-5"},
		{name: "body pass-through is left as sent", model: "claude-haiku-5-5", passThrough: true},
		{name: "configured list replaces the default", model: "claude-opus-5-5", configured: []string{"CLAUDE-OPUS-5-5"}, removed: true},
		{name: "empty list turns it off", model: "claude-haiku-5-5", configured: []string{}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			settings := model_setting.GetClaudeSettings()
			previous := settings.SamplingUnsupportedModels
			t.Cleanup(func() { settings.SamplingUnsupportedModels = previous })
			if test.configured != nil {
				settings.SamplingUnsupportedModels = test.configured
			}

			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: test.model}}
			info.ChannelSetting.PassThroughBodyEnabled = test.passThrough
			request := &dto.ClaudeRequest{
				Model:       test.model,
				Temperature: &temperature,
				TopP:        &topP,
				TopK:        &topK,
				Thinking:    &dto.Thinking{Type: "enabled", BudgetTokens: &budget},
			}

			removeUnsupportedClaudeSampling(c, info, request)

			// Thinking settings are never touched.
			require.NotNil(t, request.Thinking)
			assert.Equal(t, budget, *request.Thinking.BudgetTokens)
			if test.removed {
				assert.Nil(t, request.Temperature)
				assert.Nil(t, request.TopP)
				assert.Nil(t, request.TopK)
				require.Len(t, info.ConversionDiagnostics(), 1)
				assert.Equal(t, "claude_sampling_removed", info.ConversionDiagnostics()[0].Code)
				return
			}
			assert.Equal(t, &temperature, request.Temperature)
			assert.Equal(t, &topP, request.TopP)
			assert.Equal(t, &topK, request.TopK)
			assert.Empty(t, info.ConversionDiagnostics())
		})
	}
}
