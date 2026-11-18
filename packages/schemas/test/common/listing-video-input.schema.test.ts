import { describe, expect, it } from 'vitest';
import {
    LISTING_VIDEOS_MAX,
    ListingVideoInputSchema,
    ListingVideosInputSchema,
    VenueOwnerCreateInputSchema,
    VenueOwnerUpdateInputSchema
} from '../../src/index.js';

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('ListingVideoInputSchema (HOS-2258)', () => {
    it('accepts an http(s) url with an optional 3-100 char caption', () => {
        expect(ListingVideoInputSchema.safeParse({ url: YT }).success).toBe(true);
        expect(ListingVideoInputSchema.safeParse({ url: YT, caption: 'Terraza' }).success).toBe(
            true
        );
    });

    it('rejects a non-http url and an out-of-range caption', () => {
        expect(ListingVideoInputSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(
            false
        );
        expect(ListingVideoInputSchema.safeParse({ url: YT, caption: 'ab' }).success).toBe(false);
        expect(
            ListingVideoInputSchema.safeParse({ url: YT, caption: 'x'.repeat(101) }).success
        ).toBe(false);
    });
});

describe('ListingVideosInputSchema (HOS-2258)', () => {
    it('stamps APPROVED on every entry', () => {
        const result = ListingVideosInputSchema.parse([{ url: YT }]);

        expect(result).toEqual([{ url: YT, moderationState: 'APPROVED' }]);
    });

    it('ignores a moderationState sent by the client (AC-6)', () => {
        const result = ListingVideosInputSchema.parse([{ url: YT, moderationState: 'REJECTED' }]);

        expect(result[0]?.moderationState).toBe('APPROVED');
    });

    it('accepts exactly the cap and rejects one more (AC-7)', () => {
        const at = Array.from({ length: LISTING_VIDEOS_MAX }, () => ({ url: YT }));
        const over = Array.from({ length: LISTING_VIDEOS_MAX + 1 }, () => ({ url: YT }));

        expect(LISTING_VIDEOS_MAX).toBe(6);
        expect(ListingVideosInputSchema.safeParse(at).success).toBe(true);
        expect(ListingVideosInputSchema.safeParse(over).success).toBe(false);
    });

    it('is idempotent: re-parsing its own output keeps the value', () => {
        const once = ListingVideosInputSchema.parse([{ url: YT, caption: 'Terraza' }]);

        expect(ListingVideosInputSchema.parse(once)).toEqual(once);
    });

    it('is what the venue owner update schema uses for videos', () => {
        const over = Array.from({ length: 7 }, () => ({ url: YT }));

        expect(VenueOwnerUpdateInputSchema.safeParse({ videos: over }).success).toBe(false);
        expect(
            VenueOwnerUpdateInputSchema.parse({
                videos: [{ url: YT, moderationState: 'REJECTED' }]
            }).videos?.[0]?.moderationState
        ).toBe('APPROVED');
    });

    it('accepts videos: null on the owner PATCH (an explicit clear)', () => {
        expect(VenueOwnerUpdateInputSchema.safeParse({ videos: null }).success).toBe(true);
    });

    it('applies the same cap and APPROVED stamp on owner CREATE', () => {
        const base = {
            name: 'Local',
            summary: 'A good local venue summary.',
            description: 'A detailed description of this local venue for visitors.',
            type: 'CAFE'
        };
        const over = Array.from({ length: 7 }, () => ({ url: YT }));

        expect(VenueOwnerCreateInputSchema.safeParse({ ...base, videos: over }).success).toBe(
            false
        );
        const ok = VenueOwnerCreateInputSchema.safeParse({
            ...base,
            videos: [{ url: YT, moderationState: 'REJECTED' }]
        });
        expect(ok.data?.videos?.[0]?.moderationState).toBe('APPROVED');
    });
});
