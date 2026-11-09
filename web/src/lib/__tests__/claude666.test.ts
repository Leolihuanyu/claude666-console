/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { describe, expect, it } from 'vitest'

import { apiBaseUrl, claudeCodeSetup } from '../claude666'

describe('apiBaseUrl', () => {
  it('maps the console host to the api host and keeps the port', () => {
    expect(apiBaseUrl('https://console.claude666.top:8443')).toBe(
      'https://api.claude666.top:8443'
    )
    expect(apiBaseUrl('https://console.claude666.top/')).toBe(
      'https://api.claude666.top'
    )
  })

  it('leaves other hosts unchanged', () => {
    expect(apiBaseUrl('http://localhost:3001')).toBe('http://localhost:3001')
    expect(apiBaseUrl('https://api.claude666.top:8443')).toBe(
      'https://api.claude666.top:8443'
    )
  })

  it('returns unparsable input as is', () => {
    expect(apiBaseUrl('not a url')).toBe('not a url')
  })
})

describe('claudeCodeSetup', () => {
  it('strips the /v1 path from the endpoint', () => {
    expect(
      claudeCodeSetup(
        'https://api.claude666.top:8443/v1/chat/completions',
        'sk-x'
      )
    ).toBe(
      [
        'export ANTHROPIC_BASE_URL=https://api.claude666.top:8443',
        'export ANTHROPIC_AUTH_TOKEN=sk-x',
        'claude',
      ].join('\n')
    )
  })
})
