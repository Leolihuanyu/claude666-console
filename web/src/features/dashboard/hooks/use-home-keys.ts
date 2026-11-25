/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { useQuery } from '@tanstack/react-query'

import { getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { requireServerSuccess } from '@/lib/server-error-message'

export const HOME_KEYS_QUERY_KEY = ['dashboard', 'home', 'api-keys'] as const

/** How often the guide checks whether the first call has come through. */
const FIRST_CALL_POLL_MS = 10_000

export function useHomeKeys(options?: { pollUntilUsed?: boolean }) {
  return useQuery({
    queryKey: HOME_KEYS_QUERY_KEY,
    queryFn: async () => {
      const result = requireServerSuccess(await getApiKeys({ p: 1, size: 10 }))
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 30 * 1000,
    refetchInterval: (query) =>
      options?.pollUntilUsed && !keysUsed(query.state.data ?? [])
        ? FIRST_CALL_POLL_MS
        : false,
  })
}

/** A key has carried at least one billed call. */
export function keysUsed(keys: ApiKey[]): boolean {
  return keys.some((key) => Number(key.used_quota) > 0)
}

