/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { describe, expect, it } from 'vitest'

import {
  base64Utf8,
  buildCcSwitchUrl,
  buildChatboxUrl,
  buildCherryStudioUrl,
  buildNextChatUrl,
  maskKey,
  pickSetupModel,
  setupUrl,
  tokenModels,
} from '../setup-links'

const BASE = 'https://api.example.com'
const KEY = 'sk-test+/=keyABCDEFGH'

function decodeBase64Utf8(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

describe('setupUrl', () => {
  it.each([
    ['root', 'https://api.example.com'],
    ['v1', 'https://api.example.com/v1'],
    ['chat', 'https://api.example.com/v1/chat/completions'],
    ['messages', 'https://api.example.com/v1/messages'],
  ] as const)('builds the %s spelling from a bare origin', (kind, expected) => {
    expect(setupUrl(BASE, kind)).toBe(expected)
  })

  it('does not double /v1 when the base already ends with it or a slash', () => {
    expect(setupUrl(`${BASE}/v1/`, 'v1')).toBe(`${BASE}/v1`)
    expect(setupUrl(`${BASE}/`, 'root')).toBe(BASE)
  })
})

describe('pickSetupModel', () => {
  it('prefers claude-sonnet-5-5 when the key can use it', () => {
    expect(pickSetupModel(['gpt-6-luna', 'claude-sonnet-5-5'])).toBe(
      'claude-sonnet-5-5'
    )
  })

  it('falls back to the first model when the default is missing', () => {
    expect(pickSetupModel(['claude-haiku-5-5', 'gpt-6-luna'])).toBe(
      'claude-haiku-5-5'
    )
  })

  it('takes a GPT model for GPT-first clients and the default otherwise', () => {
    expect(pickSetupModel(['claude-sonnet-5-5', 'gpt-6-luna'], 'gpt')).toBe(
      'gpt-6-luna'
    )
    expect(pickSetupModel(['claude-sonnet-5-5'], 'gpt')).toBe(
      'claude-sonnet-5-5'
    )
  })

  it('returns the default name when the key has no models', () => {
    expect(pickSetupModel([])).toBe('claude-sonnet-5-5')
  })
})

describe('tokenModels', () => {
  it('uses the key limit list when limits are enabled', () => {
    expect(
      tokenModels({ model_limits_enabled: true, model_limits: 'a, b,,c' }, [
        'x',
      ])
    ).toEqual(['a', 'b', 'c'])
  })

  it('uses the user models when the key has no limits', () => {
    expect(
      tokenModels({ model_limits_enabled: false, model_limits: 'a' }, ['x'])
    ).toEqual(['x'])
  })
})

describe('maskKey', () => {
  it('keeps only the first and last four characters', () => {
    const masked = maskKey('sk-abcdefghijklmnop')
    expect(masked).toBe('sk-abcd********mnop')
    expect(masked).not.toContain('efghijkl')
  })

  it('hides short keys entirely', () => {
    expect(maskKey('sk-abc')).toBe('sk-****')
  })
})

describe('base64Utf8', () => {
  it('round-trips non-Latin-1 text', () => {
    expect(decodeBase64Utf8(base64Utf8('狮子API ✓'))).toBe('狮子API ✓')
  })
})

describe('buildCcSwitchUrl', () => {
  it('builds a Claude link with the bare origin and no model fields', () => {
    const url = new URL(
      buildCcSwitchUrl({
        app: 'claude',
        name: 'LeoAPI',
        baseUrl: BASE,
        apiKey: KEY,
      })
    )
    expect(url.protocol).toBe('ccswitch:')
    expect(url.host).toBe('v1')
    expect(url.pathname).toBe('/import')
    expect(url.searchParams.get('resource')).toBe('provider')
    expect(url.searchParams.get('app')).toBe('claude')
    expect(url.searchParams.get('endpoint')).toBe(BASE)
    expect(url.searchParams.get('apiKey')).toBe(KEY)
    expect(url.searchParams.has('model')).toBe(false)
    expect(url.searchParams.has('usageScript')).toBe(false)
  })

  it('gives Codex the /v1 address and keeps only filled model fields', () => {
    const url = new URL(
      buildCcSwitchUrl({
        app: 'codex',
        name: 'LeoAPI',
        baseUrl: BASE,
        apiKey: KEY,
        models: { model: 'gpt-6-luna', haikuModel: '' },
      })
    )
    expect(url.searchParams.get('endpoint')).toBe(`${BASE}/v1`)
    expect(url.searchParams.get('model')).toBe('gpt-6-luna')
    expect(url.searchParams.has('haikuModel')).toBe(false)
  })

  it('encodes the balance script so it decodes back to the token usage request', () => {
    const raw = buildCcSwitchUrl({
      app: 'gemini',
      name: 'LeoAPI',
      baseUrl: BASE,
      apiKey: KEY,
      quotaPerUnit: 500000,
    })
    // Standard Base64 "+" must be percent-encoded, or CC Switch reads a space.
    expect(raw).not.toMatch(/usageScript=[^&]*\+/)
    const url = new URL(raw)
    const script = decodeBase64Utf8(url.searchParams.get('usageScript') ?? '')
    expect(script).toContain('/api/usage/token/')
    expect(script).toContain('Bearer {{apiKey}}')
    expect(script).toContain('var unit = 500000;')
    expect(url.searchParams.get('usageEnabled')).toBe('true')
  })
})

describe('buildCherryStudioUrl', () => {
  it('encodes a new-api provider with the bare origin', () => {
    const url = new URL(
      buildCherryStudioUrl({ baseUrl: `${BASE}/v1`, apiKey: KEY })
    )
    expect(url.protocol).toBe('cherrystudio:')
    expect(url.host).toBe('providers')
    expect(url.pathname).toBe('/api-keys')
    expect(url.searchParams.get('v')).toBe('1')
    const payload = JSON.parse(
      decodeBase64Utf8(url.searchParams.get('data') ?? '')
    )
    expect(payload).toEqual({
      id: 'leoapi',
      name: 'LeoAPI',
      type: 'new-api',
      baseUrl: BASE,
      apiKey: KEY,
    })
  })
})

describe('buildChatboxUrl', () => {
  it('encodes an OpenAI provider with the chosen model first', () => {
    const url = new URL(
      buildChatboxUrl({
        baseUrl: BASE,
        apiKey: KEY,
        model: 'claude-sonnet-5-5',
        models: ['gpt-6-luna', 'text-embedding-3', 'claude-sonnet-5-5'],
      })
    )
    expect(url.protocol).toBe('chatbox:')
    expect(url.host).toBe('provider')
    expect(url.pathname).toBe('/import')
    const payload = JSON.parse(
      decodeBase64Utf8(url.searchParams.get('config') ?? '')
    )
    expect(payload.type).toBe('openai')
    expect(payload.id).toBe('leoapi')
    expect(payload.iconUrl).toBe(`${BASE}/logo.png`)
    expect(payload.urls.website).toBe('https://example.com')
    expect(payload.settings.apiHost).toBe(BASE)
    expect(payload.settings.apiKey).toBe(KEY)
    expect(
      payload.settings.models.map((m: { modelId: string }) => m.modelId)
    ).toEqual(['claude-sonnet-5-5', 'gpt-6-luna'])
  })
})

describe('buildNextChatUrl', () => {
  it('puts key and bare origin into the hash settings', () => {
    const url = new URL(
      buildNextChatUrl({ baseUrl: `${BASE}/v1`, apiKey: KEY })
    )
    expect(url.origin).toBe('https://app.nextchat.dev')
    expect(url.search).toBe('')
    const hashQuery = new URLSearchParams(url.hash.slice(url.hash.indexOf('?')))
    expect(JSON.parse(hashQuery.get('settings') ?? '')).toEqual({
      key: KEY,
      url: BASE,
    })
  })
})
