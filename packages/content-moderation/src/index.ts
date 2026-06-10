/**
 * @repo/content-moderation — shared content moderation package for the Hospeda platform.
 *
 * Provides a final-shape public API for evaluating text content against
 * objectionable-content criteria. The v1 implementation is a synchronous stub
 * backed by environment-variable word/domain lists; the real scoring engine
 * (graded categories, OpenAI Moderation API, DB-backed editable lists) will
 * land in SPEC-195 with **no consumer-facing API changes**.
 *
 * ## Quick start
 *
 * ```ts
 * import { moderateText, moderateTextInputSchema } from '@repo/content-moderation';
 * import type { ModerationResult, ModerateTextInput } from '@repo/content-moderation';
 *
 * // Validate input at a route/service boundary:
 * const input = moderateTextInputSchema.parse({ text: body, context: 'review' });
 *
 * // Await the result (async contract, sync stub internally):
 * const result = await moderateText(input);
 *
 * if (result.matchedTerms.length > 0) {
 *   // Force the review into PENDING state
 * }
 * ```
 *
 * @module content-moderation
 */

export type {
    ModerationCategory,
    ModerationResult,
    ModerateTextInput,
    ModerateText
} from './types.js';

export { moderateTextInputSchema } from './types.js';

export { moderateText } from './moderate-text.js';

/**
 * Cache-invalidation hooks for consumers that manage the editable moderation
 * term list (e.g. service-core's term admin service). These let a term
 * create/update/delete drop the engine's in-memory cache so the next
 * `moderateText` call re-reads the updated terms.
 *
 * Exposed on the curated public API (instead of forcing a deep
 * `@repo/content-moderation/engine/*` import) so the package keeps a single,
 * Node-resolvable entry point — the engine internals stay private.
 */
export {
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern
} from './engine/cache.js';

/**
 * Public moderation threshold constant frozen by SPEC-166.
 *
 * Consumers use this value to map a moderation score to an initial
 * moderation state. Kept here so the public API surface can be snapshotted
 * independently from service-core internals.
 */
export const MODERATION_PENDING_THRESHOLD = 0.5 as const;

/**
 * Public reject threshold constant added by SPEC-195.
 */
export const MODERATION_REJECT_THRESHOLD = 0.85 as const;
