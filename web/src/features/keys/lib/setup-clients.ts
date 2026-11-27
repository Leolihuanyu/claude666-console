/*
Claude服务站 changes to new-api, distributed under the same
GNU Affero General Public License v3.0 (see LICENSE and NOTICE).
*/

/**
 * Client list of the setup wizard. Adding a client means adding an entry here;
 * the wizard renders every tier from these fields.
 *
 * Source: leoapi-ops client setup table (2026-11-27, corrected by the tests in
 * docs/clients/test-results-2026-11-27.md) and docs/clients/*.md. Address
 * spellings differ per client on purpose; check that table before changing one.
 *
 * Every user-facing string is an English i18n key; product names, file paths
 * and literal config values are not translated.
 */
import {
  buildCcSwitchUrl,
  buildChatboxUrl,
  buildCherryStudioUrl,
  buildNextChatUrl,
  type ModelFamily,
  SETUP_PROVIDER,
  type SetupUrlKind,
  setupUrl,
} from './setup-links'

export type SetupTier = 'script' | 'import' | 'manual' | 'unsupported'

export type SetupCategory =
  | 'coding'
  | 'ide'
  | 'chat'
  | 'office'
  | 'sdk'
  | 'workflow'

export const SETUP_CATEGORIES: { id: SetupCategory; label: string }[] = [
  { id: 'coding', label: 'Coding tools' },
  { id: 'ide', label: 'IDEs' },
  { id: 'chat', label: 'Chat apps' },
  { id: 'office', label: 'Office' },
  { id: 'sdk', label: 'Developer SDKs' },
  { id: 'workflow', label: 'Workflow platforms' },
]

/** Values a snippet or import link is built from. `apiKey` is masked when rendered for display. */
export interface SetupContext {
  baseUrl: string
  apiKey: string
  /** Model chosen in the wizard. */
  model: string
  /** GPT model for clients that work best with one (Codex, Cursor). */
  gptModel: string
  models: string[]
  quotaPerUnit: number
}

export type SetupFieldValue =
  | { kind: 'url'; url: SetupUrlKind }
  | { kind: 'key' }
  | { kind: 'model'; family?: ModelFamily }
  /** Literal value; `translate` when it is UI text of the client rather than a config value. */
  | { kind: 'text'; text: string; translate?: boolean }

export interface SetupField {
  /** Translated unless `literal` (an environment variable or config key). */
  label: string
  literal?: boolean
  value: SetupFieldValue
  hint?: string
}

export interface SetupSnippet {
  /** File path or short label shown above the snippet; translated when `translateTitle`. */
  title: string
  translateTitle?: boolean
  language:
    | 'json'
    | 'toml'
    | 'yaml'
    | 'bash'
    | 'powershell'
    | 'python'
    | 'typescript'
    | 'text'
  render: (ctx: SetupContext) => string
}

export interface ManualGuide {
  fields?: SetupField[]
  steps: string[]
  snippets?: SetupSnippet[]
  notes?: string[]
  /**
   * Menu path to the settings screen, as labels the client itself shows (not
   * translated). Only paths the leoapi-ops client docs record from official
   * docs or source; leave it out when a path is only guessed.
   */
  menuPath?: string[]
  /** Screenshot path under `public/`; nothing is shown without one. */
  screenshot?: string
}

export interface SetupImportAction {
  id: string
  label: string
  /** `app` opens a custom protocol, `web` a website in a new tab. */
  target: 'app' | 'web'
  render: (ctx: SetupContext) => string
}

