import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { clock, listingId, makeHarness, userId, vertical } from './support';

describe('covered coverage surplus branches', () => {
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
