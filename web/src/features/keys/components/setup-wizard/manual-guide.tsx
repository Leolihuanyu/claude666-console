/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'

import type {
  ManualGuide,
  SetupContext,
  SetupField,
} from '../../lib/setup-clients'
import { maskKey, setupUrl } from '../../lib/setup-links'
import { MenuPathDiagram } from './menu-path-diagram'

interface ManualGuideViewProps {
  guide: ManualGuide
  ctx: SetupContext
}

interface FieldDisplay {
  label: string
  shown: string
  copied: string
}

/**
 * The value a field shows and the value it copies. Only the key differs: it
 * is masked on screen and copied in full.
 */
function resolveField(
  field: SetupField,
  ctx: SetupContext,
  translate: (key: string) => string
): FieldDisplay {
  const label = field.literal ? field.label : translate(field.label)
  const value = field.value
  switch (value.kind) {
    case 'url': {
      const url = setupUrl(ctx.baseUrl, value.url)
      return { label, shown: url, copied: url }
    }
    case 'key':
      return { label, shown: maskKey(ctx.apiKey), copied: ctx.apiKey }
    case 'model': {
      const model = value.family === 'gpt' ? ctx.gptModel : ctx.model
      return { label, shown: model, copied: model }
    }
    case 'text': {
      const text = value.translate ? translate(value.text) : value.text
      return { label, shown: text, copied: text }
    }
  }
}

/** Fields with copy buttons, numbered steps, prefilled snippets and notes of one client. */
export function ManualGuideView(props: ManualGuideViewProps) {
  const { t } = useTranslation()
  const maskedCtx = { ...props.ctx, apiKey: maskKey(props.ctx.apiKey) }
  const fields = (props.guide.fields ?? []).map((field) =>
    resolveField(field, props.ctx, t)
  )

  return (
    <div className='space-y-5'>
      {props.guide.menuPath && (
        <MenuPathDiagram path={props.guide.menuPath} fields={fields} />
      )}
      {fields.length > 0 && (
        <section className='space-y-2'>
          <h4 className='text-sm font-medium'>{t('Fill in these values')}</h4>
          <dl className='divide-y rounded-lg border'>
            {fields.map((field) => (
              <div
                key={field.label}
                className='flex items-center gap-2 px-3 py-2'
              >
                <div className='min-w-0 flex-1'>
                  <dt className='text-muted-foreground text-xs'>
                    {field.label}
                  </dt>
                  <dd className='font-mono text-sm break-all'>{field.shown}</dd>
                </div>
                <CopyButton
                  value={field.copied}
                  size='icon'
                  className='size-8'
                  iconClassName='size-4'
                  aria-label={t('Copy {{name}}', { name: field.label })}
                />
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className='space-y-2'>
        <h4 className='text-sm font-medium'>{t('Steps')}</h4>
        <ol className='text-muted-foreground list-decimal space-y-1.5 ps-5 text-sm'>
          {props.guide.steps.map((step) => (
            <li key={step}>{t(step)}</li>
          ))}
        </ol>
      </section>

      {(props.guide.snippets ?? []).map((snippet) => (
        <section key={snippet.title} className='space-y-1.5'>
          <div className='flex items-center justify-between gap-2'>
            <h4 className='min-w-0 truncate font-mono text-xs'>
              {snippet.translateTitle ? t(snippet.title) : snippet.title}
            </h4>
            <CopyButton
              value={snippet.render(props.ctx)}
              variant='outline'
              size='sm'
              aria-label={t('Copy {{name}}', { name: snippet.title })}
            >
              {t('Copy')}
            </CopyButton>
          </div>
          <pre className='bg-muted/50 max-h-72 overflow-auto rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap'>
            {snippet.render(maskedCtx)}
          </pre>
        </section>
      ))}

      {(props.guide.notes ?? []).length > 0 && (
        <section className='bg-muted/40 space-y-1.5 rounded-lg p-3'>
          <h4 className='flex items-center gap-1.5 text-sm font-medium'>
            <Info className='size-4' aria-hidden='true' />
            {t('Good to know')}
          </h4>
          <ul className='text-muted-foreground list-disc space-y-1 ps-5 text-sm'>
            {(props.guide.notes ?? []).map((note) => (
              <li key={note}>{t(note)}</li>
            ))}
          </ul>
        </section>
      )}

      {props.guide.screenshot && (
        <img
          src={props.guide.screenshot}
          alt={t('Screenshot')}
          className='w-full rounded-lg border'
          loading='lazy'
        />
      )}
    </div>
  )
}
