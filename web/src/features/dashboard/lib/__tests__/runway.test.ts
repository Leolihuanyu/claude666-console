/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { describe, expect, it } from 'vitest'

import type { QuotaDataItem } from '../../types'
import { estimateRunwayDays } from '../runway'

const day = 86400
const row = (createdAt: number, quota: number) =>
  ({ created_at: createdAt, quota, count: 1 }) as unknown as QuotaDataItem

describe('estimateRunwayDays', () => {
  it('waits until there are three days of spending', () => {
    // One $0.0016 call on a new account used to read as "~632 days".
    expect(estimateRunwayDays(499_200, [row(10 * day, 800)], 0)).toBeNull()
    expect(
      estimateRunwayDays(499_200, [row(10 * day, 800), row(11 * day, 800)], 0)
    ).toBeNull()
  })

  it('divides the balance by the average daily spend over seven days', () => {
    const rows = [row(10 * day, 7_000), row(11 * day, 7_000), row(12 * day, 7_000)]
    // 21,000 over 7 days = 3,000 a day.
    expect(estimateRunwayDays(30_000, rows, 0)).toBe(10)
  })

  it('counts hours of one local day as one active day', () => {
    const rows = [row(10 * day + 3600, 1), row(10 * day + 7200, 1), row(11 * day, 1)]
    expect(estimateRunwayDays(100, rows, 0)).toBeNull()
  })

  it('has no runway without a balance', () => {
    const rows = [row(10 * day, 1), row(11 * day, 1), row(12 * day, 1)]
    expect(estimateRunwayDays(0, rows, 0)).toBeNull()
  })
})
