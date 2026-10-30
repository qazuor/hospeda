import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { at, clock, listingId, makeHarness, userId, vertical } from './support';

describe('TEST:V6:10 PB7', () => {
    it('TEST:V6:10 returns a public-origin archive and never returns one archived from DRAFT', async () => {
        const draftOriginId = '00000000-0000-4000-8000-000000000003';
        const harness = makeHarness({
            covered: true,
            limit: 1,
            status: PublicationStatusEnum.ARCHIVED,
            listings: [
                {
                    id: listingId,
                    ownerId: userId,
                    publicationStatus: PublicationStatusEnum.ARCHIVED,
                    createdAt: at,
                    inactiveSince: at
                },
                {
                    id: draftOriginId,
                    ownerId: userId,
                    publicationStatus: PublicationStatusEnum.ARCHIVED,
                    createdAt: at,
                    inactiveSince: at
                }
            ],
            archiveOrigins: new Map([
                [listingId, PublicationStatusEnum.PUBLISHED],
                [draftOriginId, PublicationStatusEnum.DRAFT]
            ])
        });
        const result = await recalculateCoverage({
            ...harness,
            clock,
            userId,
            vertical,
            correlationId: 'pb7'
        });
        expect(result.restoredFromArchived).toEqual([listingId]);
        expect(harness.getStatus()).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.calls).toContain('event');
    });
});
