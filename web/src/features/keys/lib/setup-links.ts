/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/

/**
 * Addresses and one-click import links for the setup wizard. Everything is
 * built in the browser from the key the console already holds; nothing here
 * sends the key to a server.
 */

/** Name and id written into client apps; ASCII only (Cherry Studio 1.x drops parentheses and quotes). */
export const SETUP_PROVIDER = { id: 'leoapi', name: 'LeoAPI' } as const

/** Default model for snippets and imports, when the key can use it. */
export const DEFAULT_SETUP_MODEL = 'claude-sonnet-5-5'

/**
 * The four address spellings clients expect (see the client setup table,
 * section 1): bare origin, `/v1`, the full chat endpoint, the full messages endpoint.
 */
export type SetupUrlKind = 'root' | 'v1' | 'chat' | 'messages'

export function setupUrl(baseUrl: string, kind: SetupUrlKind): string {
  const root = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  switch (kind) {
    case 'root':
      return root
    case 'v1':
      return `${root}/v1`
    case 'chat':
      return `${root}/v1/chat/completions`
    case 'messages':
      return `${root}/v1/messages`
  }
}

export type ModelFamily = 'claude' | 'gpt'

/**
 * Model put into snippets: the default when the key has it, else the first
 * model of the wanted family, else the first model the key can use.
 */
export function pickSetupModel(models: string[], family?: ModelFamily): string {
  if (family === 'gpt') {
    const gpt = models.find((m) => m.startsWith('gpt-'))
    if (gpt) return gpt
  }
  if (models.includes(DEFAULT_SETUP_MODEL)) return DEFAULT_SETUP_MODEL
  if (family === 'claude') {
    const claude = models.find((m) => m.startsWith('claude-'))
    if (claude) return claude
  }
  return models[0] ?? DEFAULT_SETUP_MODEL
}

/** Models the key may call: its own limit list when set, else every model of the user. */
export function tokenModels(
  token: { model_limits_enabled: boolean; model_limits?: string | null },
  userModels: string[]
): string[] {
  if (token.model_limits_enabled && token.model_limits) {
    const limited = token.model_limits
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
    if (limited.length > 0) return limited
  }
  return userModels
}

/** `sk-abcd…wxyz` for display; copies and links always use the full key. */
export function maskKey(key: string): string {
  const body = key.startsWith('sk-') ? key.slice(3) : key
  if (body.length <= 8) return 'sk-****'
  return `sk-${body.slice(0, 4)}${'*'.repeat(8)}${body.slice(-4)}`
}

/** Standard Base64 of UTF-8 text (btoa alone rejects non-Latin-1 characters). */
export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export type CcSwitchApp = 'claude' | 'codex' | 'gemini'

export type CcSwitchModels = Partial<
  Record<'model' | 'haikuModel' | 'sonnetModel' | 'opusModel', string>
>

/**
 * CC Switch balance script. The site integration guide's New API script reads
 * `/api/user/self` with the user's system access token; that token can manage
 * the whole account and fetching it rotates it, so this one asks
 * `/api/usage/token/` with the key itself instead. It shows the account
 * balance when the key allows quota queries, otherwise the key's own quota.
 * The trailing slash avoids the 301 on `/api/usage/token`.
 */
export function ccSwitchUsageScript(quotaPerUnit: number): string {
  return `({
  request: {
    url: "{{baseUrl}}".replace(/\\/+$/, "").replace(/\\/v1$/, "") + "/api/usage/token/",
    method: "GET",
    headers: { "Authorization": "Bearer {{apiKey}}" }
  },
  extractor: function (response) {
    var d = response && response.data;
    if (!response || response.code !== true || !d) {
      return { isValid: false, invalidMessage: (response && response.message) || "query failed" };
    }
    var unit = ${quotaPerUnit};
    if (d.user_quota) {
      return { planName: d.name, remaining: d.user_quota.total_available / unit, used: d.user_quota.total_used / unit, unit: "USD" };
    }
    if (d.unlimited_quota) {
      return { planName: d.name, used: d.total_used / unit, unit: "USD" };
    }
    return { planName: d.name, remaining: d.total_available / unit, used: d.total_used / unit, total: d.total_granted / unit, unit: "USD" };
  }
})`
}

/**
 * `ccswitch://v1/import` provider link (CC Switch site integration guide).
 * Claude and Gemini take the bare origin, Codex `/v1`. Empty model fields are
 * left out, so Claude Code keeps its own model list. `homepage` is left out
 * too: CC Switch then derives it from the address without its `api.` prefix.
 */
