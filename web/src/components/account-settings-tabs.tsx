/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/profile', label: 'Profile' },
  { to: '/security', label: 'Security & Access' },
] as const

/**
 * The sidebar has one "Account settings" entry; these tabs switch between its
 * two pages, profile and security. A page hidden in the sidebar settings
 * loses its tab too.
 */
export function AccountSettingsTabs(props: { className?: string }) {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const visible = {
    '/profile': useIsSidebarModuleVisible('/profile'),
    '/security': useIsSidebarModuleVisible('/security'),
  }
  const tabs = TABS.filter((tab) => visible[tab.to])
  // One page left: nothing to switch between.
  if (tabs.length < 2) return null

  return (
    <nav
      aria-label={t('Account settings')}
      className={cn(
        'bg-muted/60 inline-flex w-fit rounded-lg p-0.5 text-sm',
        props.className
      )}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring rounded-md px-3 py-1 outline-none focus-visible:ring-2',
              active
                ? 'bg-background font-medium shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(tab.label)}
          </Link>
        )
      })}
    </nav>
  )
}
