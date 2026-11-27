/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { useStatus } from '@/hooks/use-status'
import { getUserModels } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { SetupClient, SetupContext } from '../../lib/setup-clients'
import { pickSetupModel, tokenModels } from '../../lib/setup-links'
import type { ApiKey } from '../../types'
import { ClientGuide } from './client-guide'
import { ClientPicker } from './client-picker'

/** new-api's default quota units per USD, used when the status has none. */
const DEFAULT_QUOTA_PER_UNIT = 500000

interface SetupWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: ApiKey | null
  /** Full key, already fetched; it stays in memory only. */
  tokenKey: string
}

export function SetupWizardDialog(props: SetupWizardDialogProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { serverAddress } = useChatPresets()
  const [client, setClient] = useState<SetupClient | null>(null)
  const [chosenModel, setChosenModel] = useState('')

  useEffect(() => {
    if (!props.open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(null)
    setChosenModel('')
  }, [props.open])

  const { data: userModels } = useQuery({
    queryKey: ['user-models-ccswitch'],
    queryFn: async () => requireServerSuccess(await getUserModels()),
    enabled: props.open,
    staleTime: 5 * 60 * 1000,
  })

  const models = useMemo(() => {
    if (!props.token) return userModels?.data ?? []
    return tokenModels(props.token, userModels?.data ?? [])
  }, [props.token, userModels?.data])

  const modelOptions = useMemo(
    () => models.map((m) => ({ value: m, label: m })),
    [models]
  )

  const quotaPerUnit =
    status?.quota_per_unit ??
    status?.data?.quota_per_unit ??
    DEFAULT_QUOTA_PER_UNIT

  const model = chosenModel || pickSetupModel(models, client?.modelFamily)
  const gptModel =
    client?.modelFamily === 'gpt' && chosenModel
      ? chosenModel
      : pickSetupModel(models, 'gpt')

  const ctx: SetupContext = {
    baseUrl: serverAddress,
    apiKey: props.tokenKey,
    model,
    gptModel,
    models,
    quotaPerUnit,
  }

  const title = props.token
    ? t('Connect an app with "{{name}}"', { name: props.token.name })
    : t('Connect an app')

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      description={t(
        'Pick the app you use and follow the steps. Your key is filled in for you.'
      )}
      contentClassName='sm:max-w-3xl'
      contentHeight='min(70vh, 720px)'
      bodyClassName='space-y-4'
    >
      {client === null ? (
        <ClientPicker onSelect={setClient} />
      ) : (
        <div className='space-y-4'>
          <Button
            variant='ghost'
            size='sm'
            className='-ms-2'
            onClick={() => setClient(null)}
          >
            <ArrowLeft aria-hidden='true' />
            {t('All apps')}
          </Button>

          {client.tier !== 'unsupported' && (
            <div className='space-y-1.5'>
              <Label htmlFor='setup-wizard-model'>{t('Model')}</Label>
              <Combobox
                id='setup-wizard-model'
                aria-label={t('Model')}
                options={modelOptions}
                value={model}
                onValueChange={(value) => setChosenModel(value ?? '')}
                placeholder={t('Select or enter model name')}
                emptyText={t('No models found')}
                allowCustomValue
              />
            </div>
          )}

          <ClientGuide
            client={client}
            ctx={ctx}
            onSelectClient={(next) => {
              setClient(next)
              setChosenModel('')
            }}
          />
        </div>
      )}
    </Dialog>
  )
}
