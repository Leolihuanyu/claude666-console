/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Input } from '@/components/ui/input'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  SETUP_CATEGORIES,
  SETUP_CLIENTS,
  type SetupClient,
} from '../../lib/setup-clients'

/** Client logo, or its initial when @lobehub/icons has none. */
export function SetupClientIcon(props: { client: SetupClient; size: number }) {
  return (
    <span
      aria-hidden='true'
      className='flex shrink-0 items-center justify-center'
      style={{ width: props.size, height: props.size }}
    >
      {getLobeIcon(props.client.icon ?? props.client.name, props.size)}
    </span>
  )
}

interface ClientPickerProps {
  onSelect: (client: SetupClient) => void
}

/** "What do you use?" grid of clients, grouped by category, with search. */
export function ClientPicker(props: ClientPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const matches = SETUP_CLIENTS.filter((client) => {
    if (!needle) return true
    const name = client.translateName ? t(client.name) : client.name
    return [name, client.name, client.id, ...(client.keywords ?? [])].some(
      (text) => text.toLowerCase().includes(needle)
    )
  })

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <p className='text-base font-medium'>{t('What do you use?')}</p>
        <div className='relative'>
          <Search
            className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2'
            aria-hidden='true'
          />
          <Input
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search apps, e.g. Cursor')}
            aria-label={t('Search apps')}
            className='ps-8'
          />
        </div>
      </div>

      {matches.length === 0 && (
        <EmptyState
          icon={Search}
          title={t('No matching app')}
          description={t(
            'Most apps that accept an OpenAI compatible address work: use the address ending with /v1.'
          )}
          className='min-h-[200px]'
        />
      )}

      {SETUP_CATEGORIES.map((category) => {
        const clients = matches.filter((c) => c.category === category.id)
        if (clients.length === 0) return null
        return (
          <section key={category.id} className='space-y-2'>
            <h3 className='text-muted-foreground text-xs font-medium'>
              {t(category.label)}
            </h3>
            <ul className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5'>
              {clients.map((client) => {
                const name = client.translateName ? t(client.name) : client.name
                return (
                  <li key={client.id}>
                    <button
                      type='button'
                      onClick={() => props.onSelect(client)}
                      className='hover:bg-muted/60 focus-visible:ring-ring/50 flex h-full w-full flex-col items-center gap-1.5 rounded-lg border px-1.5 py-3 text-center transition-colors outline-none focus-visible:ring-[3px]'
                    >
                      <SetupClientIcon client={client} size={28} />
                      <span className='line-clamp-2 text-xs leading-tight font-medium'>
                        {name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
