/** @file TEST:1729:6 per-vertical server publish decisions and fail-closed reads. */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveListingPublishAffordances } from '../../../src/lib/listing/listing-publish-affordance';
import type { OwnerListingSummaryWithState } from '../../../src/lib/listing/owner-listings';

const listing = (
    vertical: 'venue' | 'experience',
    publicationStatus = PublicationStatusEnum.DRAFT
) =>
    ({
        id: vertical,
        vertical,
        publicationStatus,
        isPublic: false
    }) as OwnerListingSummaryWithState;
const destination = (value: 'PUBLISH' | 'CHECKOUT' | 'NO_PLANS_AVAILABLE') => ({
    ok: true as const,
    data: { destination: value, ...(value === 'PUBLISH' ? { trialDays: 30 } : {}) }
});

describe('resolveListingPublishAffordances — TEST:1729:6', () => {
    it('resolves each listed draft vertical from its own destination read', async () => {
        const subscribeDestination = vi.fn(({ vertical }: { vertical: string }) =>
            Promise.resolve(vertical === 'venue' ? destination('PUBLISH') : destination('CHECKOUT'))
        );
        const result = await resolveListingPublishAffordances({
            listings: [listing('gastronomy'), listing('experience')],
            cookieHeader: 'session=x',
            api: { subscribeDestination } as never
        });
        expect(subscribeDestination).toHaveBeenCalledTimes(2);
        expect(result.get('gastronomy')).toMatchObject({ kind: 'publish', trialDays: 30 });
        expect(result.get('experience')).toMatchObject({ kind: 'checkout', canPublish: false });
    });

    it('uses unknown for rejected results, thrown reads, and missing cookie', async () => {
        const failed = await resolveListingPublishAffordances({
            listings: [listing('gastronomy')],
            cookieHeader: 'session=x',
            api: {
                subscribeDestination: vi
                    .fn()
                    .mockResolvedValue({ ok: false, error: { status: 500 } })
            } as never
        });
        const thrown = await resolveListingPublishAffordances({
            listings: [listing('gastronomy')],
            cookieHeader: 'session=x',
            api: { subscribeDestination: vi.fn().mockRejectedValue(new Error('offline')) } as never
        });
        const noCookieApi = vi.fn();
        const noCookie = await resolveListingPublishAffordances({
            listings: [listing('gastronomy')],
            api: { subscribeDestination: noCookieApi } as never
        });
        for (const result of [failed, thrown, noCookie])
            expect(result.get('gastronomy')).toMatchObject({ kind: 'unknown' });
        expect(noCookieApi).not.toHaveBeenCalled();
    });

    it('does not read a vertical with no drafts', async () => {
        const subscribeDestination = vi.fn();
        const result = await resolveListingPublishAffordances({
            listings: [listing('experience', PublicationStatusEnum.PUBLISHED)],
            cookieHeader: 'session=x',
            api: { subscribeDestination } as never
        });
        expect(subscribeDestination).not.toHaveBeenCalled();
        expect(result.size).toBe(0);
    });
});
