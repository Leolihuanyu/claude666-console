/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronDown,
  Gift,
  MessageSquare,
  TerminalSquare,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { useDashboardContentVisibility } from '../../hooks/use-status-data'
import { AnnouncementsPanel } from '../overview/announcements-panel'
import { ApiInfoPanel } from '../overview/api-info-panel'
import { FAQPanel } from '../overview/faq-panel'
import { PerformanceHealthPanel } from '../overview/performance-health-panel'
import { SummaryCards } from '../overview/summary-cards'
import { UptimePanel } from '../overview/uptime-panel'
import { keysUsed, useHomeKeys } from '../../hooks/use-home-keys'
import { ToolSetup } from './tool-setup'

const SETUP_OPEN_STORAGE_KEY = 'home_tool_setup_open'
const STATUS_OPEN_STORAGE_KEY = 'home_service_status_open'

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Storage blocked: the choice just is not remembered.
  }
}

/** Where the in-browser chat lives until chat.leoapi.ai ships. */
const CHAT_PATH = '/playground'

function ChoiceCard(props: {
  icon: React.ReactNode
  title: string
  badge?: string
  description: string
  highlighted?: boolean
  action: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col gap-4 rounded-2xl border p-5',
        props.highlighted && 'border-primary/40 ring-primary/15 ring-4'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        {props.icon}
        {props.badge && (
          <span className='bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium'>
            {props.badge}
          </span>
        )}
      </div>
      <div className='flex flex-col gap-1.5'>
        <h2 className='text-base font-semibold'>{props.title}</h2>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {props.description}
        </p>
      </div>
      <div className='mt-auto'>{props.action}</div>
    </div>
  )
}

function NewUserHome(props: { remainQuota: number }) {
  const { t } = useTranslation()
  const [setupOpen, setSetupOpen] = useState(() =>
    readFlag(SETUP_OPEN_STORAGE_KEY)
  )
  const setupRef = useRef<HTMLDivElement>(null)

  const openSetup = () => {
    setSetupOpen(true)
    writeFlag(SETUP_OPEN_STORAGE_KEY, true)
    requestAnimationFrame(() =>
      setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-2'>
        <div className='text-primary flex items-center gap-2 text-sm font-medium'>
          <Gift className='size-4' />
          {t('Welcome to LeoAPI')}
        </div>
        <h2 className='text-2xl font-semibold text-balance'>
          {props.remainQuota > 0
            ? t('You have {{amount}} of free credit. Try it out.', {
                amount: formatQuota(props.remainQuota),
              })
            : t('Pick how you want to use Claude.')}
        </h2>
        <p className='text-muted-foreground text-sm'>
          {t('There are two ways to use it. Pick one; you can switch any time.')}
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <ChoiceCard
          highlighted
          badge={t('Recommended')}
          icon={
            <IconBadge tone='primary'>
              <MessageSquare />
            </IconBadge>
          }
          title={t('Chat in the browser')}
          description={t(
            'Nothing to set up. Chat with Claude, write code, and read images and files right on this site.'
          )}
          action={
            <Button render={<Link to={CHAT_PATH} />}>
              {t('Start chatting')}
              <ArrowRight data-icon='inline-end' />
            </Button>
          }
        />
        <ChoiceCard
          icon={
            <IconBadge tone='info'>
              <TerminalSquare />
            </IconBadge>
          }
          title={t('Connect my tools')}
          description={t(
            'Claude Code, Codex, Cursor, Cherry Studio and more: create a key, copy the setup, done.'
          )}
          action={
            <Button
              variant='outline'
              onClick={openSetup}
              aria-expanded={setupOpen}
            >
              {t('Set up')}
              <ChevronDown data-icon='inline-end' />
            </Button>
          }
        />
      </div>

      {setupOpen && (
        <div
          ref={setupRef}
          className='bg-card scroll-mt-4 rounded-2xl border p-5'
        >
          <h2 className='mb-4 text-base font-semibold'>
            {t('Connect a tool in three steps')}
          </h2>
          <ToolSetup numbered />
        </div>
      )}
    </div>
  )
}

function ReturningHome() {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-4'>
      <SummaryCards />
      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
        <ChoiceCard
          icon={
            <IconBadge tone='primary'>
              <MessageSquare />
            </IconBadge>
          }
          title={t('Chat in the browser')}
          description={t(
            'Chat with Claude, write code, and read images and files right on this site.'
          )}
          action={
            <Button render={<Link to={CHAT_PATH} />}>
              {t('Start chatting')}
              <ArrowRight data-icon='inline-end' />
            </Button>
          }
        />
        <div className='bg-card flex min-w-0 flex-col gap-4 rounded-2xl border p-5'>
          <div className='flex items-center gap-3'>
            <IconBadge tone='info'>
              <TerminalSquare />
            </IconBadge>
            <h2 className='text-base font-semibold'>{t('My tool setup')}</h2>
          </div>
          <ToolSetup />
        </div>
      </div>
    </div>
  )
}

