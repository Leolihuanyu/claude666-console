# Claude服务站 modifications

This repository is a fork of [new-api](https://github.com/QuantumNous/new-api)
by QuantumNous, used as the customer console of Claude服务站. It is distributed
under the same GNU Affero General Public License v3.0; see `LICENSE` and
`NOTICE`. Frontend design and development by New API contributors.

Changes made in this fork (branch `claude666`):

- `web/src/styles/theme.css`: colors, font stack and radius follow the
  Claude服务站 site.
- `web/src/styles/claude666.css` (new): panels without outlines or shadows,
  no gradient or glass decoration, single accent for decorative icons, light
  stat numbers, medium-weight headings.
- `web/src/lib/claude666.ts` (new): switches for this fork (`SHOW_AFFILIATE`,
  `SIMPLE_CONSOLE`) and the Claude Code setup snippet.
- `web/src/routes/index.tsx`: the console root redirects to the dashboard
  instead of showing a landing page.
- Overview dashboard: customer-oriented setup guide (top up, create a key,
  set up Claude Code) with a Claude Code snippet in place of the curl example;
  shortcuts card hidden.
- Wallet: the referral card states the first top-up referral rule below and
  is shown only while `ReferralInviterBonus` is above 0 (`SHOW_AFFILIATE` is
  now on). Profile: sidebar toggles hidden. Header: theme
  drawer hidden. Pricing: filter column moved into the toolbar's filter sheet,
  hero glow removed.
- `web/src/components/ui/icon-badge.tsx`: exposes `data-slot` / `data-tone` for
  styling.
- API base URL shown to customers (key connection info, CC Switch, chat
  presets, model details, overview snippet) maps the `console.` host to the
  `api.` host via `apiBaseUrl` in `web/src/lib/claude666.ts`; `ServerAddress`
  stays the console host for password-reset and payment return links.
- Direct Alipay top-up (电脑网站支付): `setting/payment_alipay.go`,
  `controller/topup_alipay.go`, `model/topup_alipay.go` and the Alipay tab in
  the payment settings. When configured, the wallet's "alipay" method is
  routed to it instead of Epay; Alipay notifies `/api/alipay/notify`, and
  `/api/alipay/return` confirms the order with `alipay.trade.query`. An
  optional bonus is credited on a user's first successful money top-up.
  Uses `github.com/smartwalle/alipay/v3`.
- Top-up price tiers: option `TopUpPriceTiers` (JSON such as
  `[{"min_amount":250,"price":2}]`, `setting/topup_price_tiers.go`). A single
  top-up of `min_amount` USD or more is charged `price` CNY per USD; the
  reached tier with the largest `min_amount` applies. `getPayMoney` takes the
  cheaper of that and the regular price (group top-up ratio and amount
  discount), so tiers never stack with an enterprise ratio. `/api/user/topup/info`
  returns `price_tiers` that are cheaper for the user and adds the tier rate
  to `discount` for presets without their own discount; the wallet lists the
  tiers under the custom amount. Edited in the payment settings' General tab.
- Referral rewards on the invitee's first paid top-up instead of at sign-up:
  options `ReferralInviterBonus` (USD, to the inviter's referral rewards
  `aff_quota` / `aff_history`), `ReferralInviteeBonus` (USD, to the invitee's
  balance with the top-up) and `ReferralMinTopUp` (USD, smallest qualifying
  first top-up, 0 = any), all 0 by default. Paid in `RechargeAlipay`'s
  transaction (bonuses now passed as `model.AlipayBonus`); edited in the
  Alipay tab. Sign-up rewards `QuotaForInviter` / `QuotaForInvitee` are meant
  to stay 0, and the inviter's invite count now grows on every invited
  registration even when `QuotaForInviter` is 0.
- Overview: under the three setup steps, links to the per-tool setup guides
  on the site (`TOOL_GUIDES` / `TOOL_GUIDE_URL` in `web/src/lib/claude666.ts`).
- API path fallback for mistyped base URLs: `router/api_path_fallback.go`
  (`APIPathFallback`, wrapped around the Gin engine in `main.go`) rewrites the
  path before routing, so the request runs the normal `/v1` chain (auth, rate
  limit, billing, logs; logs show the `/v1` path). `/v1/v1/...` becomes
  `/v1/...`; POST `/messages`, `/chat/completions`, `/completions`,
  `/responses`, `/embeddings` get `/v1`; GET `/models` gets `/v1` only with
  `x-api-key` or `Authorization: Bearer`, because `/models` is also a console
  page (browsers never send those on navigation; `Basic` is ignored for
  consoles behind HTTP basic auth). `/messages/count_tokens` is not rewritten
  because `/v1/messages/count_tokens` is disabled upstream.
- Non-GET/HEAD/OPTIONS requests that no route took and that are outside
  `/v1`, `/api`, `/assets` (POST `/` and the like) get a 404 OpenAI-style error
  (`code: invalid_url`) with a Chinese/English hint naming the base URLs,
  instead of the console HTML with 200 (`wrongPathGuard` in
  `router/web-router.go`, also on the `FRONTEND_BASE_URL` redirect in
  `router/main.go`; `controller.RelayWrongPath`). The address is
  `ServerAddress` with `console.` mapped to `api.`, as in `apiBaseUrl`.
- New translation keys for the texts above in `web/src/i18n/locales/*.json`.
- Gemini actions the relay does not serve: `rejectUnservedGeminiAction` in
  `router/relay-router.go` runs before auth on `/v1` and `/v1beta`. POST
  `models/{m}:countTokens` gets a Gemini-format 501 `UNIMPLEMENTED`, any other
  action outside generateContent / streamGenerateContent / embedContent /
  batchEmbedContents / predict / predictLongRunning a 404 `NOT_FOUND`. Before,
  `/v1/models/{m}:countTokens` (google-genai's default `v1`) ran as a billed
  generateContent; consume logs with `other.request_path` ending in
  `:countTokens` are those requests.
- Claude models that refuse sampling controls: option
  `claude.sampling_unsupported_models` (JSON array of model-name fragments,
  case-insensitive substring match, default `["claude-haiku-5-5",
  "claude-sonnet-5-5"]`, `setting/model_setting/claude.go`). Native
  `/v1/messages` requests to a matching upstream model have `temperature`,
  `top_p` and `top_k` removed before conversion (`removeUnsupportedClaudeSampling`
  in `relay/claude_handler.go`, logged as conversion diagnostic
  `claude_sampling_removed`), like the chat conversion already did. Body
  pass-through is not touched. No console UI yet; set it with `PUT /api/option`.
- `GET /v1/models/{id}` (`RetrieveModel` in `controller/model.go`) looks the
  model up in the token's own list (`userVisibleModels`, shared with
  `ListModels`) instead of a static built-in list: 200 with the model object
  (Anthropic format with `x-api-key` + `anthropic-version`), otherwise 404
  (`model_not_found`, or Anthropic `not_found_error`).
- Anthropic-format errors: `error.type` is always an Anthropic type, kept
  from the upstream or derived from the status code (`claudeErrorType` in
  `relaykit/types/error.go`; a missing upstream type used to print `"<nil>"`).
  `upstreamErrorMessage` in `service/error.go` moves an upstream gateway's
  `(request id: …)` from the message to the server log, so the client sees
  only ours, and appends `(param: …)` when the upstream names one outside
  the message.
- Setup wizard ("一键接入") on the keys page: a button on every key row opens
  `SetupWizardDialog` (`web/src/features/keys/components/setup-wizard/`). The
  customer picks an app from an icon grid with search, then gets one of four
  guides: the site's setup script (`curl -fsSL https://leoapi.ai/setup.sh |
  bash` / `irm https://leoapi.ai/setup.ps1 | iex`, which asks for the key; the
  command carries none; the Mac double-click version is
  `leoapi.ai/setup/leoapi-setup-mac.zip`, because a downloaded `.command`
  loses its execute bit), one-click import buttons (CC Switch, Cherry Studio
  with `type: new-api`, Chatbox, NextChat), a card of values with copy buttons
  and steps, or "not supported" with alternatives. The clients are data in
  `web/src/features/keys/lib/setup-clients.ts` (add a client there); address
  spellings and links are built in `setup-links.ts` from the setup table in
  leoapi-ops (`docs/clients/`, tested 2026-11-27). Links and snippets are built
  in the browser from the key the page already fetches; the key is masked on
  screen, copied in full, never put into an `href` or browser storage, and no
  new backend endpoint was added. Snippets use the key's own model list
  (default `claude-sonnet-5-5`, else the first model). Cursor is marked
  experimental (Claude through our address is untested); Coze SaaS is
  "not verified". The Codex manual snippet puts the key in
  `experimental_bearer_token`, like the script: Codex desktop opened from the
  Dock does not read `~/.zshrc`. Screenshot slots are empty for now.
- CC Switch dialog: every model field is optional, and the link carries a
  balance script (`ccSwitchUsageScript`) that asks `/api/usage/token/` with
  the key itself instead of the guide's `/api/user/self`, which would need the
  account's system access token in the link.
