import { z } from 'zod';
import { AiFeatureSchema, AiModelParamsSchema, AiProviderIdSchema } from './ai-provider.schema.js';

/**
 * AI settings blob schema (SPEC-173).
 *
 * Defines the validated shape of the `ai_settings.value` JSONB blob (§5.6, Q7).
 * Mirrors the `platform_settings` pattern: a single record keyed by `'global'`
 * holds the entire configuration as a typed, Zod-validated blob.
 *
 * **What lives here**: provider on/off switches, per-feature routing config
 * (primary provider, fallback chain, model string, inference params, kill-switch),
 * and optional cost ceilings (§5.8).
 *
 * **What does NOT live here**:
 * - Provider API credentials (vault table `ai_provider_credentials`, §5.5).
 * - Versioned system prompts (`ai_prompt_versions` table, §5.4).
 * - Per-plan usage quotas (in `@repo/billing`, Q2/§5.7) — the entitlement/limit
 *   keys `ai_text_improve`, `max_ai_chat_per_month`, etc. are billing concerns,
 *   not AI-settings concerns. Duplicating them here would create a second source
 *   of truth for enforcement. The engine reads quota state from the entitlement
 *   middleware, NOT from this blob.
 *
 * **Strictness**: `.strict()` is applied to the top-level blob and to the
 * per-provider / per-feature sub-objects so that unknown keys are rejected at
 * write time, keeping the stored config clean. New fields MUST be added
 * explicitly (additive-only policy).
 *
 * **Default model strings**: concrete model identifiers (e.g. `"gpt-4o-mini"`)
 * are NOT baked in here — the `model` field is `z.string()`. Defaults are
 * seeded at DB-seed time (Q5/§8) and are admin-editable after the fact.
 */

// ---------------------------------------------------------------------------
// Per-provider config
// ---------------------------------------------------------------------------

/**
 * Configuration entry for a single AI provider.
 * Only the on/off switch lives here — credentials are in the vault (§5.5).
 */
export const AiProviderConfigSchema = z
    .object({
        /** Whether this provider is available for routing. Kill-switch. */
        enabled: z.boolean()
    })
    .strict();

/** TypeScript type for per-provider AI configuration. */
export type AiProviderConfig = z.infer<typeof AiProviderConfigSchema>;

/**
 * Map of all providers to their configuration.
 * Every `AiProviderId` member should be present; the engine treats a missing
 * entry as `{ enabled: false }` (defensive default).
 *
 * Uses `z.partialRecord` (Zod 4) so that the map is partial — only configured
 * providers need to be present. Adding a new provider value to
 * `AiProviderIdSchema` does not require a schema change in this file; the map
 * will simply accept the new key once it appears.
 */
export const AiProvidersMapSchema = z.partialRecord(AiProviderIdSchema, AiProviderConfigSchema);

/** TypeScript type for the providers map. */
export type AiProvidersMap = z.infer<typeof AiProvidersMapSchema>;

// ---------------------------------------------------------------------------
// Per-feature config
// ---------------------------------------------------------------------------

/**
 * Configuration for a single AI feature (routing + model + kill-switch).
 *
 * `primaryProvider` + `fallbackChain` together define the ordered provider
 * list the engine uses (§5.3): it tries `primaryProvider` first, then walks
 * `fallbackChain` in order on failure.
 *
 * **Decision (owner-approved 2026-06-04)**: `fallbackChain` MAY repeat the same
 * provider as `primaryProvider` — the schema stays permissive. If the duplicate-
 * retry behavior proves confusing, the engine layer can add a runtime guard later
 * (additive change, no schema impact).
 */
export const AiFeatureConfigSchema = z
    .object({
        /**
         * Kill-switch: when `false` the feature is immediately disabled for ALL
         * users regardless of entitlements (§AC-9). Takes effect without redeploy.
         */
        enabled: z.boolean(),
        /** Primary provider used for this feature's AI calls. */
        primaryProvider: AiProviderIdSchema,
        /**
         * Ordered fallback chain tried on primary failure (timeout / 5xx / rate-limit).
         * Empty array = no fallback (call fails if primary fails).
         */
        fallbackChain: z.array(AiProviderIdSchema),
        /**
         * Model identifier string forwarded to the provider adapter.
         * Concrete strings (e.g. `"gpt-4o-mini"`) are set at seed time (Q5/§8).
         * Admin-editable after the fact without redeploy.
         */
        model: z.string().min(1),
        /**
         * Optional inference parameters for this feature.
         * Overrides the provider's defaults; each field is individually optional.
         */
        params: AiModelParamsSchema
    })
    .strict();