/** Announcements, API routes and uptime, folded away at the bottom. */
function ServiceStatus() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)
  const visible = useDashboardContentVisibility()
  const [open, setOpen] = useState(() => readFlag(STATUS_OPEN_STORAGE_KEY))
  const anything =
    isAdmin ||
    visible.announcements ||
    visible.apiInfo ||
    visible.faq ||
    visible.uptimeKuma
  if (!anything) return null

  return (
    <div className='flex flex-col gap-4'>
      <Button
        variant='ghost'
        size='sm'
        className='text-muted-foreground w-fit'
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          writeFlag(STATUS_OPEN_STORAGE_KEY, !open)
        }}
      >
        <ChevronDown
          data-icon='inline-start'
          className={cn('transition-transform', open && 'rotate-180')}
        />
        {open
          ? t('Hide announcements and service status')
          : t('Announcements and service status')}
      </Button>
      {open && (
        <div className='grid gap-4 lg:grid-cols-2'>
          {isAdmin && <PerformanceHealthPanel />}
          {visible.announcements && <AnnouncementsPanel />}
          {visible.apiInfo && <ApiInfoPanel />}
          {visible.uptimeKuma && <UptimePanel />}
          {visible.faq && <FAQPanel />}
        </div>
      )}
    </div>
  )
}

/**
 * The first page after sign-in. Someone who has never made a call gets the
 * two ways to start (chat in the browser, or connect a tool); everyone else
 * gets their balance, chat and tool setup. Whether the account is new is
 * decided once per visit, so the page does not switch under a user who just
 * made their first call.
 */
export function HomePage() {
  const { t } = useTranslation()
  const storedUser = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const selfQuery = useQuery({
    queryKey: ['dashboard', 'home', 'self'],
    queryFn: async () => {
      const result = await getSelf()
      return result.success ? result.data : null
    },
    staleTime: 30 * 1000,
  })
  useEffect(() => {
    if (selfQuery.data && storedUser) setUser({ ...storedUser, ...selfQuery.data })
    // Only fresh server data should update the stored user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfQuery.data])

  const keysQuery = useHomeKeys()
  const user = selfQuery.data ?? storedUser
  const ready = selfQuery.isFetched && keysQuery.isFetched
  const [isNew, setIsNew] = useState<boolean | null>(null)
  useEffect(() => {
    if (isNew !== null || !ready) return
    const requestCount = Number(user?.request_count ?? 0)
    setIsNew(requestCount === 0 && !keysUsed(keysQuery.data ?? []))
  }, [isNew, ready, user?.request_count, keysQuery.data])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Console home')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-6'>
          {isNew === null && (
            <div className='bg-muted/40 h-64 animate-pulse rounded-2xl' />
          )}
          {isNew === true && (
            <NewUserHome remainQuota={Number(user?.quota ?? 0)} />
          )}
          {isNew === false && <ReturningHome />}
          <ServiceStatus />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
