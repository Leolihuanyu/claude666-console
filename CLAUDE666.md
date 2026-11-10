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
- Wallet: referral card hidden. Profile: sidebar toggles hidden. Header: theme
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
- New translation keys for the texts above in `web/src/i18n/locales/*.json`.
