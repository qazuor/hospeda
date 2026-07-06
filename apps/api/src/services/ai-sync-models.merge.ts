/**
 * Detected ∪ curated model merge (HOS-94 §6.3, T-007).
 *
 * Pure function that merges the *filtered* detected model list produced by
 * the T-006 chat-capability classifier with the hand-maintained curated
 * catalog (`@repo/schemas` `KNOWN_PROVIDERS`). It does not perform any I/O,
 * decryption, or provider fetch — that orchestration lives in the T-008
 * sync-models service, which calls this function as its last step.
 *
 * Merge rule (spec §6.3):
 * - Model id present in BOTH detected and curated → `source: 'both'`
 *   (curated metadata wins where present; today the only curated metadata is
 *   the id itself, so this mainly matters for future curated fields such as
 *   `label`/`deprecated`).
 * - Detected only → `source: 'detected'` (the value-add: brand-new models
 *   the curated catalog doesn't know about yet).
 * - Curated only → `source: 'curated'` (kept so a temporarily-missing model
 *   doesn't vanish from the suggested list).
 *
 * @module services/ai-sync-models.merge
 */

import type { AiProviderModel } from '@repo/schemas';
import { getKnownProvider } from '@repo/schemas';

/**
 * A single entry from the filtered detected list (T-006 output): the raw
 * model id plus an optional `uncertain` flag when the chat-capability
 * classifier could not confidently place it (OQ-1's "uncertain" bucket).
 */
export interface DetectedModelEntry {
    /** Raw model identifier as returned by the provider's list-models call. */
    readonly id: string;
    /**
     * Whether the T-006 classifier could not confidently determine this
     * model is chat-capable (surfaced, not dropped).
     */
    readonly uncertain?: boolean;
}

/**
 * Input for {@link mergeDetectedAndCuratedModels}.
 */
export interface MergeDetectedAndCuratedModelsInput {
    /** AI provider identifier (matches `ai_provider_credentials.providerId`). */
    readonly providerId: string;
    /** Filtered detected model list (T-006 output) for this provider. */
    readonly detected: readonly DetectedModelEntry[];
}

/**
 * Builds a single {@link AiProviderModel} entry, attaching the `uncertain`
 * capability hint only when applicable.
 *
 * Representation choice for "uncertain": the merge output has no boolean
 * `uncertain` field (only `AiProviderModelSchema.capabilityHint?: string`),
 * so an uncertain detected model is carried forward as
 * `capabilityHint: 'uncertain'`. This reuses the same free-form field the
 * spec already designates for classifier hints (§7) instead of inventing a
 * parallel flag, and it survives the `AiProviderModelSchema` boundary
 * unchanged.
 *
 * @param id - Model identifier
 * @param source - Merge source annotation for this entry
 * @param uncertain - Whether the detected entry was flagged uncertain
 * @returns A schema-valid {@link AiProviderModel} entry
 */
function buildModelEntry(
    id: string,
    source: AiProviderModel['source'],
    uncertain: boolean
): AiProviderModel {
    return uncertain ? { id, source, capabilityHint: 'uncertain' } : { id, source };
}

/**
 * Merges a provider's filtered detected model list with its curated
 * `KNOWN_PROVIDERS` catalog entry, annotating each resulting model by its
 * origin (`detected` | `curated` | `both`).
 *
 * De-duplicates by id (both within `detected` itself and across the
 * detected/curated union) and returns models in a deterministic order:
 * curated-catalog order first (so the admin UI's familiar suggested-model
 * ordering doesn't shuffle), followed by any extra detected-only models in
 * their original detection order.
 *
 * An unknown `providerId` (not part of the curated catalog, e.g. a fully
 * custom provider) is treated as having an empty curated list — every
 * detected model is then returned with `source: 'detected'`.
 *
 * @param input - Provider id and its filtered detected model list
 * @returns The merged, source-annotated, de-duplicated model list
 *
 * @example
 * ```ts
 * mergeDetectedAndCuratedModels({
 *   providerId: 'openai',
 *   detected: [{ id: 'gpt-4o' }, { id: 'gpt-5-preview', uncertain: true }],
 * });
 * // [
 * //   { id: 'gpt-4o', source: 'both' },
 * //   { id: 'gpt-4o-mini', source: 'curated' },
 * //   ...other curated-only entries...
 * //   { id: 'gpt-5-preview', source: 'detected', capabilityHint: 'uncertain' },
 * // ]
 * ```
 */
export function mergeDetectedAndCuratedModels(
    input: MergeDetectedAndCuratedModelsInput
): AiProviderModel[] {
    const { providerId, detected } = input;
    const curatedModels = getKnownProvider(providerId)?.models ?? [];

    // De-dup the detected list by id; first occurrence wins for the
    // `uncertain` flag (there is no ordering guarantee from the provider
    // that would make "last wins" meaningfully better).
    const detectedById = new Map<string, boolean>();
    for (const entry of detected) {
        if (!detectedById.has(entry.id)) {
            detectedById.set(entry.id, entry.uncertain === true);
        }
    }

    const seen = new Set<string>();
    const merged: AiProviderModel[] = [];

    for (const curatedId of curatedModels) {
        if (seen.has(curatedId)) {
            continue;
        }
        seen.add(curatedId);

        if (detectedById.has(curatedId)) {
            merged.push(buildModelEntry(curatedId, 'both', detectedById.get(curatedId) === true));
        } else {
            merged.push(buildModelEntry(curatedId, 'curated', false));
        }
    }

    for (const [detectedId, uncertain] of detectedById) {
        if (seen.has(detectedId)) {
            continue;
        }
        seen.add(detectedId);
        merged.push(buildModelEntry(detectedId, 'detected', uncertain));
    }

    return merged;
}
