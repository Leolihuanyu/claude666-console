/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import type { QuotaDataItem } from '../types'

/** Days of usage the runway estimate needs before it is shown. */
export const RUNWAY_MIN_ACTIVE_DAYS = 3
export const RUNWAY_WINDOW_DAYS = 7

/**
 * Days the balance lasts at the average daily spend of the last
 * RUNWAY_WINDOW_DAYS days. Null until the account has spent on at least
 * RUNWAY_MIN_ACTIVE_DAYS of them: one small call on a new account used to
 * read as "~632 days".
 */
export function estimateRunwayDays(
  remainQuota: number,
  rows: QuotaDataItem[],
  timezoneOffsetMinutes = new Date().getTimezoneOffset()
): number | null {
  if (remainQuota <= 0) return null
  const activeDays = new Set<number>()
  let spent = 0
  for (const row of rows) {
    const quota = Number(row.quota) || 0
    if (quota <= 0) continue
    spent += quota
    const local = Number(row.created_at) - timezoneOffsetMinutes * 60
    activeDays.add(Math.floor(local / 86400))
  }
  if (activeDays.size < RUNWAY_MIN_ACTIVE_DAYS || spent <= 0) return null
  return remainQuota / (spent / RUNWAY_WINDOW_DAYS)
}
