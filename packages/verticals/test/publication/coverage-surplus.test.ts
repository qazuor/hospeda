import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { clock, listingId, makeHarness, userId, vertical } from './support';

describe('covered coverage surplus branches', () => {
    it('TEST:B8b:15 applies the keep selection to the V6 lowering choice', async () => {
        const listings = ['old', 'middle', 'new'].map((id, index) => ({
            id,
            ownerId: userId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            createdAt: new Date(`2020-01-0${index + 1}T00:00:00Z`),
            inactiveSince: clock.now()
        }));
        const harness = makeHarness({
            listings,
            limit: 2,
            publicationInstants: new Map(
                listings.map((row, index) => [row.id, new Date(`2021-01-0${index + 1}T00:00:00Z`)])
            )
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId,
            keepListingIds: new Set(['middle', 'new'])
        });
        expect(result.loweredBySurplus).toEqual(['old']);
        expect(['old', 'middle', 'new'].map((id) => harness.statusOf(id))).toEqual([
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.PUBLISHED,
            PublicationStatusEnum.PUBLISHED
        ]);
    });

    it('TEST:V6:5 lowers an over-limit listing without stamping or restoring it in the same pass', async () => {
        const harness = makeHarness({ status: PublicationStatusEnum.PUBLISHED, limit: 0 });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.lowered).toEqual([listingId]);
        expect(result.loweredBySurplus).toEqual([listingId]);
        expect(result.restored).toEqual([]);
        expect(result.stamped).toEqual([]);
        expect(harness.getStatus()).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        expect(harness.calls).not.toContain('stamp');
        expect(harness.calls).toContain('event');
    });

    it('TEST:V6:5 does not lower a listing when the limit has room', async () => {
        const harness = makeHarness({ status: PublicationStatusEnum.PUBLISHED, limit: 1 });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.loweredBySurplus).toEqual([]);
        expect(result.restored).toEqual([]);
        expect(harness.getStatus()).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V6:5 skips a lost conditional change without writing an event', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            limit: 0,
            setReturnsFalse: true
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.loweredBySurplus).toEqual([]);
        expect(harness.calls).not.toContain('event');
    });

    it('TEST:V6:5 leaves listings unchanged when the declared limit is unknown', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            declaredLimit: null
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result.loweredBySurplus).toEqual([]);
        expect(result.restored).toEqual([]);
        expect(result.stamped).toEqual([listingId]);
        expect(harness.getStatus()).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V6:4 does not run post-commit effects after rollback', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            limit: 0,
            failTransaction: true
        });
        await expect(
            recalculateCoverage({ ...harness, clock, userId, vertical, correlationId: listingId })
        ).rejects.toThrow('rollback');
        expect(harness.calls).not.toContain('invalidate');
        expect(harness.calls).not.toContain('revalidate');
    });
});