export function buildCcSwitchUrl(params: {
  app: CcSwitchApp
  name: string
  baseUrl: string
  apiKey: string
  models?: CcSwitchModels
  quotaPerUnit?: number
}): string {
  const endpoint = setupUrl(
    params.baseUrl,
    params.app === 'codex' ? 'v1' : 'root'
  )
  const query = new URLSearchParams()
  query.set('resource', 'provider')
  query.set('app', params.app)
  query.set('name', params.name)
  query.set('endpoint', endpoint)
  query.set('apiKey', params.apiKey)
  for (const [field, value] of Object.entries(params.models ?? {})) {
    if (value) query.set(field, value)
  }
  if (params.quotaPerUnit && params.quotaPerUnit > 0) {
    query.set(
      'usageScript',
      base64Utf8(ccSwitchUsageScript(params.quotaPerUnit))
    )
    query.set('usageEnabled', 'true')
  }
  return `ccswitch://v1/import?${query.toString()}`
}

/**
 * Cherry Studio provider import (source: providersImport.ts). `type: new-api`
 * selects its New API provider, which takes the bare origin and adds `/v1`
 * (or `/v1beta` for Gemini) itself.
 */
export function buildCherryStudioUrl(params: {
  baseUrl: string
  apiKey: string
}): string {
  const payload = {
    id: SETUP_PROVIDER.id,
    name: SETUP_PROVIDER.name,
    type: 'new-api',
    baseUrl: setupUrl(params.baseUrl, 'root'),
    apiKey: params.apiKey,
  }
  const data = encodeURIComponent(base64Utf8(JSON.stringify(payload)))
  return `cherrystudio://providers/api-keys?v=1&data=${data}`
}

const CHATBOX_MODEL_PREFIXES = ['claude-', 'gpt-', 'gemini-']
const CHATBOX_MODEL_LIMIT = 30

/**
 * Chatbox provider import (docs: guides/providers/import-config). In OpenAI
 * mode Chatbox appends `/v1` to a bare host. Only chat model families are
 * listed; an untagged model is treated as text-only.
 */
export function buildChatboxUrl(params: {
  baseUrl: string
  apiKey: string
  model: string
  models: string[]
}): string {
  const root = setupUrl(params.baseUrl, 'root')
  const chatModels = params.models.filter((m) =>
    CHATBOX_MODEL_PREFIXES.some((prefix) => m.startsWith(prefix))
  )
  const modelIds = [
    params.model,
    ...chatModels.filter((m) => m !== params.model),
  ].slice(0, CHATBOX_MODEL_LIMIT)
  const payload = {
    id: SETUP_PROVIDER.id,
    name: SETUP_PROVIDER.name,
    type: 'openai',
    iconUrl: `${root}/logo.png`,
    urls: { website: root.replace('://api.', '://') },
    settings: {
      apiHost: root,
      apiKey: params.apiKey,
      models: modelIds.map((modelId) => ({
        modelId,
        capabilities: ['vision', 'tool_use'],
      })),
    },
  }
  const config = encodeURIComponent(base64Utf8(JSON.stringify(payload)))
  return `chatbox://provider/import?config=${config}`
}

/** Public NextChat deployment from new-api's chat presets. */
export const NEXTCHAT_APP_URL = 'https://app.nextchat.dev'

/**
 * NextChat quick link (`settings` command, app/command.ts). Only `key` and
 * `url` are read; NextChat adds `v1/chat/completions` itself, so the address
 * has no `/v1`. The settings sit after `#`, which browsers never send.
 */
export function buildNextChatUrl(params: {
  baseUrl: string
  apiKey: string
}): string {
  const settings = JSON.stringify({
    key: params.apiKey,
    url: setupUrl(params.baseUrl, 'root'),
  })
  return `${NEXTCHAT_APP_URL}/#/?settings=${encodeURIComponent(settings)}`
}

/** One-click setup scripts served by the site (they prompt for the key). */
export const SETUP_SCRIPT = {
  mac: 'curl -fsSL https://leoapi.ai/setup.sh | bash',
  windows: 'irm https://leoapi.ai/setup.ps1 | iex',
  macDownload: 'https://leoapi.ai/setup/leoapi-setup.command',
  windowsDownload: 'https://leoapi.ai/setup/leoapi-setup.bat',
  guide: 'https://leoapi.ai/setup/',
} as const
