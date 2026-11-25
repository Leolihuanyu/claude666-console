/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Radio,
  TerminalSquare,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { createApiKey, fetchTokenKey } from '@/features/keys/api'
import {
  API_KEY_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
} from '@/features/keys/lib'
import type { ApiKey } from '@/features/keys/types'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import {
  TOOL_GUIDES,
  TOOL_GUIDE_URL,
  apiBaseUrl,
  claudeCodeSetup,
} from '@/lib/claude666'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import {
  HOME_KEYS_QUERY_KEY,
  keysUsed,
  useHomeKeys,
} from '../../hooks/use-home-keys'

type Tool = 'claude-code' | 'other'

function preferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((key) => key.status === 1) ?? keys[0] ?? null
}

function maskKey(key?: string): string {
  if (!key) return 'sk-...'
  const full = key.startsWith('sk-') ? key : `sk-${key}`
  return full.length <= 14 ? full : `${full.slice(0, 7)}...${full.slice(-4)}`
}

function endpoint(): string {
  return typeof window === 'undefined' ? '' : apiBaseUrl(window.location.origin)
}

function Step(props: {
  index?: number
  done: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <li className='flex gap-3'>
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
          props.done
            ? 'border-success/30 bg-success/10 text-success'
            : 'text-muted-foreground bg-background'
        )}
        aria-hidden='true'
      >
        {props.done ? <Check className='size-3.5' /> : props.index}
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-2 pt-0.5'>
        <div className='text-sm font-medium'>{props.title}</div>
        {props.children}
      </div>
    </li>
  )
}

/**
 * Connecting Claude Code or another tool: create a key in place, copy the
 * setup with the real key, then wait for the first call. `numbered` shows the
 * three steps for a new user; returning users get the same parts unnumbered.
 */
