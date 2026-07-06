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
    warnings: z.array(z.string()).optional()
});

/** TypeScript type for the sync-models result. */
export type AiSyncModelsResult = z.infer<typeof AiSyncModelsResultSchema>;
