import { accommodations, domainEvent, eq, getDb } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingPublicationModel } from '../../../../../packages/db/src/models/listing/listing-publication.model';
import { ListingPublicationService } from '../../../src/services/listing-publication/listing-publication.service';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createMockActor } from '../../helpers/auth';
import {
    createDestination,
    createListing,
    createOwner,
    ensureAccommodationCatalog,
    MATRIX_NOW,
    publicationControls,
    resetPublicationControls
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

describe('HOS-2001 a foreign actor reaching the publication service never writes an owner publish', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        injectClock({ clock: { now: () => MATRIX_NOW } });
    });
    beforeEach(async () => {
        await testDb.clean();
        await ensureAccommodationCatalog();
        resetPublicationControls();
        publicationControls.covered = true;
    });
    afterAll(async () => {
        await testDb.clean();
        await testDb.teardown();
    });

    it('an administrator is refused NOT_FOUND and the restoration instants stay the same', async () => {
        // Arrange
        const owner = await createOwner();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId: await createDestination(),
            status: PublicationStatusEnum.DRAFT
        });
        const actor = createMockActor(RoleEnum.ADMIN, [
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
        ]);
        const before = await listingPublicationModel.readPublicationInstants({
            tx: getDb(),
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: [listingId]
        });

        // Act
        const result = new ListingPublicationService().publish({ actor, id: listingId });

        // Assert
        await expect(result).rejects.toMatchObject({ code: 'NOT_FOUND' });
        const [listing] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, listingId));
        const after = await listingPublicationModel.readPublicationInstants({
            tx: getDb(),
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: [listingId]
        });
        const events = await getDb()
            .select({ id: domainEvent.id })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listingId));
        expect(listing?.status).toBe(PublicationStatusEnum.DRAFT);
        expect(after).toEqual(before);
        expect(events).toEqual([]);
    });

    it('the owner still publishes and the event records the owner', async () => {
        // Arrange
        const owner = await createOwner();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId: await createDestination(),
            status: PublicationStatusEnum.DRAFT
        });
        const actor = createMockActor(RoleEnum.USER, [], owner.id);

        // Act
        const published = await new ListingPublicationService().publish({ actor, id: listingId });

        // Assert
        expect(published).toMatchObject({ publicationStatus: PublicationStatusEnum.PUBLISHED });
        const [eventRow] = await getDb()
            .select({ actorType: domainEvent.actorType, actorId: domainEvent.actorId })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listingId));
        expect(eventRow).toMatchObject({ actorType: 'owner', actorId: owner.id });
        const instants = await listingPublicationModel.readPublicationInstants({
            tx: getDb(),
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: [listingId]
        });
        expect(instants.has(listingId)).toBe(true);
    });
});
