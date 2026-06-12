/**
 * AI settings types.
 *
 * These mirror the authoritative API contract served by
 * `GET/PUT /api/v1/admin/ai/settings` (see packages/schemas/src/entities/ai/).
 * The shape is a nested blob — providers map, features map, and optional cost
 * ceilings — matching `AiSettingsValueSchema` from `@repo/schemas`.
 */

/** AI provider identifier — any non-empty string (e.g. 'openai', 'ollama', 'groq'). */
export type AiProviderId = string;

/** Per-provider configuration — only the on/off switch. */
export interface AiProviderConfig {
    readonly enabled: boolean;
}

/** Map of providers to their configuration. */
export type AiProvidersMap = Record<string, AiProviderConfig>;

/** The four V1 AI feature identifiers. */
export type AiFeatureId = 'text_improve' | 'chat' | 'search' | 'support';

/** Optional inference parameters for a feature. */
export interface AiModelParams {
    readonly temperature?: number;
    readonly maxTokens?: number;
    readonly topP?: number;
}

/** Per-feature routing + model + kill-switch configuration. */
export interface AiFeatureConfig {
    readonly enabled: boolean;
    readonly primaryProvider: AiProviderId;
    readonly fallbackChain: readonly AiProviderId[];
    readonly model: string;
    readonly params: AiModelParams;
}

/**
 * Map of features to their configuration in API responses.
 *
 * This is intentionally a PARTIAL record: when the `ai_settings` table is
 * empty (no admin has ever saved a config), the GET endpoint returns
 * `features: {}`. The admin page's `toFormValues()` fills in any missing keys
 * from `DEFAULT_SETTINGS` before seeding the form, so the UI renders correctly
 * for first-time setup.
 *
 * Note: the PUT request body requires ALL four feature keys (full record).
 * Only the response shape is partial.
 */
export type AiFeaturesMap = Partial<Record<AiFeatureId, AiFeatureConfig>>;

/** Admin-set monthly cost ceilings in micro-USD (µUSD). */
export interface AiCostCeilings {
    readonly globalMonthlyMicroUsd?: number;
    readonly perFeatureMonthlyMicroUsd?: Partial<Record<AiFeatureId, number>>;
}

/** The full AI settings blob — matches `AiSettingsValueSchema`. */
export interface AiSettingsValue {
    readonly providers: AiProvidersMap;
    readonly features: AiFeaturesMap;
    readonly costCeilings?: AiCostCeilings;
}

/** API response shape for GET /api/v1/admin/ai/settings. */
export interface AiSettingsResponse {
    readonly key: 'global';
    readonly value: AiSettingsValue;
    readonly updatedAt: string;
    readonly updatedBy: string;
}

/** Masked credential returned by the API. */
export interface AiCredentialMasked {
    readonly id: string;
    readonly providerId: AiProviderId;
    readonly label: string | null;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly deletedAt: string | null;
}

/** Payload for creating a new credential. */
export interface CreateAiCredentialPayload {
    readonly providerId: string;
    readonly plaintextKey: string;
    readonly label?: string;
    readonly metadata?: Record<string, unknown>;
}

/** Payload for rotating a credential key. */
export interface RotateAiCredentialPayload {
    readonly newPlaintextKey: string;
}

/** Payload for updating credential metadata (label, models, baseURL). */
export interface UpdateAiCredentialPayload {
    readonly label?: string;
    readonly metadata?: Record<string, unknown>;
}

/** Response shape after credential create/rotate. */
export interface AiCredentialMutationResponse {
    readonly id: string;
    readonly providerId: AiProviderId;
}

/** Response shape after credential delete. */
export interface AiCredentialDeleteResponse {
    readonly providerId: AiProviderId;
}

/** Display-friendly provider name map for well-known providers. */
export const PROVIDER_LABELS: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    stub: 'Stub (test)',
    ollama: 'Ollama',
    groq: 'Groq',
    deepseek: 'DeepSeek',
    together: 'Together AI',
    'lm-studio': 'LM Studio'
} as const;

/**
 * Returns a display-friendly label for a provider ID.
 * Falls back to the raw provider ID for unknown providers.
 */
export function getProviderLabel(providerId: AiProviderId): string {
    return PROVIDER_LABELS[providerId] ?? providerId;
}

/** Display-friendly feature name map. */
export const FEATURE_LABELS: Record<AiFeatureId, string> = {
    text_improve: 'Mejora de texto',
    chat: 'Chat',
    search: 'Búsqueda',
    support: 'Soporte'
} as const;

// ---------------------------------------------------------------------------
// Prompt versions
// ---------------------------------------------------------------------------

/** A single prompt version returned by the prompts API. */
export interface AiPromptVersion {
    readonly id: string;
    readonly feature: string;
    readonly version: number;
    readonly content: string;
    /** Optional guardrail rules appended after the main prompt content. Nullable to match the API contract (z.string().nullable()). */
    readonly rules?: string | null;
    readonly isActive: boolean;
    readonly createdAt: string;
}

/** Payload for creating a new prompt version. */
export interface CreateAiPromptPayload {
    readonly feature: string;
    readonly content: string;
    /** Optional guardrail rules. When omitted the API falls back to built-in defaults. */
    readonly rules?: string;
    readonly activate?: boolean;
}
