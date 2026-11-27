package router

import (
	"net/http"
	"strings"
)

// Relay paths that clients reach without /v1 when the base URL is entered
// without it. /messages/count_tokens is left out because /v1 does not serve it.
var unversionedRelayPostPaths = map[string]bool{
	"/messages":         true,
	"/chat/completions": true,
	"/completions":      true,
	"/responses":        true,
	"/embeddings":       true,
}

// APIPathFallback rewrites relay paths that customers' clients build from a
// mistyped base URL to the /v1 path before Gin routes the request, so they go
// through the exact /v1 handler chain (auth, rate limit, billing, logs). The
// rewrite has to happen before routing rather than through extra route
// registrations because the relay derives its mode from the /v1 request path
// (relay/constant.Path2RelayMode).
//
//   - /v1/v1/... (base URL ending in /v1 plus a client that appends /v1) becomes /v1/...
//   - POST /messages, /chat/completions, /completions, /responses, /embeddings get /v1
//   - GET /models gets /v1 only with an API credential header, because /models
//     is also a console page that browsers navigate to.
func APIPathFallback(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if rewriteAPIFallbackPath(r) {
			r.RequestURI = r.URL.RequestURI()
		}
		next.ServeHTTP(w, r)
	})
}

// rewriteAPIFallbackPath edits r.URL in place. RawPath is kept in step with
// Path so escaped segments (such as %2F in a model name) survive.
func rewriteAPIFallbackPath(r *http.Request) bool {
	u := r.URL
	if strings.HasPrefix(u.Path, "/v1/v1/") {
		for strings.HasPrefix(u.Path, "/v1/v1/") {
			u.Path = strings.TrimPrefix(u.Path, "/v1")
			if rawPath, ok := strings.CutPrefix(u.RawPath, "/v1"); ok {
				u.RawPath = rawPath
			} else {
				u.RawPath = ""
			}
		}
		return true
	}
	addVersion := false
	switch r.Method {
	case http.MethodPost:
		addVersion = unversionedRelayPostPaths[u.Path]
	case http.MethodGet:
		addVersion = u.Path == "/models" && hasAPICredential(r)
	}
	if !addVersion {
		return false
	}
	u.Path = "/v1" + u.Path
	if u.RawPath != "" {
		u.RawPath = "/v1" + u.RawPath
	}
	return true
}

// hasAPICredential tells API clients from browser page loads. Only a Bearer
// Authorization counts: a console behind HTTP Basic auth makes the browser
// send "Authorization: Basic" on page navigations too.
func hasAPICredential(r *http.Request) bool {
	if r.Header.Get("x-api-key") != "" {
		return true
	}
	scheme, _, _ := strings.Cut(r.Header.Get("Authorization"), " ")
	return strings.EqualFold(scheme, "Bearer")
}
