/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { toc } from '@lobehub/icons/es/toc'
import { describe, expect, it } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import {
  SETUP_CATEGORIES,
  SETUP_CLIENTS,
  type SetupContext,
  setupClientI18nKeys,
} from '../setup-clients'

const CTX: SetupContext = {
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-fixture-key-0001',
  model: 'claude-sonnet-5-5',
  gptModel: 'gpt-6-luna',
  models: ['claude-sonnet-5-5', 'gpt-6-luna'],
  quotaPerUnit: 500000,
}

const iconNames = new Set(toc.map((icon) => icon.id))
const enKeys = en.translation as Record<string, string>
const zhKeys = zh.translation as Record<string, string>

describe('setup client list', () => {
  it('has unique ids', () => {
    const ids = SETUP_CLIENTS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('puts every category to use', () => {
    for (const category of SETUP_CATEGORIES) {
      expect(SETUP_CLIENTS.some((c) => c.category === category.id)).toBe(true)
    }
  })

  it.each(SETUP_CLIENTS.map((c) => [c.id, c] as const))(
    '%s has the fields its tier needs',
    (_id, client) => {
      expect(client.name).not.toBe('')
      expect(client.summary).not.toBe('')
      if (client.icon) expect(iconNames.has(client.icon)).toBe(true)
      switch (client.tier) {
        case 'script':
          expect(client.manual?.steps.length).toBeGreaterThan(0)
          break
        case 'import':
          expect(client.imports?.length).toBeGreaterThan(0)
          expect(client.importSteps?.length).toBeGreaterThan(0)
          break
        case 'manual':
          expect(client.manual?.steps.length).toBeGreaterThan(0)
          expect(client.manual?.fields?.length).toBeGreaterThan(0)
          break
        case 'unsupported':
          expect(client.alternatives?.text).toBeTruthy()
          break
      }
    }
  )

  it('points alternatives at clients that exist', () => {
    const ids = new Set(SETUP_CLIENTS.map((c) => c.id))
    for (const client of SETUP_CLIENTS) {
      for (const id of client.alternatives?.clientIds ?? []) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })

  it('marks Cursor experimental and Coze unverified', () => {
    const byId = new Map(SETUP_CLIENTS.map((c) => [c.id, c]))
    expect(byId.get('cursor')?.experimental).toBe(true)
    expect(byId.get('coze')?.tier).toBe('unsupported')
    expect(byId.get('coze')?.unverified).toBe(true)
    expect(byId.get('windsurf')?.tier).toBe('unsupported')
    expect(byId.get('lingma')?.tier).toBe('unsupported')
  })

  it('translates every client text in English and Chinese', () => {
    const missing = SETUP_CLIENTS.flatMap(setupClientI18nKeys).filter(
      (key) => !(key in enKeys) || !(key in zhKeys)
    )
    expect(missing).toEqual([])
  })
})

describe('setup client content', () => {
  const fields = SETUP_CLIENTS.flatMap((c) =>
    (c.manual?.fields ?? []).map((f) => [c.id, f] as const)
  )

  it('uses only valid address kinds in fields', () => {
    for (const [, field] of fields) {
      if (field.value.kind === 'url') {
        expect(['root', 'v1', 'chat', 'messages']).toContain(field.value.url)
      }
    }
  })

  it('fills the key into the snippets and leaks no placeholder', () => {
    for (const client of SETUP_CLIENTS) {
      const snippets = client.manual?.snippets ?? []
      if (snippets.length === 0) continue
      const texts = snippets.map((s) => s.render(CTX))
      for (const text of texts) {
        expect(text).not.toMatch(/sk-xxx|undefined|\{\{/)
      }
      expect(texts.join('\n')).toContain(CTX.apiKey)
    }
  })

  it('parses every JSON snippet', () => {
    for (const client of SETUP_CLIENTS) {
      for (const snippet of client.manual?.snippets ?? []) {
        if (snippet.language === 'json') {
          expect(() => JSON.parse(snippet.render(CTX))).not.toThrow()
        }
      }
    }
  })

  it.each([
    ['claude-code', 'https://api.example.com"'],
    ['codex', 'https://api.example.com/v1"'],
    ['continue', 'apiBase: https://api.example.com/v1'],
    ['codebuddy', 'https://api.example.com/v1/chat/completions'],
    ['gemini-cli', 'GOOGLE_GEMINI_BASE_URL=https://api.example.com\n'],
  ])(
    '%s snippet uses the address spelling from the setup table',
    (id, expected) => {
      const client = SETUP_CLIENTS.find((c) => c.id === id)
      const text = (client?.manual?.snippets ?? [])
        .map((s) => s.render(CTX))
        .join('\n')
      expect(text).toContain(expected)
    }
  )

  it('renders an app link for every import action', () => {
    for (const client of SETUP_CLIENTS) {
      for (const action of client.imports ?? []) {
        const url = new URL(action.render(CTX))
        if (action.target === 'web') {
          expect(url.protocol).toBe('https:')
        } else {
          expect(url.protocol).not.toMatch(/^https?:$/)
        }
      }
    }
  })
})
