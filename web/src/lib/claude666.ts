/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/

/** Invite rewards are not offered yet; hide the wallet referral card. */
export const SHOW_AFFILIATE = false

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
