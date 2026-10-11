import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { unpublishListing } from '../../src/publication/unpublish-listing';
import { clock, listingId, makeHarness, userId, vertical } from './support';

describe('PB6 and coverage recalculation (AC:V6:1, AC:V6:4)', () => {
    it('PB6 moves PUBLISHED to DRAFT under lock without touching trial', async () => {
        const harness = makeHarness({ status: PublicationStatusEnum.PUBLISHED });
        const result = await unpublishListing({
            ...harness,
            clock,
            userId,
            vertical,
            listingId,
            correlationId: listingId
        });
        expect(result).toMatchObject({ unpublished: true });
        expect(harness.getStatus()).toBe(PublicationStatusEnum.DRAFT);
        expect(harness.calls).toEqual(['lock', 'read', 'set', 'event', 'commit', 'revalidate']);
    });

    it('TEST:V6:4 PB2 lowers without coverage and stamps the loss fact', async () => {
        const harness = makeHarness({ status: PublicationStatusEnum.PUBLISHED, covered: false });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result).toMatchObject({
            lowered: [listingId],
            loweredBySurplus: [],
            restored: [],
            stamped: [listingId]
        });
        expect(harness.getStatus()).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        expect(harness.calls).toEqual([
            'lock',
            'list',
            'set',
            'event',
            'commit',
            'invalidate',
            'revalidate'
        ]);
    });

    it('TEST:V6:5 PB3 restores one billing-lowered listing when covered', async () => {
        const harness = makeHarness({ status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: listingId
        });
        expect(result).toMatchObject({
            lowered: [],
            loweredBySurplus: [],
            restored: [listingId],
            stamped: [listingId]
        });
        expect(harness.getStatus()).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.calls).toEqual([
            'lock',
            'list',
            'declaredLimit',
            'instants',
            'stamp',
            'set',
            'event',
            'enqueueRestitutionNotice',
            'commit',
            'invalidate',
            'revalidate'
        ]);
    });

    it('never runs effects if the transaction rolls back', async () => {
        const harness = makeHarness({
            status: PublicationStatusEnum.PUBLISHED,
            covered: false,
            failTransaction: true
        });
        await expect(
            recalculateCoverage({ ...harness, clock, userId, vertical, correlationId: listingId })
        ).rejects.toThrow('rollback');
        expect(harness.calls).not.toContain('invalidate');
        expect(harness.calls).not.toContain('revalidate');
    });
});
