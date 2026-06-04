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

// moderateText implementation lands in T-003 (SPEC-166 core phase)
