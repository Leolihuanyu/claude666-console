/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ManualGuide, SetupContext } from '../../../lib/setup-clients'
import { ManualGuideView } from '../manual-guide'

const CTX: SetupContext = {
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-pathfixture000000wxyz',
  model: 'claude-sonnet-5-5',
  gptModel: 'gpt-6-luna',
  models: [],
  quotaPerUnit: 500000,
}

const GUIDE: ManualGuide = {
  fields: [
    { label: 'Base URL', literal: true, value: { kind: 'url', url: 'v1' } },
    { label: 'API Key', literal: true, value: { kind: 'key' } },
  ],
  steps: ['Open the settings.'],
}

describe('ManualGuideView menu path', () => {
  it('draws the path with the last level highlighted and the fill-in values below', () => {
    render(
      <ManualGuideView
        guide={{ ...GUIDE, menuPath: ['Settings', 'Models', 'Add model'] }}
        ctx={CTX}
      />
    )

    const diagram = screen.getByRole('figure', { name: 'Where to find it' })
    const steps = within(diagram).getAllByRole('listitem')
    expect(steps.map((s) => s.textContent)).toEqual([
      'Settings',
      'Models',
      'Add model',
    ])
    expect(within(diagram).getByText('Add model')).toHaveAttribute(
      'aria-current',
      'step'
    )
    expect(
      within(diagram).getByText('https://api.example.com/v1')
    ).toBeVisible()
    expect(within(diagram).getByText('sk-path********wxyz')).toBeVisible()
    expect(within(diagram).queryByText(CTX.apiKey)).not.toBeInTheDocument()
  })

  it('shows neither a diagram nor a screenshot box when the client has no path or screenshot', () => {
    const { container } = render(<ManualGuideView guide={GUIDE} ctx={CTX} />)

    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('Screenshot coming soon')).not.toBeInTheDocument()
  })
})
