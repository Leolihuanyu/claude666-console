/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { ChevronRight, CornerDownRight } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export interface MenuPathField {
  label: string
  /** Value as shown on screen; the key arrives already masked. */
  shown: string
}

interface MenuPathDiagramProps {
  /** Menu labels as the client shows them, outermost first. */
  path: string[]
  fields: MenuPathField[]
}

/**
 * Drawn stand-in for a screenshot: the menu path as boxes joined by chevrons,
 * the last box highlighted, and the values to fill in below it. We have no
 * screenshots of third-party apps and do not fake them.
 */
export function MenuPathDiagram(props: MenuPathDiagramProps) {
  const { t } = useTranslation()
  const captionId = useId()
  if (props.path.length === 0) return null
  const last = props.path.length - 1

  return (
    <figure
      className='bg-muted/30 space-y-3 rounded-lg border p-3'
      data-slot='menu-path-diagram'
      aria-labelledby={captionId}
    >
      <figcaption id={captionId} className='text-sm font-medium'>
        {t('Where to find it')}
      </figcaption>
      <ol className='flex flex-wrap items-center gap-x-1 gap-y-2'>
        {props.path.map((step, index) => (
          <li key={step} className='flex items-center gap-1'>
            {index > 0 && (
              <ChevronRight
                className='text-muted-foreground size-4 shrink-0'
                aria-hidden='true'
              />
            )}
            <span
              className={cn(
                'rounded-md border px-2.5 py-1 text-sm break-all',
                index === last
                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                  : 'bg-background'
              )}
              aria-current={index === last ? 'step' : undefined}
            >
              {step}
            </span>
          </li>
        ))}
      </ol>
      {props.fields.length > 0 && (
        <div className='flex gap-2'>
          <CornerDownRight
            className='text-primary mt-1 size-4 shrink-0'
            aria-hidden='true'
          />
          <dl className='border-primary/40 bg-background min-w-0 flex-1 space-y-1.5 rounded-md border border-dashed p-2'>
            {props.fields.map((field) => (
              <div
                key={field.label}
                className='flex flex-wrap items-baseline gap-x-2'
              >
                <dt className='text-muted-foreground text-xs'>{field.label}</dt>
                <dd className='min-w-0 font-mono text-xs break-all'>
                  {field.shown}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </figure>
  )
}
