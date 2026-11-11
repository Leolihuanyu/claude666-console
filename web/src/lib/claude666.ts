/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/

/**
 * Wallet referral card. It still stays hidden while ReferralInviterBonus is 0,
 * since referrals are rewarded on the invitee's first top-up only.
 */
export const SHOW_AFFILIATE = true

/**
 * Keep the console as plain as the marketing site: the sidebar toggles in the
 * profile, the theme drawer, the overview shortcuts (they repeat the sidebar)
 * and the always-open pricing filter column are hidden. Every feature they lead
 * to is still reachable from the sidebar or the pricing toolbar's filter.
 */
export const SIMPLE_CONSOLE = true

/**
 * Terminal setup for Claude Code. Customers mostly use Claude Code, so the
 * overview shows this instead of upstream's OpenAI-style curl example.
 * `endpoint` may be a bare origin or a full `/v1/...` URL.
 */
export function claudeCodeSetup(endpoint: string, apiKey: string): string {
  const baseUrl = endpoint.replace(/\/v1(\/.*)?$/, '').replace(/\/+$/, '')
  return [
    `export ANTHROPIC_BASE_URL=${baseUrl}`,
    `export ANTHROPIC_AUTH_TOKEN=${apiKey}`,
    'claude',
  ].join('\n')
}

/**
 * Base URL customers put into Claude Code or an SDK. The console is served at
 * `console.<domain>` and the same backend at `api.<domain>`; customers should
 * see the api host (the one on claude666.top), while password-reset and
 * payment return links keep using `ServerAddress`, the console host. Any other
 * host is returned unchanged, so local development is unaffected.
 */
export function apiBaseUrl(address: string): string {
  try {
    const url = new URL(address)
    if (url.hostname.startsWith('console.')) {
      url.hostname = `api.${url.hostname.slice('console.'.length)}`
    }
    return url.origin
  } catch {
    return address
  }
}

/**
 * Setup guides for tools other than Claude Code. The steps live on the
 * marketing site (one copy to maintain); `#id` opens that tool's dialog there.
 * `label` is a product name, or an i18n key when `translate` is set.
 */
export const TOOL_GUIDE_URL = 'https://claude666.top/guides/api-quickstart'

export const TOOL_GUIDES: { id: string; label: string; translate?: boolean }[] =
  [
    { id: 'codex', label: 'Codex' },
    { id: 'opencode', label: 'OpenCode' },
    { id: 'deepseek-harness', label: 'DeepSeek Harness' },
    { id: 'vscode', label: 'Cline / Roo Code' },
    { id: 'chat', label: 'Cherry Studio' },
    { id: 'sdk', label: 'Code (SDK)', translate: true },
    { id: 'other', label: 'Other tools', translate: true },
  ]
