/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import {
  ChevronDown,
  Download,
  ExternalLink,
  FlaskConical,
  Terminal,
  TriangleAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  SETUP_CLIENTS,
  type SetupClient,
  type SetupContext,
  type SetupImportAction,
  type SetupTier,
} from '../../lib/setup-clients'
import { maskKey, SETUP_SCRIPT } from '../../lib/setup-links'
import { SetupClientIcon } from './client-picker'
import { ManualGuideView } from './manual-guide'

const TIER_LABELS: Record<SetupTier, string> = {
  script: 'One-line script',
  import: 'One-click import',
  manual: 'Fill in by hand',
  unsupported: 'Not supported',
}

interface ClientGuideProps {
  client: SetupClient
  ctx: SetupContext
  onSelectClient: (client: SetupClient) => void
}

/** How to connect the chosen client: script, import buttons, manual card or alternatives. */
export function ClientGuide(props: ClientGuideProps) {
  const { t } = useTranslation()
  const client = props.client
  const name = client.translateName ? t(client.name) : client.name
  let tierLabel = TIER_LABELS[client.tier]
  if (client.unverified) tierLabel = 'Not verified'

  return (
    <div className='space-y-5'>
      <div className='flex items-start gap-3'>
        <SetupClientIcon client={client} size={36} />
        <div className='min-w-0 flex-1 space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-base font-medium'>{name}</h3>
            <Badge
              variant={
                client.tier === 'unsupported' ? 'destructive' : 'secondary'
              }
            >
              {t(tierLabel)}
            </Badge>
            {client.experimental && (
              <Badge variant='warning'>
                <FlaskConical aria-hidden='true' />
                {t('Experimental')}
              </Badge>
            )}
          </div>
          <p className='text-muted-foreground text-sm'>{t(client.summary)}</p>
        </div>
      </div>

      {client.tier === 'script' && <ScriptPanel ctx={props.ctx} />}
      {client.tier === 'import' && (
        <ImportPanel client={client} ctx={props.ctx} />
      )}
      {client.tier === 'unsupported' && (
        <UnsupportedPanel
          client={client}
          onSelectClient={props.onSelectClient}
        />
      )}

      {client.manual && client.tier === 'manual' && (
        <ManualGuideView guide={client.manual} ctx={props.ctx} />
      )}
      {client.manual && client.tier !== 'manual' && (
        <Collapsible className='rounded-lg border'>
          <CollapsibleTrigger className='hover:bg-muted/40 group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-medium'>
            {t('Set it up by hand instead')}
            <ChevronDown
              className='size-4 transition-transform group-data-[panel-open]:rotate-180'
              aria-hidden='true'
            />
          </CollapsibleTrigger>
          <CollapsibleContent className='border-t px-3 py-3'>
            <ManualGuideView guide={client.manual} ctx={props.ctx} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function ScriptPanel(props: { ctx: SetupContext }) {
  const { t } = useTranslation()
  const isWindows =
    typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

  return (
    <div className='space-y-4'>
      <Tabs defaultValue={isWindows ? 'windows' : 'mac'}>
        <TabsList>
          <TabsTrigger value='mac'>macOS</TabsTrigger>
          <TabsTrigger value='windows'>{t('Windows (beta)')}</TabsTrigger>
        </TabsList>
        <TabsContent value='mac' className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            {t('Open Terminal, paste this command and press Enter:')}
          </p>
          <CommandLine command={SETUP_SCRIPT.mac} />
          <Button
            variant='link'
            size='sm'
            className='h-auto px-0'
            render={<a href={SETUP_SCRIPT.macDownload} download />}
          >
            <Download aria-hidden='true' />
            {t('Or download the double-click version')}
          </Button>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Unzip the download and double-click leoapi-setup.command. If macOS says it cannot be opened, right-click it and choose Open.'
            )}{' '}
            <a
              href={SETUP_SCRIPT.guide}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary underline-offset-4 hover:underline'
            >
              {t('Setup script guide')}
            </a>
          </p>
        </TabsContent>
        <TabsContent value='windows' className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            {t('Open PowerShell, paste this command and press Enter:')}
          </p>
          <CommandLine command={SETUP_SCRIPT.windows} />
          {/* The Windows script has not been run on a real machine yet. */}
          <p className='text-muted-foreground text-xs'>
            {t(
              'The Windows version is still in testing. If it fails, expand "{{manual}}" below, or send us a screenshot of the error.',
              { manual: t('Set it up by hand instead') }
            )}
          </p>
          <Button
            variant='link'
            size='sm'
            className='h-auto px-0'
            render={<a href={SETUP_SCRIPT.windowsDownload} download />}
          >
            <Download aria-hidden='true' />
            {t('Or download the double-click version')}
          </Button>
        </TabsContent>
      </Tabs>

      <div className='bg-muted/40 space-y-2 rounded-lg p-3'>
        <p className='text-sm font-medium'>
          {t('When the script asks for your key, paste this one:')}
        </p>
        <div className='flex items-center gap-2'>
          <code className='min-w-0 flex-1 truncate font-mono text-sm'>
            {maskKey(props.ctx.apiKey)}
          </code>
          <CopyButton
            value={props.ctx.apiKey}
            variant='outline'
            size='sm'
            aria-label={t('Copy key')}
          >
            {t('Copy key')}
          </CopyButton>
        </div>
        <p className='text-muted-foreground text-xs'>
          {t(
            'The command contains no key; the script asks for it while it runs.'
          )}
        </p>
      </div>

      <Button
        variant='link'
        size='sm'
        className='h-auto px-0'
        render={
          <a
            href={SETUP_SCRIPT.guide}
            target='_blank'
            rel='noopener noreferrer'
          />
        }
      >
        <ExternalLink aria-hidden='true' />
        {t('What the script does')}
      </Button>
    </div>
  )
}

function CommandLine(props: { command: string }) {
  const { t } = useTranslation()
  return (
    <div className='bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2'>
      <Terminal
        className='text-muted-foreground size-4 shrink-0'
        aria-hidden='true'
      />
      <code className='min-w-0 flex-1 font-mono text-sm break-all'>
        {props.command}
      </code>
      <CopyButton
        value={props.command}
        variant='outline'
        size='sm'
        aria-label={t('Copy command')}
      >
        {t('Copy')}
      </CopyButton>
    </div>
  )
}

/**
 * The link holds the key, so it is built on click and never rendered into an
 * href (a hovered link shows its URL in the status bar).
 */
function openImportLink(action: SetupImportAction, ctx: SetupContext) {
  const url = action.render(ctx)
  if (action.target === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.assign(url)
}

function ImportPanel(props: { client: SetupClient; ctx: SetupContext }) {
  const { t } = useTranslation()
  const client = props.client

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap'>
        {(client.imports ?? []).map((action) => (
          <Button
            key={action.id}
            size='lg'
            onClick={() => openImportLink(action, props.ctx)}
          >
            {action.target === 'web' && <ExternalLink aria-hidden='true' />}
            {t(action.label)}
          </Button>
        ))}
      </div>
      <ol className='text-muted-foreground list-decimal space-y-1.5 ps-5 text-sm'>
        {(client.importSteps ?? []).map((step) => (
          <li key={step}>{t(step)}</li>
        ))}
      </ol>
      {client.downloadUrl && (
        <p className='text-muted-foreground text-xs'>
          {t(
            'Nothing happens when you click? The app is probably not installed yet.'
          )}{' '}
          <a
            href={client.downloadUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary underline-offset-4 hover:underline'
          >
            {t('Download it')}
          </a>
        </p>
      )}
      <p className='text-muted-foreground text-xs'>
        {t(
          'Open this page on the computer where the app is installed; links do not work across devices.'
        )}
      </p>
    </div>
  )
}

function UnsupportedPanel(props: {
  client: SetupClient
  onSelectClient: (client: SetupClient) => void
}) {
  const { t } = useTranslation()
  const alternatives = props.client.alternatives
  const options = SETUP_CLIENTS.filter((c) =>
    alternatives?.clientIds?.includes(c.id)
  )

  return (
    <div className='space-y-3'>
      <Alert variant={props.client.unverified ? 'default' : 'destructive'}>
        <TriangleAlert aria-hidden='true' />
        <AlertTitle>
          {props.client.unverified
            ? t('Not verified yet')
            : t('This app cannot connect to a custom address')}
        </AlertTitle>
        {alternatives && (
          <AlertDescription>{t(alternatives.text)}</AlertDescription>
        )}
      </Alert>
      {options.length > 0 && (
        <div className='space-y-2'>
          <p className='text-sm font-medium'>{t('Use one of these instead')}</p>
          <div className='flex flex-wrap gap-2'>
            {options.map((option) => (
              <Button
                key={option.id}
                variant='outline'
                onClick={() => props.onSelectClient(option)}
              >
                <SetupClientIcon client={option} size={16} />
                {option.translateName ? t(option.name) : option.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
