/**
 * Regression tests for SocialCampaignSchema's `startsAt`/`endsAt` fields
 * (bug fix: `null` was coerced to the Unix epoch instead of staying `null`).
 *
 * Before the fix, `startsAt`/`endsAt` were declared as `z.coerce.date().optional()`.
 * `z.coerce.date()` runs `new Date(input)` before any nullability check, and
 * `new Date(null)` resolves to `new Date(0)` (1970-01-01T00:00:00.000Z) instead
 * of throwing or passing `null` through — so a campaign explicitly saved with
 * `startsAt: null` (e.g. "no start date configured") silently became the Unix
 * epoch, which then rendered as a real (wrong) date in the admin UI.
 *
 * The fix adds `.nullable()` before `.optional()` so Zod short-circuits on
 * `null` and returns it unchanged, without ever calling the date coercion.
 *
 * @see ../../../src/entities/social/social-campaign.schema.ts
 */
import { describe, expect, it } from 'vitest';
import { SocialCampaignSchema } from '../../../src/entities/social/social-campaign.schema.js';

const MOCK_UUID = '00000000-0000-4000-8000-000000000001';

function buildValidCampaign(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_UUID,
        name: 'Institucional Hospeda',
        slug: 'institucional-hospeda',
        description: 'Campaign description',
        active: true,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-12-31T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdById: MOCK_UUID,
        updatedById: MOCK_UUID,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

describe('SocialCampaignSchema — startsAt/endsAt null handling', () => {
    it('keeps startsAt as null when parsing an explicit null (not the Unix epoch)', () => {
        const result = SocialCampaignSchema.safeParse(buildValidCampaign({ startsAt: null }));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeNull();
            // Regression guard: the pre-fix bug coerced null -> new Date(0).
            expect(result.data.startsAt).not.toEqual(new Date(0));
        }
    });

    it('keeps endsAt as null when parsing an explicit null (not the Unix epoch)', () => {
        const result = SocialCampaignSchema.safeParse(buildValidCampaign({ endsAt: null }));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.endsAt).toBeNull();
            expect(result.data.endsAt).not.toEqual(new Date(0));
        }
    });

    it('keeps both startsAt and endsAt as null simultaneously', () => {
        const result = SocialCampaignSchema.safeParse(
            buildValidCampaign({ startsAt: null, endsAt: null })
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeNull();
            expect(result.data.endsAt).toBeNull();
        }
    });

    it('still coerces a real date string for startsAt/endsAt', () => {
        const result = SocialCampaignSchema.safeParse(
            buildValidCampaign({
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
        const { startsAt: _startsAt, endsAt: _endsAt, ...raw } = buildValidCampaign();

        const result = SocialCampaignSchema.safeParse(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.startsAt).toBeUndefined();
            expect(result.data.endsAt).toBeUndefined();
        }
    });
});
