/**
 * Regression tests for SocialContentBatchSchema's `startsAt`/`endsAt` fields
 * (bug fix: `null` was coerced to the Unix epoch instead of staying `null`).
 *
 * Mirrors the SocialCampaignSchema regression — see that test file for the
 * full root-cause explanation. Before the fix, `z.coerce.date().optional()`
 * silently turned an explicit `startsAt: null` / `endsAt: null` into
 * `new Date(0)` (1970-01-01T00:00:00.000Z) because `z.coerce.date()` runs
 * `new Date(input)` before any nullability check. The fix adds `.nullable()`
 * before `.optional()` so Zod short-circuits on `null`.
 *
 * @see ../../../src/entities/social/social-content-batch.schema.ts
 * @see ./social-campaign.schema.test.ts
 */
import { describe, expect, it } from 'vitest';
import { SocialContentBatchSchema } from '../../../src/entities/social/social-content-batch.schema.js';

const MOCK_UUID = '00000000-0000-4000-8000-000000000002';

function buildValidBatch(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_UUID,
        name: 'Hospeda Launch 2026-06',
        slug: 'hospeda-launch-2026-06',
        description: 'Batch description',
        active: true,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-30T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdById: MOCK_UUID,
        updatedById: MOCK_UUID,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

describe('SocialContentBatchSchema — startsAt/endsAt null handling', () => {
    it('keeps startsAt as null when parsing an explicit null (not the Unix epoch)', () => {
        const result = SocialContentBatchSchema.safeParse(buildValidBatch({ startsAt: null }));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeNull();
            // Regression guard: the pre-fix bug coerced null -> new Date(0).
            expect(result.data.startsAt).not.toEqual(new Date(0));
        }
    });

    it('keeps endsAt as null when parsing an explicit null (not the Unix epoch)', () => {
        const result = SocialContentBatchSchema.safeParse(buildValidBatch({ endsAt: null }));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.endsAt).toBeNull();
            expect(result.data.endsAt).not.toEqual(new Date(0));
        }
    });

    it('keeps both startsAt and endsAt as null simultaneously', () => {
        const result = SocialContentBatchSchema.safeParse(
            buildValidBatch({ startsAt: null, endsAt: null })
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeNull();
            expect(result.data.endsAt).toBeNull();
        }
    });

    it('still coerces a real date string for startsAt/endsAt', () => {
        const result = SocialContentBatchSchema.safeParse(
            buildValidBatch({
                startsAt: '2026-06-01T00:00:00.000Z',
                endsAt: '2026-06-30T00:00:00.000Z'
            })
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeInstanceOf(Date);
            expect(result.data.endsAt).toBeInstanceOf(Date);
        }
    });

    it('still allows startsAt/endsAt to be omitted entirely (optional)', () => {
        const { startsAt: _startsAt, endsAt: _endsAt, ...raw } = buildValidBatch();

        const result = SocialContentBatchSchema.safeParse(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeUndefined();
            expect(result.data.endsAt).toBeUndefined();
        }
    });
});
