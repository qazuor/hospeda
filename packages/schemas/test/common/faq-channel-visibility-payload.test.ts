/**
 * @file faq-channel-visibility-payload.test.ts
 * @description Regression suite for H-119 / H-59 — the two FAQ channel-visibility
 * flags were silently discarded by the HTTP payload schemas.
 *
 * ## The bug these tests reproduce
 *
 * `FaqCreatePayloadSchema` is a `.pick()` of three fields
 * (`question`, `answer`, `category`). The two HOS-393 flags live on a separate
 * fragment and were never added to it. Zod objects strip unknown keys by
 * default, so a body carrying `isVisibleOnListing: false` parsed clean, lost the
 * flag before any handler saw it, and the request answered `200`. The row was
 * written with the column default (`true`) and the user believed they had saved.
 *
 * A silent discard WITH an acknowledgement of success is worse than a field that
 * fails to persist: there is no signal anywhere that the intent was dropped.
 *
 * ## What is asserted, and why in exactly this shape
 *
 * Two halves that must hold together:
 *
 * 1. The flag-carrying schemas keep an explicit `false`. Asserted with an exact
 *    object comparison, never `expect.objectContaining` — that matcher is blind
 *    to a MISSING key, which is precisely the failure mode here, so it would
 *    have stayed green throughout the entire bug.
 * 2. The plain schemas REJECT the flags instead of dropping them. The three
 *    entities that have no such column (`destination`, `gastronomy`,
 *    `experience`) must answer "I do not accept that field", not "saved".
 *
 * @see packages/schemas/src/common/faq.schema.ts
 */

import { describe, expect, it } from 'vitest';
import {
    FaqCreatePayloadSchema,
    FaqUpdatePayloadSchema,
    FaqWithChannelVisibilityCreatePayloadSchema,
    FaqWithChannelVisibilityUpdatePayloadSchema
} from '../../src/common/faq.schema.js';

/** A body that satisfies the base field constraints (min lengths). */
const VALID_TEXT = {
    question: '¿A qué hora es el check-in?',
    answer: 'El check-in es a partir de las 14:00 horas.'
} as const;

describe('FAQ channel-visibility payload schemas (H-119 / H-59)', () => {
    describe('flag-carrying schemas preserve an explicit false', () => {
        it('keeps both flags on create', () => {
            const result = FaqWithChannelVisibilityCreatePayloadSchema.safeParse({
                ...VALID_TEXT,
                isVisibleOnListing: false,
                isUsableByAi: false
            });

            expect(result.success).toBe(true);
            // Exact comparison: `objectContaining` cannot fail on a dropped key.
            expect(result.success && result.data).toEqual({
                question: VALID_TEXT.question,
                answer: VALID_TEXT.answer,
                isVisibleOnListing: false,
                isUsableByAi: false
            });
        });

        it('keeps both flags on update', () => {
            const result = FaqWithChannelVisibilityUpdatePayloadSchema.safeParse({
                isVisibleOnListing: false,
                isUsableByAi: false
            });

            expect(result.success).toBe(true);
            expect(result.success && result.data).toEqual({
                isVisibleOnListing: false,
                isUsableByAi: false
            });
        });

        it('leaves the flags absent on a partial update that omits them', () => {
            // Guards the reasoning already recorded in the schema's JSDoc: a
            // `.default()` on the update schema would fire on every partial edit
            // and silently reset a private FAQ back to public. Absent must stay
            // absent so the service reads it as "leave unchanged".
            const result = FaqWithChannelVisibilityUpdatePayloadSchema.safeParse({
                question: VALID_TEXT.question
            });

            expect(result.success).toBe(true);
            expect(result.success && result.data).toEqual({ question: VALID_TEXT.question });
            expect(result.success && Object.hasOwn(result.data, 'isVisibleOnListing')).toBe(false);
            expect(result.success && Object.hasOwn(result.data, 'isUsableByAi')).toBe(false);
        });
    });

    describe('plain schemas reject the flags instead of discarding them', () => {
        // The three entities whose FAQ tables have no such column route their
        // bodies through these schemas. Until HOS-400 adds the columns, an
        // attempt to set a flag there must be an error the caller can see.
        it('rejects isVisibleOnListing on create', () => {
            const result = FaqCreatePayloadSchema.safeParse({
                ...VALID_TEXT,
                isVisibleOnListing: false
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.error.issues[0]?.code).toBe(
                'unrecognized_keys'
            );
        });

        it('rejects isUsableByAi on update', () => {
            const result = FaqUpdatePayloadSchema.safeParse({ isUsableByAi: false });

            expect(result.success).toBe(false);
            expect(result.success === false && result.error.issues[0]?.code).toBe(
                'unrecognized_keys'
            );
        });

        it('still accepts a body made only of supported fields', () => {
            // The rejection above must come from strictness, not from a broken
            // schema: the happy path has to keep working, or the previous two
            // assertions prove nothing.
            expect(FaqCreatePayloadSchema.safeParse(VALID_TEXT).success).toBe(true);
            expect(
                FaqUpdatePayloadSchema.safeParse({ question: VALID_TEXT.question }).success
            ).toBe(true);
        });
    });
});
