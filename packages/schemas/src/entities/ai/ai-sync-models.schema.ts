import { z } from 'zod';

/**
 * AI provider model-sync schemas (HOS-94).
 *
 * Defines the API-boundary shapes for the "sync models" admin action: given a
 * stored provider credential, the API fetches the provider's raw model list,
 * filters it to chat/text-capable models, and merges it with the curated
 * `KNOWN_PROVIDERS` catalog. These schemas describe the resulting annotated
 * list — they are read-only response shapes; nothing here is persisted
 * directly (the operator-confirmed enabled set still persists via the
 * existing `PATCH /{providerId}` route, see `ai-credential.schema.ts`).
 *
 * @module schemas/entities/ai/ai-sync-models
 */

// ---------------------------------------------------------------------------
// Single detected/curated model entry
// ---------------------------------------------------------------------------

/**
 * A single model surfaced by the sync-models merge, annotated by its origin.
 *
 * - `source: 'detected'` — only found via the live provider list-models call.
 * - `source: 'curated'` — only present in the hardcoded `KNOWN_PROVIDERS`
 *   catalog (kept so a temporarily-missing model doesn't vanish from the UI).
 * - `source: 'both'` — present in both; curated metadata wins for display.
 */
export const AiProviderModelSchema = z.object({
    /** Raw model identifier as used by the provider API (e.g. `gpt-4o`). */
    id: z.string().min(1),
    /** Origin of this entry within the detected/curated merge. */
    source: z.enum(['detected', 'curated', 'both']),
    /** Optional human-readable label for display in the admin UI. */
    label: z.string().optional(),
    /**
     * Optional free-form hint about the model's capability classification
     * (e.g. `'chat'`, `'uncertain'`), surfaced by the per-provider filter
     * when it cannot confidently place a model (OQ-1's "uncertain" bucket).
     */
    capabilityHint: z.string().optional(),
    /** Whether the provider has flagged this model as deprecated. */
    deprecated: z.boolean().optional()
});

/** TypeScript type for a single annotated provider model. */
export type AiProviderModel = z.infer<typeof AiProviderModelSchema>;

// ---------------------------------------------------------------------------
// Sync result (response for POST /{providerId}/sync-models)
// ---------------------------------------------------------------------------

/**
 * Response body for `POST /api/v1/admin/ai/credentials/{providerId}/sync-models`.
 *
 * Ephemeral by design (OQ-3): the merged catalog is recomputed on every call
 * and is never persisted as-is. Only the operator-enabled subset persists to
 * `ai_provider_credentials.metadata.models` via the existing update route.
 */
export const AiSyncModelsResultSchema = z.object({
    /** AI provider identifier the sync was run for. */
    providerId: z.string(),
    /** Detected/curated/both models, annotated by source. */
    models: z.array(AiProviderModelSchema),
    /** ISO-8601 timestamp of when the sync was performed. */
    fetchedAt: z.string().datetime({ offset: true }),
    /**
     * Non-fatal warnings surfaced during the sync (e.g. unexpected response
     * shape from the provider, a partially-parsed page). Absent or empty
     * means the sync completed without caveats.
     */
    warnings: z.array(z.string()).optional(),
    /**
     * Raw provider model ids that were excluded from `models` by the
     * chat-capability denylist (owner follow-up to HOS-94: audio/realtime/
     * codex/search/deep-research/image/embedding/tts/whisper/dall-e/
     * moderation families). Absent or empty means nothing was hidden.
     *
     * The admin UI (`SyncModelsSection`) uses this list to auto-remove any
     * of these ids from an operator's existing `selectedModels` on re-sync,
     * while preserving hand-typed custom ids untouched — a custom id never
     * appears here because the provider API never returned it in the first
     * place, so it can't have been denylisted.
     *
     * Optional for backward compatibility with the pre-existing additive-only
     * schema contract (see the package's Schema Compatibility Policy): older
     * cached/queued `AiSyncModelsResult` payloads without this field still
     * parse successfully.
     */
    hiddenModelIds: z.array(z.string()).optional()
});

/** TypeScript type for the sync-models result. */
export type AiSyncModelsResult = z.infer<typeof AiSyncModelsResultSchema>;

// ---------------------------------------------------------------------------
// Preflight input (request for POST /sync-models/preview — BETA-129)
// ---------------------------------------------------------------------------

/**
 * Input body for `POST /api/v1/admin/ai/credentials/sync-models/preview`.
 *
 * Lets an admin sync a provider's model catalog with a just-typed API key
 * BEFORE any credential is saved (BETA-129 part 1). Unlike
 * `POST /{providerId}/sync-models`, there is no stored credential to decrypt
 * yet — the plaintext key travels in the request body, is used once to call
 * the provider's live list-models endpoint, and is never persisted, logged,
 * or echoed back.
 */
export const AiSyncModelsPreflightInputSchema = z
    .object({
        /** AI provider identifier (e.g. `openai`, `anthropic`, `ollama`). */
        providerId: z.string().min(1),
        /** The raw, not-yet-saved API key. Consumed once — never returned. */
        plaintextKey: z.string().min(1),
        /** Optional base URL override (required by self-hosted providers like Ollama). */
        baseURL: z.string().url().optional()
    })
    .strict();

/** TypeScript type for the sync-models preflight input. */
export type AiSyncModelsPreflightInput = z.infer<typeof AiSyncModelsPreflightInputSchema>;
