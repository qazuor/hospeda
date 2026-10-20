import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { OWNER_ADMITTING_STATES } from '../../src/authorization/listing-operation';
import { publishListing } from '../../src/publication/publish-listing';
import { clock, emailPseudonym, event, listingId, makeHarness, userId, vertical } from './support';

describe('moderated owner operations', () => {
    it('TEST:V6:11 admits read, export, edit and delete but not publish', () => {
        for (const operation of ['READ_OWN', 'EXPORT', 'EDIT', 'DELETE'] as const)
            expect(OWNER_ADMITTING_STATES[operation]).toContain(Status.MODERATED);
        expect(OWNER_ADMITTING_STATES.PUBLISH).not.toContain(Status.MODERATED);
    });

    it('TEST:V6:11 refuses PB1 from MODERATED', async () => {
        const harness = makeHarness({ status: Status.MODERATED });
        const result = await publishListing({
            ...harness,
            clock,
            userId,
            vertical,
            listingId,
            event,
            emailPseudonym,
            correlationId: listingId
        });
        expect(result).toMatchObject({ published: false });
        expect(harness.getStatus()).toBe(Status.MODERATED);
    });
});