/** TypeScript type for per-feature AI configuration. */
export type AiFeatureConfig = z.infer<typeof AiFeatureConfigSchema>;

/**
 * Map of all features to their configuration.
 * Uses `z.record` (full, not partial) — every `AiFeature` member MUST be
 * present. A missing feature entry is a configuration error: the engine cannot
 * route calls for a feature with no config.
 */
export const AiFeaturesMapSchema = z.record(AiFeatureSchema, AiFeatureConfigSchema);

/** TypeScript type for the features map. */
export type AiFeaturesMap = z.infer<typeof AiFeaturesMapSchema>;

// ---------------------------------------------------------------------------
// Cost ceilings (§5.8)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Per-model rate (decision A: hybrid in-code + optional DB override)
// ---------------------------------------------------------------------------

/**
 * Per-model pricing expressed as integer µUSD per 1,000,000 tokens.
 *
 * Public provider pricing is conventionally quoted per 1M tokens, so this
 * unit eliminates conversion loss and keeps all values as safe integers.
 *
 * **Unit**: micro-USD (µUSD) — integer millionths of a US dollar.
 *   1 USD = 1,000,000 µUSD. NEVER store a float here.
 *
 * @example
 * // gpt-4o-mini at $0.15 input / $0.60 output per 1M tokens:
 * { inputMicroUsdPerMillionTokens: 150_000, outputMicroUsdPerMillionTokens: 600_000 }
 */
export const AiModelRateSchema = z
    .object({
        /**
         * Cost of 1,000,000 input (prompt) tokens in integer µUSD.
         * Example: 150_000 = $0.15 per 1M tokens.
         */
        inputMicroUsdPerMillionTokens: z.number().int().min(0),
        /**
         * Cost of 1,000,000 output (completion) tokens in integer µUSD.
         * Example: 600_000 = $0.60 per 1M tokens.
         */
        outputMicroUsdPerMillionTokens: z.number().int().min(0)
    })
    .strict();

/** TypeScript type for a per-model cost rate. */
export type AiModelRate = z.infer<typeof AiModelRateSchema>;

// ---------------------------------------------------------------------------
// Cost ceilings (§5.8)
// ---------------------------------------------------------------------------

/**
 * Admin-set monthly cost ceilings (§5.8).
 *
 * All monetary values are **integer micro-USD** (µUSD — millionths of a US
 * dollar; 1 USD = 1,000,000 µUSD; NEVER float). USD native — no FX conversion.
 * The engine compares accumulated spend (also in µUSD) from `ai_usage` against
 * these ceilings.
 *
 * Both fields are optional: omitting `globalMonthlyMicroUsd` means no global
 * ceiling; omitting a feature key inside `perFeatureMonthlyMicroUsd` means no
 * ceiling for that feature. A ceiling of `0` would hard-stop immediately (valid
 * but probably unintentional — the admin UI should warn).
 *
 * **Decision (owner-approved 2026-06-04)**: `perFeatureMonthlyMicroUsd` uses
 * `z.partialRecord(AiFeatureSchema, ...)` so the map is partial — only features
 * with a configured ceiling need to be present. A feature without a key has no
 * per-feature ceiling (the global ceiling, if set, still applies).
 */
export const AiCostCeilingsSchema = z
    .object({
        /**
         * Global monthly spend ceiling in integer µUSD (micro-USD).
         * When cumulative spend across ALL features and providers crosses this
         * value, ALL AI calls are hard-stopped until the ceiling resets or is
         * raised (§AC-8).
         *
         * Example: 5_000_000_000 = $5,000 / month.
         */
        globalMonthlyMicroUsd: z.number().int().min(0).optional(),
        /**
         * Per-feature monthly spend ceiling in integer µUSD (micro-USD).
         * Keyed by `AiFeature`; only features that need a ceiling must be present
         * (uses `z.partialRecord` — Zod 4 — so missing features are allowed).
         *
         * Example: { chat: 1_000_000_000 } = $1,000 / month for the chat feature.
         */
        perFeatureMonthlyMicroUsd: z
            .partialRecord(AiFeatureSchema, z.number().int().min(0))
            .optional()
    })
    .strict();

