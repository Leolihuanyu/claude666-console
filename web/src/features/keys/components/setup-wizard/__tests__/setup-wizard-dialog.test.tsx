/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as clipboard from '@/lib/copy-to-clipboard'

import type { ApiKey } from '../../../types'
import { SetupWizardDialog } from '../setup-wizard-dialog'

const FULL_KEY = 'sk-wizardfixture0000000000abcd'

const TOKEN: ApiKey = {
  id: 1,
  name: 'laptop',
  key: 'wiza**********abcd',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 0,
  accessed_time: 0,
  group: '',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: true,
  model_limits: 'gpt-6-luna,claude-sonnet-5-5',
  allow_ips: '',
  allow_user_quota_query: false,
}

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  queryClient.setQueryData(['user-models-ccswitch'], {
    success: true,
    data: ['claude-opus-5-5'],
  })
})

afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

function renderWizard() {
  render(
    <QueryClientProvider client={queryClient}>
      <SetupWizardDialog
        open
        onOpenChange={vi.fn()}
        token={TOKEN}
        tokenKey={FULL_KEY}
      />
    </QueryClientProvider>
  )
}

describe('setup wizard', () => {
  it('filters the app grid by search text and keywords', async () => {
    renderWizard()
    const user = userEvent.setup()

    await user.type(
      screen.getByRole('searchbox', { name: 'Search apps' }),
      'idea'
    )

    expect(
      screen.getByRole('button', { name: 'JetBrains AI Assistant' })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Cursor' })
    ).not.toBeInTheDocument()
  })

  it('shows the script with a masked key and copies the full key', async () => {
    const copy = vi.spyOn(clipboard, 'copyToClipboard').mockResolvedValue(true)
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Claude Code' }))

    expect(
      screen.getByText('curl -fsSL https://leoapi.ai/setup.sh | bash')
    ).toBeVisible()
    expect(screen.queryByText(FULL_KEY)).not.toBeInTheDocument()
    expect(screen.getByText('sk-wiza********abcd')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Copy key' }))
    expect(copy).toHaveBeenCalledWith(FULL_KEY)
  })

  it('fills manual cards with a model from the key limit list', async () => {
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Trae' }))

    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
      'claude-sonnet-5-5'
    )
    const values = screen.getByText('Fill in these values').parentElement
    expect(values).not.toBeNull()
    expect(
      within(values as HTMLElement).getByText(
        'http://localhost:3000/v1/chat/completions'
      )
    ).toBeVisible()
    expect(
      within(values as HTMLElement).queryByText(FULL_KEY)
    ).not.toBeInTheDocument()
  })

  it('marks Cursor experimental and picks a GPT model for it', async () => {
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cursor' }))

    expect(screen.getByText('Experimental')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
      'gpt-6-luna'
    )
  })

  it('offers alternatives for unsupported apps and opens them', async () => {
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Windsurf' }))
    expect(
      screen.getByText('This app cannot connect to a custom address')
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cline' }))

    expect(screen.getByRole('heading', { name: 'Cline' })).toBeVisible()
  })

  it('opens the Cherry Studio import link only on click', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
    })
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cherry Studio' }))
    expect(assign).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Import to Cherry Studio' })
    )

    expect(assign).toHaveBeenCalledTimes(1)
    expect(String(assign.mock.calls[0][0])).toMatch(
      /^cherrystudio:\/\/providers\/api-keys\?v=1&data=/
    )
  })

  it('labels the Windows script as beta and points to the manual setup', async () => {
    renderWizard()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Claude Code' }))
    await user.click(screen.getByRole('tab', { name: 'Windows (beta)' }))

    expect(
      screen.getByText('irm https://leoapi.ai/setup.ps1 | iex')
    ).toBeVisible()
    expect(
      screen.getByText(/The Windows version is still in testing/)
    ).toHaveTextContent('"Set it up by hand instead"')
  })
})