export function ToolSetup(props: { numbered?: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const keysQuery = useHomeKeys({ pollUntilUsed: props.numbered })
  const keys = keysQuery.data ?? []
  const key = preferredKey(keys)
  const connected = keysUsed(keys)
  const [tool, setTool] = useState<Tool>('claude-code')
  const [creating, setCreating] = useState(false)
  const [copying, setCopying] = useState(false)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })

  const createKey = async () => {
    if (creating) return
    setCreating(true)
    try {
      const result = await createApiKey(
        transformFormDataToPayload({
          ...API_KEY_FORM_DEFAULT_VALUES,
          name: 'default',
        })
      )
      if (!result.success) {
        handleServerError(result, t('Failed to create the API key'))
        return
      }
      toast.success(t('API key created'))
      await queryClient.invalidateQueries({ queryKey: HOME_KEYS_QUERY_KEY })
    } catch (error) {
      handleServerError(error, t('Failed to create the API key'))
    } finally {
      setCreating(false)
    }
  }

  const copySetup = async () => {
    if (!key || copying) return
    setCopying(true)
    try {
      const result = await fetchTokenKey(key.id)
      const realKey = result.success && result.data?.key ? result.data.key : ''
      if (!realKey) {
        handleServerError(result, t('Failed to copy to clipboard'))
        return
      }
      const copied = await copyToClipboard(
        claudeCodeSetup(endpoint(), `sk-${realKey}`)
      )
      if (copied) toast.success(t('Copied to clipboard'))
      else toast.error(t('Failed to copy to clipboard'))
    } catch (error) {
      handleServerError(error, t('Failed to copy to clipboard'))
    } finally {
      setCopying(false)
    }
  }

  const keyStep = key ? (
    <div className='bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm'>
      <span className='flex min-w-0 items-center gap-2'>
        <KeyRound className='text-muted-foreground size-4 shrink-0' />
        <span className='truncate font-medium'>{key.name}</span>
        <code className='text-muted-foreground truncate font-mono text-xs'>
          {maskKey(key.key)}
        </code>
      </span>
      <Button
        variant='link'
        size='sm'
        className='h-auto p-0'
        render={<Link to='/keys' />}
      >
        {t('Manage keys')}
      </Button>
    </div>
  ) : (
    <div className='flex flex-wrap items-center gap-3'>
      <Button size='sm' onClick={createKey} disabled={creating}>
        {creating ? (
          <Loader2 className='animate-spin' data-icon='inline-start' />
        ) : (
          <KeyRound data-icon='inline-start' />
        )}
        {t('Create a key')}
      </Button>
      <span className='text-muted-foreground text-xs'>
        {t('One click, no settings to fill in. You can rename it later.')}
      </span>
    </div>
  )

  const toolStep = (
    <div className='flex flex-col gap-2'>
      <div
        className='bg-muted/60 inline-flex w-fit rounded-lg p-0.5 text-sm'
        role='tablist'
        aria-label={t('Tool')}
      >
        {(
          [
            ['claude-code', 'Claude Code'],
            ['other', t('Other tools')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={tool === id}
            onClick={() => setTool(id)}
            className={cn(
              'focus-visible:ring-ring rounded-md px-3 py-1 outline-none focus-visible:ring-2',
              tool === id
                ? 'bg-background font-medium shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tool === 'claude-code' ? (
        <div className='flex flex-col gap-2'>
          <div className='bg-foreground/[0.04] relative rounded-lg border p-3 font-mono text-xs leading-6'>
            {claudeCodeSetup(endpoint(), maskKey(key?.key))
              .split('\n')
              .map((line) => (
                <div key={line} className='truncate'>
                  {line}
                </div>
              ))}
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <Button
              size='sm'
              variant='outline'
              onClick={copySetup}
              disabled={!key || copying}
            >
              {copying ? (
                <Loader2 className='animate-spin' data-icon='inline-start' />
              ) : (
                <Copy data-icon='inline-start' />
              )}
              {t('Copy with my key')}
            </Button>
            <span className='text-muted-foreground text-xs'>
              {key
                ? t('Paste into a terminal and press Enter.')
                : t('Create a key first; the copy fills it in.')}
            </span>
          </div>
          <a
            href={`${TOOL_GUIDE_URL}#claude-code`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs underline-offset-2 hover:underline'
          >
            <TerminalSquare className='size-3.5' />
            {t('Claude Code not installed yet, or on Windows? Open the guide')}
            <ExternalLink className='size-3' />
          </a>
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Each guide shows where to paste the address {{endpoint}} and your key.',
              { endpoint: endpoint() }
            )}
          </p>
          <div className='flex flex-wrap gap-1.5'>
            {TOOL_GUIDES.map((guide) => (
              <a
                key={guide.id}
                href={`${TOOL_GUIDE_URL}#${guide.id}`}
                target='_blank'
                rel='noopener noreferrer'
                className='bg-background hover:bg-muted inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors'
              >
                {guide.translate ? t(guide.label) : guide.label}
                <ExternalLink className='text-muted-foreground size-3' />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const connectStep = connected ? (
    <p className='text-success flex items-center gap-1.5 text-sm'>
      <Check className='size-4' />
      {t('Connected. Your first call has come through.')}
    </p>
  ) : (
    <p className='text-muted-foreground flex items-center gap-1.5 text-xs'>
      <Radio className='size-3.5' />
      {t(
        'Send one message from your tool. This turns green by itself once the call comes through.'
      )}
    </p>
  )

  if (!props.numbered) {
    return (
      <div className='flex flex-col gap-4'>
        {keyStep}
        {toolStep}
      </div>
    )
  }

  return (
    <ol className='flex flex-col gap-5'>
      <Step index={1} done={Boolean(key)} title={t('Get an API key')}>
        {keyStep}
      </Step>
      <Step index={2} done={connected} title={t('Copy the setup into your tool')}>
        {toolStep}
      </Step>
      <Step index={3} done={connected} title={t('Make the first call')}>
        {connectStep}
      </Step>
    </ol>
  )
}
