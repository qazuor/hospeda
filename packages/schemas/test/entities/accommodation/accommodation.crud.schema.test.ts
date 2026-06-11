import { describe, expect, it } from 'vitest';
import {
    AccommodationCreateInputSchema,
    AccommodationPatchInputSchema,
    AccommodationUpdateInputSchema
} from '../../../src/entities/accommodation/accommodation.crud.schema.js';

/**
 * SPEC-217 regression: the partial update/patch schemas must NOT inject `.default()`
 * values. In Zod 4, `.partial()` does not strip defaults, so an empty (or
 * single-field) PATCH used to arrive carrying `lifecycleState:'ACTIVE'`,
 * `visibility:'PUBLIC'`, `moderationState:'PENDING'`, review stats, etc. — silently
 * overwriting server state and, for a DRAFT→ACTIVE publish, bypassing the trial
 * flow. `stripShapeDefaults` fixes this; these tests lock the contract.
 */
describe('AccommodationUpdate/PatchInputSchema — no default injection (SPEC-217)', () => {
    it('parses an empty patch to an empty object (no injected defaults)', () => {
        expect(AccommodationPatchInputSchema.parse({})).toEqual({});
        expect(AccommodationUpdateInputSchema.parse({})).toEqual({});
    });

    it('keeps ONLY the field the client sent', () => {
        expect(AccommodationPatchInputSchema.parse({ lifecycleState: 'ACTIVE' })).toEqual({
            lifecycleState: 'ACTIVE'
        });
        expect(AccommodationPatchInputSchema.parse({ name: 'A Valid Accommodation Name' })).toEqual(
            { name: 'A Valid Accommodation Name' }
        );
    });

    it('does NOT inject lifecycleState / visibility / moderationState / review stats', () => {
        const parsed = AccommodationPatchInputSchema.parse({ name: 'Another Valid Name' });
        expect(parsed).not.toHaveProperty('lifecycleState');
        expect(parsed).not.toHaveProperty('visibility');
        expect(parsed).not.toHaveProperty('moderationState');
        expect(parsed).not.toHaveProperty('isFeatured');
        expect(parsed).not.toHaveProperty('reviewsCount');
        expect(parsed).not.toHaveProperty('averageRating');
    });

    it('still rejects unknown/invalid values on a sent field', () => {
        const bad = AccommodationPatchInputSchema.safeParse({ lifecycleState: 'NOT_A_STATE' });
        expect(bad.success).toBe(false);
    });
});

/**
 * Guard the other side of the fix: the CREATE schema MUST keep applying defaults.
 * `stripShapeDefaults` is only wired into the update/patch schema, so create-time
 * defaults (e.g. lifecycleState, visibility) must remain intact.
 */
describe('AccommodationCreateInputSchema — defaults preserved', () => {
    it('still applies create-time defaults for omitted defaulted fields', () => {
        const minimal = {
            slug: 'a-valid-slug',
            name: 'A Valid Accommodation Name',
            summary: 'A valid summary that is long enough to pass.',
            description:
                'A valid description that is definitely long enough to pass the minimum length constraint.',
            type: 'HOTEL',
            destinationId: '00000000-0000-0000-0000-000000000000',
            ownerId: '00000000-0000-0000-0000-000000000000'
        };
        const parsed = AccommodationCreateInputSchema.parse(minimal);
        // Create still injects the lifecycle/visibility defaults.
        expect(parsed).toHaveProperty('lifecycleState', 'ACTIVE');
        expect(parsed).toHaveProperty('visibility', 'PUBLIC');
    });
});
