import { z } from 'zod';

/**
 * Content moderation category identifiers.
 *
 * Represents the class of objectionable content that triggered a moderation
 * signal. Each category maps to a per-category severity score in
 * {@link ModerationResult.categories}.
 *
 * - `spam`        — unsolicited commercial content, repeated postings, fake reviews.
 * - `sexual`      — explicit or suggestive sexual content.
 * - `violence`    — graphic depictions of physical harm or threats.
 * - `hate`        — content targeting protected characteristics (race, religion, etc.).
 * - `harassment`  — content directed at an individual with intent to intimidate or demean.
 * - `other`       — matched by the blocklist engine but not categorised above.
 *                   Also the default bucket for the v1 stub implementation.
 */
export type ModerationCategory = 'spam' | 'sexual' | 'violence' | 'hate' | 'harassment' | 'other';

/**
 * Structured result returned by {@link ModerateText} (and, once implemented,
 * `moderateText`).
 *
 * All fields are `readonly` — callers must treat this as an immutable value
 * object and must not mutate it.
 *
 * @example
 * ```ts
 * const result: ModerationResult = {
 *   score: 1.0,
 *   categories: { spam: 0, sexual: 0, violence: 0, hate: 0, harassment: 0, other: 1.0 },
 *   matchedTerms: ['badword'],
 * };
 * ```
 */
export type ModerationResult = {
    /**
     * Overall severity score in the `[0, 1]` range.
     *
     * - `0.0` — no objectionable content detected.
     * - `1.0` — definite match (e.g. a blocklisted term was present).
     * - Values in between are produced by graded scoring engines (future, SPEC-195).
     *
     * Consumers use this value together with their own thresholds to decide
     * whether to `PENDING`, `REJECT`, or pass through a piece of content.
     */
    readonly score: number;

    /**
     * Per-category severity scores, each in `[0, 1]`.
     *
     * The v1 stub only populates `categories.other`; the real engine (SPEC-195)
     * will distribute scores across all categories.
     */
    readonly categories: Readonly<Record<ModerationCategory, number>>;

    /**
     * The specific terms or domain strings whose presence triggered a score > 0.
     *
     * Empty array when `score === 0`. Used by consumers to populate audit logs
     * or surface hints to human moderators.
     */
    readonly matchedTerms: readonly string[];
};

/**
 * Input accepted by the `moderateText` function.
 *
 * All fields are `readonly` to encourage pass-by-value usage.
 *
 * @example
 * ```ts
 * const input: ModerateTextInput = {
 *   text: 'Please review my accommodation',
 *   context: 'review',
 * };
 * ```
 */
export type ModerateTextInput = {
    /**
     * The text content to evaluate for objectionable material.
     * Must be a non-empty string. Leading/trailing whitespace is preserved
     * and passed as-is to the engine.
     */
    readonly text: string;

    /**
     * Optional context hint telling the engine which kind of content is being
     * moderated. Engines may apply different blocklists or thresholds depending
     * on context.
     *
     * Well-known values:
     * - `'review'`   — accommodation or destination review text.
     * - `'message'`  — direct-message body (replaces the old MessageService check).
     * - `'post'`     — blog / editorial post body.
     *
     * The open union `(string & {})` allows future contexts to be passed without
     * a breaking change to the type.
     */
    readonly context?: 'review' | 'message' | 'post' | (string & {});
};

/**
 * The `moderateText` function signature (contract-only type).
 *
 * The function is deliberately declared `async` — even though the v1 stub
 * implementation runs synchronously internally — so that consumers `await` it
 * from day one and the call-site contract never changes when a real async
 * engine (e.g. OpenAI Moderation API) replaces the stub in SPEC-195.
 *
 * Usage example for a review service:
 * ```ts
 * import { moderateText } from '@repo/content-moderation';
 *
 * const result = await moderateText({ text: reviewBody, context: 'review' });
 * if (result.score >= PENDING_THRESHOLD) {
 *   initialState = 'PENDING';
 * }
 * ```
 */
export type ModerateText = (input: ModerateTextInput) => Promise<ModerationResult>;

// ---------------------------------------------------------------------------
// Zod input schema
// ---------------------------------------------------------------------------

/**
 * Zod validation schema for {@link ModerateTextInput}.
 *
 * Rules:
 * - `text`    — required, must be a non-empty string (min length 1 after trimming
 *               is intentionally NOT applied here; the engine receives raw text).
 * - `context` — optional string; no enum constraint so future contexts can be
 *               passed without schema updates.
 *
 * @example
 * ```ts
 * // Validates at a route boundary:
 * const parsed = moderateTextInputSchema.parse({ text: body, context: 'review' });
 * const result = await moderateText(parsed);
 * ```
 */
export const moderateTextInputSchema = z.object({
    text: z.string().min(1, { message: 'text must be a non-empty string' }),
    context: z.string().optional()
});

/**
 * TypeScript type inferred from {@link moderateTextInputSchema}.
 *
 * This is structurally identical to {@link ModerateTextInput} but derived from
 * the Zod schema to guarantee the two never drift. The explicit `ModerateTextInput`
 * type is kept as the public-facing alias because it carries the richer JSDoc
 * (including the context open-union documentation).
 *
 * @internal Used only to verify the schema and the hand-authored type stay in sync.
 */
type _ModerateTextInputFromSchema = z.infer<typeof moderateTextInputSchema>;

/**
 * Compile-time assertion: the Zod-inferred type must be assignable to the
 * hand-authored {@link ModerateTextInput} and vice-versa.
 *
 * If this line produces a TypeScript error it means the schema and the explicit
 * type have drifted — fix one of them.
 *
 * The `_` prefix suppresses the biome unused-variable lint rule.
 */
const _assertSchemaCompat: _ModerateTextInputFromSchema extends ModerateTextInput
    ? ModerateTextInput extends _ModerateTextInputFromSchema
        ? true
        : never
    : never = true;
void _assertSchemaCompat;
