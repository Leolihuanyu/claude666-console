package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const fallbackTestIndexPage = "<html>console</html>"

func newAPIPathFallbackTestServer(t *testing.T) http.Handler {
	t.Helper()
	setupRelayRouterTestDB(t)
	require.NoError(t, i18n.Init())
	user := model.User{Username: "fallback-user", Status: common.UserStatusEnabled, Group: "default", Quota: 100}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{UserId: user.Id, Key: "fallbacktestkey", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true}).Error)

	engine := gin.New()
	SetRouter(engine, WebAssets{IndexPage: []byte(fallbackTestIndexPage)})
	return APIPathFallback(engine)
}

type fallbackResponse struct {
	code int
	body string
}

func serveFallbackRequest(server http.Handler, method, path string, headers map[string]string) fallbackResponse {
	request := httptest.NewRequest(method, path, strings.NewReader(`{"model":"no-such-model","messages":[{"role":"user","content":"hi"}],"input":"hi","prompt":"hi","max_tokens":1}`))
	request.Header.Set("Content-Type", "application/json")
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, request)
	return fallbackResponse{code: recorder.Code, body: recorder.Body.String()}
}

// The fallback paths must be answered by the /v1 handler chain itself, so the
// test compares each with its /v1 path, with and without a key.
func TestAPIPathFallbackUsesV1RelayChain(t *testing.T) {
	server := newAPIPathFallbackTestServer(t)
	bearer := map[string]string{"Authorization": "Bearer sk-fallbacktestkey"}

	for _, testCase := range []struct {
		method  string
		path    string
		v1Path  string
		headers map[string]string
	}{
		{method: http.MethodPost, path: "/messages", v1Path: "/v1/messages", headers: map[string]string{"x-api-key": "sk-fallbacktestkey", "anthropic-version": "2023-06-01"}},
		{method: http.MethodPost, path: "/messages", v1Path: "/v1/messages"},
		{method: http.MethodPost, path: "/chat/completions", v1Path: "/v1/chat/completions", headers: bearer},
		{method: http.MethodPost, path: "/chat/completions", v1Path: "/v1/chat/completions"},
		{method: http.MethodPost, path: "/completions", v1Path: "/v1/completions", headers: bearer},
		{method: http.MethodPost, path: "/responses", v1Path: "/v1/responses", headers: bearer},
		{method: http.MethodPost, path: "/embeddings", v1Path: "/v1/embeddings", headers: bearer},
		{method: http.MethodPost, path: "/v1/v1/chat/completions", v1Path: "/v1/chat/completions", headers: bearer},
		{method: http.MethodPost, path: "/v1/v1/messages", v1Path: "/v1/messages", headers: bearer},
		{method: http.MethodGet, path: "/v1/v1/models", v1Path: "/v1/models", headers: bearer},
		{method: http.MethodGet, path: "/models", v1Path: "/v1/models", headers: bearer},
		{method: http.MethodGet, path: "/models", v1Path: "/v1/models", headers: map[string]string{"x-api-key": "sk-fallbacktestkey"}},
	} {
		t.Run(testCase.method+" "+testCase.path, func(t *testing.T) {
			got := serveFallbackRequest(server, testCase.method, testCase.path, testCase.headers)
			want := serveFallbackRequest(server, testCase.method, testCase.v1Path, testCase.headers)

			assert.NotContains(t, got.body, fallbackTestIndexPage)
			assert.Equal(t, want.code, got.code)
			assert.JSONEq(t, want.body, got.body)
		})
	}
}

func TestAPIPathFallbackKeepsConsoleAndExistingRoutes(t *testing.T) {
	server := newAPIPathFallbackTestServer(t)

	for _, testCase := range []struct {
		name     string
		method   string
		path     string
		headers  map[string]string
		wantCode int
		wantBody string
	}{
		{name: "console root", method: http.MethodGet, path: "/", wantCode: http.StatusOK, wantBody: fallbackTestIndexPage},
		{name: "console models page", method: http.MethodGet, path: "/models", wantCode: http.StatusOK, wantBody: fallbackTestIndexPage},
		{name: "console behind basic auth", method: http.MethodGet, path: "/models", headers: map[string]string{"Authorization": "Basic dXNlcjpwYXNz"}, wantCode: http.StatusOK, wantBody: fallbackTestIndexPage},
		{name: "console page with key header", method: http.MethodGet, path: "/chat/completions", headers: map[string]string{"Authorization": "Bearer sk-fallbacktestkey"}, wantCode: http.StatusOK, wantBody: fallbackTestIndexPage},
		{name: "unknown v1 path", method: http.MethodPost, path: "/v1/unknown", wantCode: http.StatusNotFound, wantBody: `Invalid URL (POST /v1/unknown)`},
		{name: "count_tokens stays closed", method: http.MethodPost, path: "/v1/messages/count_tokens", wantCode: http.StatusNotFound, wantBody: `Invalid URL (POST /v1/messages/count_tokens)`},
		{name: "unknown api path", method: http.MethodPost, path: "/api/unknown", wantCode: http.StatusNotFound, wantBody: `Invalid URL (POST /api/unknown)`},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			got := serveFallbackRequest(server, testCase.method, testCase.path, testCase.headers)
			assert.Equal(t, testCase.wantCode, got.code)
			assert.Contains(t, got.body, testCase.wantBody)
		})
	}
}

func TestWrongPathPostReturnsJSONHint(t *testing.T) {
	server := newAPIPathFallbackTestServer(t)
	originalAddress := system_setting.ServerAddress
	t.Cleanup(func() { system_setting.ServerAddress = originalAddress })

	for _, testCase := range []struct {
		name          string
		serverAddress string
		method        string
		path          string
		wantBase      string
	}{
		{name: "root post names the api host", serverAddress: "https://console.example.com/", method: http.MethodPost, path: "/", wantBase: "https://api.example.com"},
		{name: "other hosts are used as is", serverAddress: "https://gw.example.com", method: http.MethodPost, path: "/", wantBase: "https://gw.example.com"},
		{name: "no server address", serverAddress: "", method: http.MethodPost, path: "/", wantBase: "<API address>"},
		{name: "unversioned count_tokens", serverAddress: "https://console.example.com", method: http.MethodPost, path: "/messages/count_tokens", wantBase: "https://api.example.com"},
		{name: "unknown post", serverAddress: "https://console.example.com", method: http.MethodPost, path: "/foo/bar", wantBase: "https://api.example.com"},
		{name: "put to a console page", serverAddress: "https://console.example.com", method: http.MethodPut, path: "/models", wantBase: "https://api.example.com"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			system_setting.ServerAddress = testCase.serverAddress
			got := serveFallbackRequest(server, testCase.method, testCase.path, map[string]string{"Authorization": "Bearer sk-fallbacktestkey"})

			require.Equal(t, http.StatusNotFound, got.code)
			var payload struct {
				Error struct {
					Message string `json:"message"`
					Type    string `json:"type"`
					Code    string `json:"code"`
				} `json:"error"`
			}
			require.NoError(t, common.UnmarshalJsonStr(got.body, &payload))
			assert.Equal(t, "invalid_request_error", payload.Error.Type)
			assert.Equal(t, "invalid_url", payload.Error.Code)
			assert.Contains(t, payload.Error.Message, "请求路径不对")
			assert.Contains(t, payload.Error.Message, "Wrong request path ("+testCase.method+" "+testCase.path+")")
			assert.Contains(t, payload.Error.Message, testCase.wantBase+"/v1/chat/completions")
			assert.Contains(t, payload.Error.Message, "Claude/Anthropic format use "+testCase.wantBase+".")
		})
	}
}