/** TypeScript type for AI cost ceilings. */
export type AiCostCeilings = z.infer<typeof AiCostCeilingsSchema>;

// ---------------------------------------------------------------------------
// Top-level blob
// ---------------------------------------------------------------------------

/**
 * The full validated shape of the `ai_settings.value` JSONB blob.
 *
 * This schema is used at every write boundary (admin save route + service) so
 * the DB never stores an invalid config. It is also used by the config resolver
 * in `@repo/ai-core` when reading and hydrating the in-memory config cache.
 *
 * **Key used in `ai_settings`**: `'global'` (single row, single config blob).
 * This mirrors the `platform_settings` pattern where each `key` corresponds to
 * one typed value blob.
 *
 * `.strict()` is applied so that unknown top-level keys are rejected, keeping
 * the blob free of stale/unknown fields as the schema evolves.
 */
export const AiSettingsValueSchema = z
    .object({
        /**
         * Per-provider on/off configuration.
         * Keys are `AiProviderId` values; each maps to `AiProviderConfigSchema`.
         */
        providers: AiProvidersMapSchema,
        /**
         * Per-feature routing + model + kill-switch configuration.
         * Keys are `AiFeature` values; each maps to `AiFeatureConfigSchema`.
         */
        features: AiFeaturesMapSchema,
        /**
         * Optional monthly cost ceilings (global + per-feature) in µUSD.
         * Absence means no ceilings are enforced. Hard-stop behavior on breach
         * is implemented in the engine's cost-ceiling checker (§5.8).
         */
        costCeilings: AiCostCeilingsSchema.optional(),
        /**
         * HYBRID per-model cost rate overrides.
         *
         * `@repo/ai-core` ships in-code default `MODEL_RATES` for all supported
         * models. Entries here override or extend those defaults per model id
         * (e.g. `'gpt-4o-mini'`) without requiring a redeploy (decision A,
         * owner-approved 2026-06-04).
         *
         * The in-code defaults are the mandatory fallback — a missing key here
         * does NOT brick metering; the engine falls back to `MODEL_RATES`.
         *
         * Keys are model identifier strings (e.g. `'gpt-4o-mini'`, `'claude-3-5-sonnet-20241022'`).
         * Values are {@link AiModelRateSchema} objects (µUSD per 1M tokens).
         */
        modelRates: z.record(z.string(), AiModelRateSchema).optional()
    })
    .strict();

/** TypeScript type for the full AI settings blob. */
export type AiSettingsValue = z.infer<typeof AiSettingsValueSchema>;

// ---------------------------------------------------------------------------
// Settings key
// ---------------------------------------------------------------------------

/**
 * The canonical key used to store the global AI settings blob in `ai_settings`.
 * Defined as a schema literal for type-safe key passing (matches the storage
 * pattern in `platform_settings`).
 */
export const AiSettingsKeySchema = z.literal('global');

/** TypeScript type for the AI settings key. */
export type AiSettingsKey = z.infer<typeof AiSettingsKeySchema>;

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

/**
 * Response shape for `GET /api/v1/admin/ai/settings`.
 * Wraps the blob with the row metadata the API returns at the boundary.
 */
export const AiSettingsResponseSchema = z.object({
    /** Always `'global'` in V1. */
    key: AiSettingsKeySchema,
    /** The validated settings blob. */
    value: AiSettingsValueSchema,
    /** ISO-8601 timestamp of the last write. */
    updatedAt: z.string().datetime({ offset: true }),
    /** UUID of the SUPER_ADMIN who last wrote the settings. */
    updatedBy: z.string().uuid()
});

/** TypeScript type for the AI settings API response. */
export type AiSettingsResponse = z.infer<typeof AiSettingsResponseSchema>;