export interface SetupClient {
  id: string
  /** Product name; translated only when `translateName`. */
  name: string
  translateName?: boolean
  category: SetupCategory
  tier: SetupTier
  /** @lobehub/icons name; the first letter is shown when absent. */
  icon?: string
  keywords?: string[]
  summary: string
  experimental?: boolean
  /** Unsupported entries that are unproven rather than ruled out. */
  unverified?: boolean
  /** Model family preferred in this client's snippets. */
  modelFamily?: ModelFamily
  imports?: SetupImportAction[]
  importSteps?: string[]
  /** Manual steps: the whole guide for `manual`, the collapsed fallback for `script` and `import`. */
  manual?: ManualGuide
  alternatives?: { text: string; clientIds?: string[] }
  downloadUrl?: string
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

const KEY_FIELD: SetupField = { label: 'API key', value: { kind: 'key' } }
const MODEL_FIELD: SetupField = { label: 'Model', value: { kind: 'model' } }

export const SETUP_CLIENTS: SetupClient[] = [
  // ---------------------------------------------------------------- coding
  {
    id: 'claude-code',
    name: 'Claude Code',
    category: 'coding',
    tier: 'script',
    icon: 'ClaudeCode',
    keywords: ['claude', 'anthropic', 'vscode', 'jetbrains'],
    summary: 'Command line and VS Code extension',
    manual: {
      fields: [
        {
          label: 'ANTHROPIC_BASE_URL',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        {
          label: 'ANTHROPIC_AUTH_TOKEN',
          literal: true,
          value: { kind: 'key' },
        },
      ],
      steps: [
        'Write the snippet below into ~/.claude/settings.json (merge it if the file already has content).',
        'For the VS Code extension, also add the second snippet to your VS Code user settings (settings.json).',
        'Restart Claude Code or VS Code.',
      ],
      snippets: [
        {
          title: '~/.claude/settings.json',
          language: 'json',
          render: (ctx) =>
            json({
              env: {
                ANTHROPIC_BASE_URL: setupUrl(ctx.baseUrl, 'root'),
                ANTHROPIC_AUTH_TOKEN: ctx.apiKey,
              },
            }),
        },
        {
          title: 'VS Code settings.json',
          language: 'json',
          render: (ctx) =>
            json({
              'claudeCode.environmentVariables': [
                {
                  name: 'ANTHROPIC_BASE_URL',
                  value: setupUrl(ctx.baseUrl, 'root'),
                },
                { name: 'ANTHROPIC_AUTH_TOKEN', value: ctx.apiKey },
              ],
              'claudeCode.disableLoginPrompt': true,
            }),
        },
      ],
      notes: [
        'The address has no /v1. With /v1 Claude Code reports a misleading "issue with the selected model" error.',
        'Use ANTHROPIC_AUTH_TOKEN, not ANTHROPIC_API_KEY. ANTHROPIC_API_KEY shows a confirmation whose default answer ignores the key.',
      ],
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    category: 'coding',
    tier: 'script',
    icon: 'Codex',
    keywords: ['openai', 'gpt'],
    summary: 'Command line, IDE extension and desktop app',
    modelFamily: 'gpt',
    manual: {
      fields: [
        { label: 'base_url', literal: true, value: { kind: 'url', url: 'v1' } },
        {
          label: 'wire_api',
          literal: true,
          value: { kind: 'text', text: 'responses' },
        },
        {
          label: 'experimental_bearer_token',
          literal: true,
          value: { kind: 'key' },
        },
        { label: 'Model', value: { kind: 'model', family: 'gpt' } },
      ],
      steps: [
        'Append the provider table to ~/.codex/config.toml.',
        'Save the profile as ~/.codex/leoapi.config.toml.',
        'Start Codex with: codex --profile leoapi',
      ],
      snippets: [
        {
          title: '~/.codex/config.toml',
          language: 'toml',
          render: (ctx) =>
            [
              `[model_providers.${SETUP_PROVIDER.id}]`,
              `name = "${SETUP_PROVIDER.name}"`,
              `base_url = "${setupUrl(ctx.baseUrl, 'v1')}"`,
              `experimental_bearer_token = "${ctx.apiKey}"`,
              'wire_api = "responses"',
            ].join('\n'),
        },
        {
          title: '~/.codex/leoapi.config.toml',
          language: 'toml',
          render: (ctx) =>
            [
              `model_provider = "${SETUP_PROVIDER.id}"`,
              `model = "${ctx.gptModel}"`,
            ].join('\n'),
        },
      ],
      notes: [
        'The address must end with /v1. Only wire_api = "responses" works; "chat" was removed from Codex.',
        'The key is written into config.toml because the desktop app opened from the Dock does not read variables from ~/.zshrc.',
      ],
    },
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    category: 'coding',
    tier: 'script',
    icon: 'GeminiCLI',
    keywords: ['gemini', 'google'],
    summary: 'Google command line agent',
    manual: {
      fields: [
        {
          label: 'GOOGLE_GEMINI_BASE_URL',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        { label: 'GEMINI_API_KEY', literal: true, value: { kind: 'key' } },
        MODEL_FIELD,
      ],
      steps: [
        'Write the two files below.',
        'Run gemini in your project folder and choose to trust the folder.',
      ],
      snippets: [
        {
          title: '~/.gemini/.env',
          language: 'bash',
          render: (ctx) =>
            [
              `GOOGLE_GEMINI_BASE_URL=${setupUrl(ctx.baseUrl, 'root')}`,
              `GEMINI_API_KEY=${ctx.apiKey}`,
            ].join('\n'),
        },
        {
          title: '~/.gemini/settings.json',
          language: 'json',
          render: (ctx) =>
            json({
              security: { auth: { selectedType: 'gemini-api-key' } },
              model: { name: ctx.model },
            }),
        },
      ],
      notes: [
        'A model name is required: the default Gemini CLI model is not available here and returns 503.',
        'Gemini CLI loads .env only in trusted folders.',
      ],
    },
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    category: 'coding',
    tier: 'script',
    icon: 'OpenCode',
    summary: 'Open source terminal agent',
    manual: {
      fields: [
        { label: 'baseURL', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Merge the snippet into ~/.config/opencode/opencode.json, then restart OpenCode and pick the model with /models.',
      ],
      snippets: [
        {
          title: '~/.config/opencode/opencode.json',
          language: 'json',
          render: (ctx) =>
            json({
              $schema: 'https://opencode.ai/config.json',
              provider: {
                [SETUP_PROVIDER.id]: {
                  npm: '@ai-sdk/openai-compatible',
                  name: SETUP_PROVIDER.name,
                  options: {
                    baseURL: setupUrl(ctx.baseUrl, 'v1'),
                    apiKey: ctx.apiKey,
                  },
                  models: { [ctx.model]: {} },
                },
              },
            }),
        },
      ],
      notes: [
        'The address must end with /v1; without it OpenCode hangs until it times out.',
      ],
    },
  },
  {
    id: 'qwen-code',
    name: 'Qwen Code',
    category: 'coding',
    tier: 'script',
    icon: 'Qwen',
    keywords: ['qwen', 'tongyi'],
    summary: 'Qwen command line agent',
    manual: {
      fields: [
        { label: 'baseUrl', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Merge the snippet into ~/.qwen/settings.json, then restart Qwen Code.',
      ],
      snippets: [
        {
          title: '~/.qwen/settings.json',
          language: 'json',
          render: (ctx) =>
            json({
              modelProviders: {
                openai: [
                  {
                    id: ctx.model,
                    name: `${ctx.model} (${SETUP_PROVIDER.name})`,
                    baseUrl: setupUrl(ctx.baseUrl, 'v1'),
                    envKey: 'LEOAPI_API_KEY',
                  },
                ],
              },
              env: { LEOAPI_API_KEY: ctx.apiKey },
              security: { auth: { selectedType: 'openai' } },
              model: { name: ctx.model },
            }),
        },
      ],
      notes: [
        'With the OpenAI protocol the address ends with /v1; with the Anthropic protocol it has no /v1.',
      ],
    },
  },
  {
    id: 'cc-switch',
    name: 'CC Switch',
    category: 'coding',
    tier: 'import',
    keywords: ['ccswitch', 'switch'],
    summary: 'Switches providers for Claude Code, Codex and Gemini CLI',
    downloadUrl: 'https://github.com/farion1231/cc-switch/releases',
    imports: [
      {
        id: 'claude',
        label: 'Import for Claude Code',
        target: 'app',
        render: (ctx) =>
          buildCcSwitchUrl({
            app: 'claude',
            name: SETUP_PROVIDER.name,
            baseUrl: ctx.baseUrl,
            apiKey: ctx.apiKey,
            quotaPerUnit: ctx.quotaPerUnit,
          }),
      },
      {
        id: 'codex',
        label: 'Import for Codex',
        target: 'app',
        render: (ctx) =>
          buildCcSwitchUrl({
            app: 'codex',
            name: SETUP_PROVIDER.name,
            baseUrl: ctx.baseUrl,
            apiKey: ctx.apiKey,
            models: { model: ctx.gptModel },
            quotaPerUnit: ctx.quotaPerUnit,
          }),
      },
      {
        id: 'gemini',
        label: 'Import for Gemini CLI',
        target: 'app',
        render: (ctx) =>
          buildCcSwitchUrl({
            app: 'gemini',
            name: SETUP_PROVIDER.name,
            baseUrl: ctx.baseUrl,
            apiKey: ctx.apiKey,
            models: { model: ctx.model },
            quotaPerUnit: ctx.quotaPerUnit,
          }),
      },
    ],
    importSteps: [
      'Install CC Switch and open it once.',
      'Click the button for the tool you use, allow the browser to open CC Switch, check the details and click Import.',
      'Switch to the imported provider in CC Switch. The card shows your balance.',
    ],
    manual: {
      fields: [
        {
          label: 'Claude Code / Gemini address',
          value: { kind: 'url', url: 'root' },
        },
        { label: 'Codex address', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
      ],
      steps: [
        'In CC Switch, add a custom provider and fill in the fields below.',
      ],
      notes: [
        'Clicking the same button twice imports two copies.',
        'Claude Code keeps its own model list; to pin models, use CC Switch in the key menu.',
      ],
    },
  },
  {
    id: 'aider',
    name: 'Aider',
    category: 'coding',
    tier: 'manual',
    summary: 'Pair programming in the terminal',
    manual: {
      fields: [
        {
          label: 'openai-api-base',
          literal: true,
          value: { kind: 'url', url: 'v1' },
        },
        { label: 'OPENAI_API_KEY', literal: true, value: { kind: 'key' } },
        MODEL_FIELD,
      ],
      steps: [
        'Save the snippet as ~/.aider.conf.yml.',
        'Set the key in the OPENAI_API_KEY environment variable and run aider.',
      ],
      snippets: [
        {
          title: '~/.aider.conf.yml',
          language: 'yaml',
          render: (ctx) =>
            [
              `openai-api-base: ${setupUrl(ctx.baseUrl, 'v1')}`,
              `model: openai/${ctx.model}`,
            ].join('\n'),
        },
        {
          title: 'Mac / Linux',
          language: 'bash',
          render: (ctx) => `export OPENAI_API_KEY=${ctx.apiKey}`,
        },
      ],
      notes: [
        'Keep the openai/ prefix. With the anthropic/ prefix Aider sends temperature 0, which the 5.5 Claude models reject.',
      ],
    },
  },
  {
    id: 'crush',
    name: 'Crush',
    category: 'coding',
    tier: 'manual',
    summary: 'Charm terminal agent',
    manual: {
      fields: [
        { label: 'messages base URL', value: { kind: 'url', url: 'root' } },
        { label: 'completions base URL', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
      ],
      steps: [
        'Add the lines below to ~/.config/crush/crushrc and restart Crush.',
      ],
      snippets: [
        {
          title: '~/.config/crush/crushrc',
          language: 'bash',
          render: (ctx) =>
            [
              `provider add leoapi-claude --type messages --base-url "${setupUrl(ctx.baseUrl, 'root')}" --api-key "${ctx.apiKey}" --extra-header anthropic-version 2023-06-01`,
              `model add leoapi-claude/${ctx.model} --name "${ctx.model}" --context-window 200000 --default-max-tokens 32000`,
            ].join('\n'),
        },
      ],
      notes: [
        'The messages type takes the address without /v1; the completions and responses types take /v1.',
      ],
    },
  },
  {
    id: 'kimi-code',
    name: 'Kimi Code',
    category: 'coding',
    tier: 'manual',
    icon: 'Kimi',
    keywords: ['kimi', 'moonshot'],
    summary: 'Moonshot command line agent (npm @moonshot-ai/kimi-code)',
    manual: {
      fields: [
        {
          label: 'base_url',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Save the snippet as ~/.kimi-code/config.toml and restart Kimi Code.',
      ],
      snippets: [
        {
          title: '~/.kimi-code/config.toml',
          language: 'toml',
          render: (ctx) =>
            [
              'default_model = "leo"',
              '',
              `[providers.${SETUP_PROVIDER.id}]`,
              'type = "anthropic"',
              `base_url = "${setupUrl(ctx.baseUrl, 'root')}"`,
              `api_key = "${ctx.apiKey}"`,
              '',
              '[models.leo]',
              `provider = "${SETUP_PROVIDER.id}"`,
              `model = "${ctx.model}"`,
              'max_context_size = 200000',
            ].join('\n'),
        },
      ],
      notes: [
        'The old kimi-cli from PyPI is no longer maintained; install the npm package @moonshot-ai/kimi-code.',
      ],
    },
  },

  // ------------------------------------------------------------------- ide
  {
    id: 'cline',
    name: 'Cline',
    category: 'ide',
    tier: 'script',
    icon: 'Cline',
    keywords: ['vscode'],
    summary: 'VS Code extension',
    manual: {
      // clients-ide.md §7, official
      menuPath: ['Cline', '⚙️', 'API Provider', 'Anthropic'],
      fields: [
        { label: 'API Provider', value: { kind: 'text', text: 'Anthropic' } },
        { label: 'Custom base URL', value: { kind: 'url', url: 'root' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Open Cline in VS Code and click the settings (gear) icon.',
        'Set API Provider to Anthropic and paste the key.',
        'Tick "Use custom base URL" and paste the address.',
        'Pick or type the model, then click Done.',
      ],
      notes: [
        'The VS Code extension takes the address without /v1; Cline Desktop and Cline CLI need /v1.',
      ],
    },
  },
  {
    id: 'continue',
    name: 'Continue',
    category: 'ide',
    tier: 'script',
    keywords: ['vscode', 'jetbrains'],
    summary: 'VS Code and JetBrains extension',
    manual: {
      fields: [
        { label: 'apiBase', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Merge the snippet into ~/.continue/config.yaml and reload the editor.',
      ],
      snippets: [
        {
          title: '~/.continue/config.yaml',
          language: 'yaml',
          render: (ctx) =>
            [
              `name: ${SETUP_PROVIDER.name}`,
              'version: 1.0.0',
              'schema: v1',
              'models:',
              `  - name: ${ctx.model} (${SETUP_PROVIDER.name})`,
              '    provider: anthropic',
              `    model: ${ctx.model}`,
              `    apiBase: ${setupUrl(ctx.baseUrl, 'v1')}`,
              `    apiKey: ${ctx.apiKey}`,
              '    roles: [chat, edit, apply]',
              '    capabilities: [tool_use]',
            ].join('\n'),
        },
      ],
      notes: [
        'The address must end with /v1 even with the Anthropic provider. Without it Continue fails silently.',
      ],
    },
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    category: 'ide',
    tier: 'script',
    icon: 'CodeBuddy',
    keywords: ['tencent'],
    summary: 'Tencent coding assistant',
    manual: {
      fields: [
        { label: 'url', literal: true, value: { kind: 'url', url: 'chat' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Merge the snippet into ~/.codebuddy/models.json and restart CodeBuddy.',
      ],
      snippets: [
        {
          title: '~/.codebuddy/models.json',
          language: 'json',
          render: (ctx) =>
            json({
              models: [
                {
                  id: ctx.model,
                  name: `${ctx.model} (${SETUP_PROVIDER.name})`,
                  vendor: SETUP_PROVIDER.name,
                  url: setupUrl(ctx.baseUrl, 'chat'),
                  apiKey: ctx.apiKey,
                  supportsToolCall: true,
                  supportsImages: true,
                },
              ],
            }),
        },
      ],
      notes: [
        'The address is the full endpoint ending with /chat/completions.',
        'Do not copy the example JSON from the CodeBuddy docs: it uses full-width quotes and colons.',
      ],
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'ide',
    tier: 'manual',
    icon: 'Cursor',
    summary: 'AI code editor',
    experimental: true,
    modelFamily: 'gpt',
    manual: {
      // clients-ide.md §1 (Cursor Settings and Models official; Override OpenAI Base URL from community posts) and the setup table
      menuPath: ['Cursor Settings', 'Models', 'Override OpenAI Base URL'],
      fields: [
        { label: 'OpenAI API Key', value: { kind: 'key' } },
        {
          label: 'Override OpenAI Base URL',
          value: { kind: 'url', url: 'v1' },
        },
        { label: 'Model', value: { kind: 'model', family: 'gpt' } },
      ],
      steps: [
        'Open Cursor Settings (⌘⇧J or Ctrl+Shift+J) and go to Models.',
        'Under API Keys, paste the key into OpenAI API Key.',
        'Turn on Override OpenAI Base URL, paste the address and click Verify.',
        'Click "+ Add Custom Model", type the model name and turn it on.',
      ],
      notes: [
        'Experimental: whether Cursor sends Claude model names to our address is not tested yet. Use a GPT model for now.',
        "While the override is on, Cursor's own models such as Composer stop working; turn it off to use them again.",
        "Tab completion always uses Cursor's own model.",
      ],
    },
  },
  {
    id: 'trae',
    name: 'Trae',
    category: 'ide',
    tier: 'manual',
    icon: 'Trae',
    keywords: ['trae.cn', 'trae.ai', 'bytedance'],
    summary: 'China and international editions',
    manual: {
      // clients-ide.md §2, official
      menuPath: ['设置', '模型', '添加模型', '自定义模型'],
      fields: [
        {
          label: 'API format',
          value: { kind: 'text', text: 'OpenAI Chat Completions' },
        },
        {
          label: 'Request URL (Full URL on)',
          value: { kind: 'url', url: 'chat' },
        },
        { label: 'Model ID', value: { kind: 'model' } },
        KEY_FIELD,
        {
          label: 'Request URL for Anthropic Messages (Claude)',
          value: { kind: 'url', url: 'messages' },
        },
      ],
      steps: [
        'Top up your balance first: Trae sends a real request when you add the model.',
        'Open Settings > Models and click Add Model, then choose Custom model.',
        'Choose the API format, turn on Full URL and paste the request URL.',
        'Fill in the model ID and the key, then click Add Model.',
      ],
      notes: [
        'With a balance of 0 the model cannot be added.',
        'For Claude models you may also choose the Anthropic Messages format with the Anthropic request URL above.',
        'The personal edition cannot pick the Claude preset under Advanced; leave it at Default.',
        'The China and international editions have the same screens.',
      ],
    },
  },
  {
    id: 'jetbrains-ai',
    name: 'JetBrains AI Assistant',
    category: 'ide',
    tier: 'manual',
    keywords: ['jetbrains', 'idea', 'pycharm', 'webstorm', 'goland'],
    summary: 'IntelliJ IDEA, PyCharm and other JetBrains IDEs',
    manual: {
      // clients-ide.md §6, official
      menuPath: ['Settings', 'Tools', 'AI Assistant', 'Providers & API keys'],
      fields: [
        {
          label: 'Provider',
          value: { kind: 'text', text: 'OpenAI-compatible' },
        },
        { label: 'Base URL', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Open Settings > Tools > AI Assistant > Providers & API keys.',
        'Choose OpenAI-compatible and fill in Base URL and the key.',
        'Turn on Tool calling, then click Test Connection.',
        'Pick the model in the AI Chat window.',
      ],
      notes: ['Without Tool calling, agents and MCP tools do not work.'],
    },
  },
  {
    id: 'qoder',
    name: 'Qoder',
    category: 'ide',
    tier: 'manual',
    icon: 'Qoder',
    summary: 'International edition',
    manual: {
      // clients-ide.md §13, official
      menuPath: ['Settings', 'Models', 'Add model', 'Custom'],
      fields: [
        {
          label: 'Provider',
          value: { kind: 'text', text: 'OpenAI Compatible' },
        },
        { label: 'Base URL', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        { label: 'Model ID', value: { kind: 'model' } },
      ],
      steps: [
        'Open Settings > Models > Add model and choose Custom.',
        'Choose OpenAI Compatible with Chat Completions API.',
        'Fill in Base URL, the key and the model ID, then save.',
      ],
      notes: [
        'A model ID cannot be edited once added; only its display name can.',
      ],
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    category: 'ide',
    tier: 'unsupported',
    icon: 'Windsurf',
    keywords: ['devin', 'codeium'],
    summary: 'Now Devin Desktop',
    alternatives: {
      text: 'Windsurf has no field for a custom address. Install the Cline extension in Windsurf and set it up as for VS Code.',
      clientIds: ['cline'],
    },
  },
  {
    id: 'lingma',
    name: 'Tongyi Lingma',
    translateName: true,
    category: 'ide',
    tier: 'unsupported',
    keywords: ['lingma', 'qoder cn', 'tongyi', 'alibaba'],
    summary: 'Now Qoder CN',
    alternatives: {
      text: 'Its custom models only accept Bailian, Zhipu, Kimi and MiniMax. Use Cline or Continue in your editor, or the international Qoder.',
      clientIds: ['cline', 'continue', 'qoder'],
    },
  },

  // ------------------------------------------------------------------ chat
  {
    id: 'cherry-studio',
    name: 'Cherry Studio',
    category: 'chat',
    tier: 'import',
    icon: 'CherryStudio',
    summary: 'Desktop chat app',
    downloadUrl: 'https://www.cherry-ai.com/',
    imports: [
      {
        id: 'cherry-studio',
        label: 'Import to Cherry Studio',
        target: 'app',
        render: (ctx) =>
          buildCherryStudioUrl({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey }),
      },
    ],
    importSteps: [
      'Install Cherry Studio and open it once.',
      'Click the button, allow the browser to open Cherry Studio and confirm the import.',
      'In Settings > Model Provider, turn on the provider, click Manage to add models, then click Check.',
    ],
    manual: {
      // clients-chat.md §2, official
      menuPath: ['设置', '模型服务', 'New API'],
      fields: [
        { label: 'Provider type', value: { kind: 'text', text: 'New API' } },
        { label: 'API address', value: { kind: 'url', url: 'root' } },
        KEY_FIELD,
      ],
      steps: [
        'Open Settings > Model Provider and click Add at the bottom.',
        'Choose the provider type New API and fill in the address and the key.',
        'Add models, click Check, then turn on the switch at the top right.',
      ],
      notes: ['Fill in the address without /v1; Cherry Studio adds it.'],
    },
  },
  {
    id: 'chatbox',
    name: 'Chatbox',
    category: 'chat',
    tier: 'import',
    summary: 'Desktop and mobile chat app',
    downloadUrl: 'https://chatboxai.app/',
    imports: [
      {
        id: 'chatbox',
        label: 'Import to Chatbox',
        target: 'app',
        render: (ctx) =>
          buildChatboxUrl({
            baseUrl: ctx.baseUrl,
            apiKey: ctx.apiKey,
            model: ctx.model,
            models: ctx.models,
          }),
      },
    ],
    importSteps: [
      'Install Chatbox 1.15.1 or later and open it once.',
      'Click the button, allow the browser to open Chatbox and confirm the import.',
      'Pick the LeoAPI provider and a model in a new chat.',
    ],
    manual: {
      // clients-chat.md §3, official
      menuPath: ['设置', '模型提供方 (Model Provider)', '添加'],
      fields: [
        {
          label: 'API mode',
          value: { kind: 'text', text: 'OpenAI API Compatible' },
        },
        { label: 'API Host', value: { kind: 'url', url: 'root' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Open Settings > Model Provider and click Add at the bottom.',
        'Name it, choose OpenAI API Compatible, and fill in API Host and the key. Leave API Path empty.',
        'Add the model, save, then click Check.',
      ],
      notes: ['In Claude API mode the address must end with /v1.'],
    },
  },
  {
    id: 'nextchat',
    name: 'NextChat',
    category: 'chat',
    tier: 'import',
    keywords: ['chatgpt next web'],
    summary: 'Web chat app',
    imports: [
      {
        id: 'nextchat',
        label: 'Open NextChat with this key',
        target: 'web',
        render: (ctx) =>
          buildNextChatUrl({ baseUrl: ctx.baseUrl, apiKey: ctx.apiKey }),
      },
    ],
    importSteps: [
      'Click the button and confirm the settings NextChat shows.',
      'NextChat does not load the model list: add the model name under Settings > Custom models.',
    ],
    manual: {
      fields: [
        { label: 'Endpoint', value: { kind: 'url', url: 'root' } },
        KEY_FIELD,
        { label: 'Custom models', value: { kind: 'model' } },
      ],
      steps: [
        'Open Settings, turn on Custom endpoint and choose OpenAI.',
        'Fill in the endpoint without /v1 and the key.',
        'Type the model name into Custom models.',
      ],
      notes: ['The endpoint has no /v1; NextChat adds /v1/chat/completions.'],
    },
  },
  {
    id: 'chatwise',
    name: 'ChatWise',
    category: 'chat',
    tier: 'manual',
    summary: 'Desktop chat app',
    manual: {
      // clients-chat.md §4, official
      menuPath: ['Settings', 'Providers', '+'],
      fields: [
        {
          label: 'Provider type',
          value: { kind: 'text', text: 'OpenAI Compatible' },
        },
        { label: 'API Base URL', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
      ],
      steps: [
        'Open Settings > Providers and click +.',
        'Choose OpenAI Compatible, fill in the name, API Base URL and the key.',
        'Click Fetch models, or add the model ID by hand.',
      ],
    },
  },
  {
    id: 'lobehub',
    name: 'LobeHub',
    category: 'chat',
    tier: 'manual',
    icon: 'LobeHub',
    keywords: ['lobechat', 'lobe chat'],
    summary: 'Formerly LobeChat',
    manual: {
      // clients-chat.md §5, source locales
      menuPath: ['设置', 'AI 服务商'],
      fields: [
        { label: 'Provider', value: { kind: 'text', text: 'New API' } },
        { label: 'API address', value: { kind: 'url', url: 'root' } },
        KEY_FIELD,
      ],
      steps: [
        'Open Settings > AI Service Provider and choose New API.',
        'Fill in the address without /v1 and the key, then turn the provider on.',
        'Click Fetch models and enable the ones you want.',
      ],
      notes: [
        'With a custom OpenAI provider instead, the address ends with /v1.',
      ],
    },
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    category: 'chat',
    tier: 'manual',
    icon: 'OpenWebUI',
    summary: 'Self-hosted web chat',
    manual: {
      // clients-chat.md §7, official
      menuPath: ['管理员面板', 'Settings', 'Connections', 'Add Connection'],
      fields: [{ label: 'URL', value: { kind: 'url', url: 'v1' } }, KEY_FIELD],
      steps: [
        'Open Admin Panel > Settings > Connections.',
        'Under OpenAI API, click Add Connection and fill in the URL and the key.',
        'Click Verify Connection; the models appear automatically.',
      ],
    },
  },
  {
    id: 'anythingllm',
    name: 'AnythingLLM',
    category: 'chat',
    tier: 'manual',
    summary: 'Desktop knowledge base chat',
    manual: {
      // clients-chat.md §8, official
      menuPath: ['Settings', 'LLM Preference', 'Generic OpenAI'],
      fields: [
        {
          label: 'LLM Provider',
          value: { kind: 'text', text: 'Generic OpenAI' },
        },
        { label: 'Base URL', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        { label: 'Chat Model Name', value: { kind: 'model' } },
      ],
      steps: [
        'Open Settings > LLM Preference and choose Generic OpenAI.',
        'Fill in Base URL, the key and the model name, then save.',
      ],
      notes: [
        'Raise Max Tokens from the default 1024, or long answers are cut off.',
      ],
    },
  },

  // ---------------------------------------------------------------- office
  {
    id: 'workbuddy',
    name: 'WorkBuddy',
    category: 'office',
    tier: 'manual',
    icon: 'CodeBuddy',
    keywords: ['tencent'],
    summary: 'Tencent office agent',
    manual: {
      // clients-chat.md §9, official and Alibaba Cloud docs
      menuPath: ['左下角头像', '设置', '模型', '添加模型'],
      fields: [
        {
          label: 'Provider',
          value: { kind: 'text', text: 'Custom', translate: true },
        },
        {
          label: 'API address (full endpoint)',
          value: { kind: 'url', url: 'chat' },
        },
        KEY_FIELD,
        { label: 'Model name', value: { kind: 'model' } },
      ],
      steps: [
        'Open the model picker below the chat box and choose Configure custom model (or avatar > Settings > Models).',
        'Click Add model and choose Custom as the provider.',
        'Paste the full endpoint, the key and the model name. Keep "Custom protocol" off.',
        'Click Test connection, then save and pick the model from the Custom group.',
      ],
      notes: [
        'The address must be the full endpoint ending with /chat/completions; the bare domain sends requests to the wrong path.',
        'Only the OpenAI protocol works; do not choose Anthropic.',
      ],
    },
  },
  {
    id: 'immersive-translate',
    name: 'Immersive Translate',
    translateName: true,
    category: 'office',
    tier: 'manual',
    keywords: ['translate', 'immersive'],
    summary: 'Browser translation extension',
    manual: {
      fields: [
        { label: 'Custom API endpoint', value: { kind: 'url', url: 'chat' } },
        KEY_FIELD,
        { label: 'Custom model', value: { kind: 'model' } },
      ],
      steps: [
        'Open the extension settings > Translation services and add an OpenAI compatible service.',
        'Paste the key and the full endpoint.',
        'Choose Custom model, type the model name and click Test.',
      ],
      notes: [
        'Translating whole pages uses many tokens; choose a cheaper model.',
        'Lower the requests per second to about 5 if you see 429 errors.',
      ],
    },
  },
  {
    id: 'raycast',
    name: 'Raycast AI',
    category: 'office',
    tier: 'manual',
    keywords: ['raycast'],
    summary: 'Custom providers (Pro)',
    manual: {
      // clients-chat.md §12, official
      menuPath: ['Settings', 'AI', 'Models & Providers', 'Custom Providers'],
      fields: [
        { label: 'base_url', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Open Raycast Settings > AI > Models & Providers > Custom Providers and click Reveal Providers Config.',
        'Merge the snippet into providers.yaml; Raycast reloads it on save.',
      ],
      snippets: [
        {
          title: '~/.config/raycast/ai/providers.yaml',
          language: 'yaml',
          render: (ctx) =>
            [
              'providers:',
              `  - id: ${SETUP_PROVIDER.id}`,
              `    name: ${SETUP_PROVIDER.name}`,
              `    base_url: ${setupUrl(ctx.baseUrl, 'v1')}`,
              '    api_keys:',
              `      ${SETUP_PROVIDER.id}: ${ctx.apiKey}`,
              '    models:',
              `      - id: ${ctx.model}`,
              `        name: ${ctx.model}`,
              '        context: 200000',
              '        abilities:',
              '          tools: { supported: true }',
              '          vision: { supported: true }',
            ].join('\n'),
        },
      ],
      notes: ['Custom providers need Raycast Pro.'],
    },
  },
  {
    id: 'obsidian-copilot',
    name: 'Obsidian Copilot',
    category: 'office',
    tier: 'manual',
    icon: 'Obsidian',
    keywords: ['obsidian'],
    summary: 'Obsidian plugin',
    manual: {
      fields: [
        {
          label: 'Provider',
          value: { kind: 'text', text: '3rd party (openai-format)' },
        },
        { label: 'Base URL', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        { label: 'Model Name', value: { kind: 'model' } },
      ],
      steps: [
        'Open Obsidian Settings > Copilot > Model > Chat Models and click Add Custom Model.',
        'Fill in the fields below and enable the model.',
      ],
      notes: ['Do not add /chat/completions to the Base URL.'],
    },
  },

  // ------------------------------------------------------------------- sdk
  {
    id: 'dev-env',
    name: 'Environment variables',
    translateName: true,
    category: 'sdk',
    tier: 'script',
    keywords: ['env', 'sdk', 'langchain', 'llamaindex', 'litellm'],
    summary: 'For OpenAI, Anthropic and Google SDKs (optional in the script)',
    manual: {
      fields: [
        {
          label: 'OPENAI_BASE_URL',
          literal: true,
          value: { kind: 'url', url: 'v1' },
        },
        {
          label: 'ANTHROPIC_BASE_URL',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        {
          label: 'GOOGLE_GEMINI_BASE_URL',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        KEY_FIELD,
      ],
      steps: [
        'Add the lines to ~/.zshrc (Mac) or set them as user environment variables (Windows), then open a new terminal.',
      ],
      snippets: [
        {
          title: 'Mac / Linux (~/.zshrc)',
          language: 'bash',
          render: (ctx) =>
            [
              `export OPENAI_BASE_URL=${setupUrl(ctx.baseUrl, 'v1')}`,
              `export OPENAI_API_KEY=${ctx.apiKey}`,
              `export ANTHROPIC_BASE_URL=${setupUrl(ctx.baseUrl, 'root')}`,
              `export GOOGLE_GEMINI_BASE_URL=${setupUrl(ctx.baseUrl, 'root')}`,
              `export GEMINI_API_KEY=${ctx.apiKey}`,
            ].join('\n'),
        },
      ],
      notes: [
        'Do not set ANTHROPIC_API_KEY globally: it conflicts with Claude Code. Pass the key in code instead.',
        'Remove the old OPENAI_API_BASE variable if you have it; it takes priority over OPENAI_BASE_URL.',
      ],
    },
  },
  {
    id: 'anthropic-sdk',
    name: 'Anthropic SDK',
    category: 'sdk',
    tier: 'manual',
    icon: 'Anthropic',
    keywords: ['python', 'typescript', 'claude agent sdk', 'langchain'],
    summary: 'Python / TypeScript',
    manual: {
      fields: [
        {
          label: 'base_url',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: ['Pass the address and the key when creating the client.'],
      snippets: [
        {
          title: 'Python',
          language: 'python',
          render: (ctx) =>
            [
              'from anthropic import Anthropic',
              '',
              `client = Anthropic(base_url="${setupUrl(ctx.baseUrl, 'root')}", api_key="${ctx.apiKey}")`,
              'message = client.messages.create(',
              `    model="${ctx.model}",`,
              '    max_tokens=1024,',
              '    messages=[{"role": "user", "content": "Hello"}],',
              ')',
            ].join('\n'),
        },
      ],
      notes: [
        'The address has no /v1; with /v1 requests go to /v1/v1/messages.',
      ],
    },
  },
  {
    id: 'openai-sdk',
    name: 'OpenAI SDK',
    category: 'sdk',
    tier: 'manual',
    icon: 'OpenAI',
    keywords: ['python', 'node', 'langchain', 'llamaindex'],
    summary: 'Python / Node.js',
    manual: {
      fields: [
        { label: 'base_url', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: ['Pass the address and the key when creating the client.'],
      snippets: [
        {
          title: 'Python',
          language: 'python',
          render: (ctx) =>
            [
              'from openai import OpenAI',
              '',
              `client = OpenAI(base_url="${setupUrl(ctx.baseUrl, 'v1')}", api_key="${ctx.apiKey}")`,
              'completion = client.chat.completions.create(',
              `    model="${ctx.model}",`,
              '    messages=[{"role": "user", "content": "Hello"}],',
              ')',
            ].join('\n'),
        },
      ],
      notes: [
        'For Claude models use Chat Completions; streaming plain text through the Responses API can fail in the OpenAI SDK.',
      ],
    },
  },
  {
    id: 'google-genai',
    name: 'Google GenAI SDK',
    category: 'sdk',
    tier: 'manual',
    icon: 'Gemini',
    keywords: ['gemini', 'python', 'google-genai'],
    summary: 'Python / JavaScript',
    manual: {
      fields: [
        {
          label: 'base_url',
          literal: true,
          value: { kind: 'url', url: 'root' },
        },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: ['Pass the address in http_options when creating the client.'],
      snippets: [
        {
          title: 'Python',
          language: 'python',
          render: (ctx) =>
            [
              'from google import genai',
              'from google.genai import types',
              '',
              'client = genai.Client(',
              `    api_key="${ctx.apiKey}",`,
              `    http_options=types.HttpOptions(base_url="${setupUrl(ctx.baseUrl, 'root')}"),`,
              ')',
              `response = client.models.generate_content(model="${ctx.model}", contents="Hello")`,
            ].join('\n'),
        },
      ],
      notes: ['The address has no /v1beta. count_tokens is not available.'],
    },
  },
  {
    id: 'vercel-ai-sdk',
    name: 'Vercel AI SDK',
    category: 'sdk',
    tier: 'manual',
    icon: 'Vercel',
    keywords: ['ai-sdk', 'typescript', 'nextjs'],
    summary: 'TypeScript',
    manual: {
      fields: [
        { label: 'baseURL', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: ['Create the provider with the address and the key.'],
      snippets: [
        {
          title: 'TypeScript',
          language: 'typescript',
          render: (ctx) =>
            [
              "import { createAnthropic } from '@ai-sdk/anthropic'",
              "import { generateText } from 'ai'",
              '',
              'const anthropic = createAnthropic({',
              `  baseURL: '${setupUrl(ctx.baseUrl, 'v1')}',`,
              `  apiKey: '${ctx.apiKey}',`,
              '})',
              `const { text } = await generateText({ model: anthropic('${ctx.model}'), prompt: 'Hello' })`,
            ].join('\n'),
        },
      ],
      notes: [
        'Both @ai-sdk/anthropic and @ai-sdk/openai take the address with /v1, unlike the Anthropic SDK.',
        'openai() uses the Responses API by default; use openai.chat() for Claude models.',
      ],
    },
  },

  // -------------------------------------------------------------- workflow
  {
    id: 'dify',
    name: 'Dify',
    category: 'workflow',
    tier: 'manual',
    icon: 'Dify',
    summary: 'LLM app platform',
    manual: {
      // clients-sdk.md §9, official docs
      menuPath: ['集成 (Integrations)', '模型供应商 (Model Provider)'],
      fields: [
        {
          label: 'Anthropic plugin: API URL',
          value: { kind: 'url', url: 'root' },
        },
        {
          label: 'OpenAI-API-compatible plugin: API Base URL',
          value: { kind: 'url', url: 'v1' },
        },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Open Integrations > Model Provider and install the Anthropic plugin (for Claude) or OpenAI-API-compatible.',
        'Anthropic: click Add API Key and fill in the key and API URL. Use Add Model for models the plugin does not list.',
        'OpenAI-API-compatible: click Add Model, choose LLM, fill in the model name, key and API Base URL, and choose chat.',
      ],
      notes: [
        'The Anthropic plugin takes the address without /v1; the compatible plugin needs /v1.',
        'In the compatible plugin turn on Function calling and Vision yourself, or agents and tools fail.',
        'Only workspace owners and admins can change model providers.',
      ],
    },
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'workflow',
    tier: 'manual',
    icon: 'N8n',
    summary: 'Workflow automation',
    manual: {
      // clients-sdk.md §10
      menuPath: ['Credentials', 'Create credential'],
      fields: [
        {
          label: 'Anthropic credential: Base URL',
          value: { kind: 'url', url: 'root' },
        },
        {
          label: 'OpenAI credential: Base URL',
          value: { kind: 'url', url: 'v1' },
        },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Open Credentials > Create credential and choose Anthropic (for Claude) or OpenAI.',
        'Fill in the key and Base URL, then save; n8n tests the connection.',
        'In the workflow, add an AI Agent with a Chat Model and pick the credential. Use By ID to type the model name.',
      ],
      notes: [
        'The OpenAI Chat Model node turns on "Use Responses API" by default; turn it off for Claude models.',
      ],
    },
  },
  {
    id: 'fastgpt',
    name: 'FastGPT',
    category: 'workflow',
    tier: 'manual',
    icon: 'FastGPT',
    summary: 'Knowledge base and workflow platform',
    manual: {
      // clients-sdk.md §13, official docs
      menuPath: ['管理后台', '系统资源', '系统模型', '模型渠道'],
      fields: [
        { label: 'Proxy address', value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        { label: 'Model ID', value: { kind: 'model' } },
      ],
      steps: [
        'Open the admin console > System resources > System models > Model channels.',
        'Add a channel (OpenAI, or Anthropic for Claude), fill in the address and the key, and tick the models.',
        'If a model is missing, add it under Model configuration with the same ID first.',
      ],
      notes: [
        'Both the OpenAI and the Anthropic channel take the address with /v1.',
      ],
    },
  },
  {
    id: 'coze-studio',
    name: 'Coze Studio',
    category: 'workflow',
    tier: 'manual',
    icon: 'Coze',
    keywords: ['coze', 'open source'],
    summary: 'Open source edition (self-hosted)',
    manual: {
      fields: [
        {
          label: 'protocol',
          literal: true,
          value: { kind: 'text', text: 'openai' },
        },
        { label: 'base_url', literal: true, value: { kind: 'url', url: 'v1' } },
        KEY_FIELD,
        MODEL_FIELD,
      ],
      steps: [
        'Copy backend/conf/model/template/model_template_basic.yaml to backend/conf/model/.',
        'Set a unique id, name, protocol openai, base_url, api_key and model, then run docker compose restart backend.',
      ],
      notes: [
        'Use the openai protocol; the claude template address ends up as /v1/v1/messages.',
      ],
    },
  },
  {
    id: 'coze',
    name: 'Coze',
    category: 'workflow',
    tier: 'unsupported',
    icon: 'Coze',
    keywords: ['coze.cn', 'coze.com', 'kouzi'],
    summary: 'SaaS edition (coze.cn / coze.com)',
    unverified: true,
    alternatives: {
      text: 'We have found no evidence that Coze SaaS accepts a custom model address. Use Dify, n8n or the open source Coze Studio.',
      clientIds: ['dify', 'n8n', 'coze-studio'],
    },
  },
]

/** All strings of a client that go through t(), for coverage tests. */
export function setupClientI18nKeys(client: SetupClient): string[] {
  const keys = [client.summary]
  if (client.translateName) keys.push(client.name)
  for (const action of client.imports ?? []) keys.push(action.label)
  keys.push(...(client.importSteps ?? []))
  if (client.manual) {
    keys.push(...client.manual.steps, ...(client.manual.notes ?? []))
    for (const field of client.manual.fields ?? []) {
      if (!field.literal) keys.push(field.label)
      if (field.hint) keys.push(field.hint)
      if (field.value.kind === 'text' && field.value.translate) {
        keys.push(field.value.text)
      }
    }
    for (const snippet of client.manual.snippets ?? []) {
      if (snippet.translateTitle) keys.push(snippet.title)
    }
  }
  if (client.alternatives) keys.push(client.alternatives.text)
  return keys
}
