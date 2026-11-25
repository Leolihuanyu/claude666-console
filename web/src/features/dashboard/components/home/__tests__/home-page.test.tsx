/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { HomePage } from '../home-page'

let client: QueryClient
let self: { request_count: number; quota: number }
let keys: { id: number; name: string; key: string; status: number; used_quota: number }[]

beforeEach(() => {
  window.localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  self = { request_count: 0, quota: 500000 }
  keys = []
  useAuthStore.getState().auth.setUser({ id: 1, username: 'new-user', role: 1, ...self })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/self') {
      return { data: { success: true, data: { id: 1, username: 'new-user', role: 1, ...self } } }
    }
    if (url === '/api/token/?p=1&size=10') {
      return { data: { success: true, data: { items: keys } } }
    }
    if (url === '/api/status') {
      return {
        data: {
          data: {
            api_info_enabled: false,
            announcements_enabled: false,
            faq_enabled: false,
            uptime_kuma_enabled: false,
          },
        },
      }
    }
    if (url.startsWith('/api/data/self')) return { data: { success: true, data: [] } }
    throw new Error(`Unexpected home request: ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
})

async function renderHome() {
  const router = createRouter({
    routeTree: createRootRoute({ component: HomePage }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('home page', () => {
  it('offers a new user the two ways to start and the trial credit', async () => {
    await renderHome()

    expect(await screen.findByText('Chat in the browser')).toBeInTheDocument()
    expect(screen.getByText('Connect my tools')).toBeInTheDocument()
    expect(screen.getByText(/free credit/)).toBeInTheDocument()
    expect(screen.queryByText('My tool setup')).not.toBeInTheDocument()
  })

  it('opens the three setup steps in place', async () => {
    const user = userEvent.setup()
    await renderHome()

    await user.click(await screen.findByRole('button', { name: 'Set up' }))

    expect(screen.getByText('Connect a tool in three steps')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Create a key' })).toBeInTheDocument()
    expect(screen.getByText('Make the first call')).toBeInTheDocument()
  })

  it('takes a user with calls straight to balance, chat and tool setup', async () => {
    self = { request_count: 12, quota: 400000 }
    keys = [{ id: 1, name: 'default', key: 'abcdefghijkl', status: 1, used_quota: 5000 }]
    await renderHome()

    expect(await screen.findByText('My tool setup')).toBeInTheDocument()
    expect(screen.queryByText('Connect my tools')).not.toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
  })
})
