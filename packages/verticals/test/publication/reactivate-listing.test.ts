import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { reactivateListing } from '../../src/publication/reactivate-listing';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

describe('TEST:V6:10 PB8', () => {
    it('TEST:V6:10 reactivates ARCHIVED to DRAFT with an owner event and no revalidation', async () => {
        const harness = makeHarness({ status: PublicationStatusEnum.ARCHIVED });
        const result = await reactivateListing({
            ...harness,
            clock,
            vertical,
            listingId,
            userId,
            correlationId: 'pb8'
        });
        expect(result).toEqual({ reactivated: true });
        expect(harness.getStatus()).toBe(PublicationStatusEnum.DRAFT);
        expect(harness.calls).toContain('event');
        expect(harness.calls).not.toContain('revalidate');
        expect(at).toEqual(clock.now());
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.MODERATED,
        PublicationStatusEnum.PURGED
    ])('TEST:V6:10 rejects source status %s', async (status) => {
        const harness = makeHarness({ status });
        await expect(
            reactivateListing({
                ...harness,
                clock,
                vertical,
                listingId,
                userId,
                correlationId: 'pb8-invalid'
            })
        ).resolves.toEqual({ reactivated: false, reason: 'INVALID_FROM' });
        expect(harness.calls).not.toContain('set');
    });
});
