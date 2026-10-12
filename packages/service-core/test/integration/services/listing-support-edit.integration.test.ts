/**
 * HOS-1493 (piece V8a, ACC:15) — action 15 edits the content of somebody
 * else's listing and nothing else, against a REAL PostgreSQL database.
 *
 * Through the SERVICE (the route half and "the row 26 notice shows in Mi
 * Cuenta" belong to later runs): an administrator holding ONLY action 15's own
 * permission corrects a text, creates a draft in the owner's name and restores
 * an archived photo. Each write keeps the listing's state, starts no trial
 * (`T1` is the owner's), records one `admin` event carrying the reason and
 * content field NAMES only, and queues the owner's email in the same
 * transaction.
 *
 * Every test runs inside `withServiceTestTransaction`, which rolls back: the
 * seeded owner, admin and listings never outlive the test, so no global
 * population (published listings, trials, subscriptions) is altered.
 */

import {
    accommodationMedia,
    accommodations,
    and,
    type DrizzleClient,
    destinations,
    domainEventModel,
    emailOutbox,
    eq,
    type SelectDomainEvent,
    trials,
    users
} from '@repo/db';
import {
    type AccommodationCreateInput,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE } from '../../../src/services/listing/listing-support-edit';
import type { Actor } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();
const REASON = 'pedido por teléfono';

/** Inserts a bare user (the administrator) and returns its id. */
async function seedUser(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    await tx.insert(users).values({
        id,
        email: `support-admin-${id.slice(0, 8)}@example.com`,
        displayName: 'Support Admin',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
    return id;
}

/** Destinations committed outside the test transaction, removed in `afterEach`. */
const committedDestinationIds: string[] = [];

/**
 * Inserts a CITY destination COMMITTED: the create path validates the
 * destination with a read outside the caller's transaction, so a destination
 * seeded inside the rolled-back test transaction is invisible to it.
 */
async function seedCommittedDestination(): Promise<string> {
    const id = crypto.randomUUID();
    const uid = id.slice(0, 8);
    await getServiceTestDb()
        .insert(destinations)
        .values({
            id,
            slug: `support-edit-dest-${uid}`,
            name: 'Support Edit Destination',
            destinationType: 'CITY',
            level: 4,
            path: `/support-edit/dest-${uid}`,
            summary: 'Support edit destination summary',
            description: 'Support edit destination description',
            location: {
                state: 'Entre Rios',
                country: 'Argentina',
                coordinates: { lat: '-32.48', long: '-58.23' }
            },
            media: {
                featuredImage: {
                    moderationState: 'APPROVED',
                    url: 'https://example.com/support-edit-destination.jpg'
                }
            },
            lifecycleState: 'ACTIVE'
        } as typeof destinations.$inferInsert);
    committedDestinationIds.push(id);
    return id;
}

/** An owner in PRE_TRIAL (no `trial` row) with one DRAFT accommodation. */
async function seedDraftOwner(tx: DrizzleClient) {
    return seedAccommodation(tx, {
        visibility: 'PRIVATE',
        publicationStatus: PublicationStatusEnum.DRAFT
    });
}

/** Action 15's own permission and nothing else of the accommodation family. */
const admin15 = (id: string): Actor => ({
    id,
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
});

async function readListing(tx: DrizzleClient, id: string) {
    const [row] = await tx
        .select({
            ownerId: accommodations.ownerId,
            description: accommodations.description,
            publicationStatus: accommodations.publicationStatus,
            deletedAt: accommodations.deletedAt
        })
        .from(accommodations)
        .where(eq(accommodations.id, id));
    return row;
}

async function readTrials(tx: DrizzleClient, userId: string) {
    return tx.select({ id: trials.id }).from(trials).where(eq(trials.userId, userId));
}

async function readSupportEmails(tx: DrizzleClient, ownerId: string) {
    return tx
        .select({ payload: emailOutbox.payload })
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, ownerId),
                eq(emailOutbox.template, LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE)
            )
        );
}

async function readEvents(tx: DrizzleClient, accommodationId: string) {
    return domainEventModel.findByEntity({
        entityType: 'accommodation',
        entityId: accommodationId,
        tx
    });
}

describe('TEST:V8a:8 action 15 edits content and nothing else', () => {
    let service: AccommodationService;

    beforeAll(() => {
        if (!dbAvailable) return;
        service = new AccommodationService({ logger: createLoggerMock() });
    });

    afterEach(async () => {
        if (!dbAvailable) return;
        const db = getServiceTestDb();
        for (const id of committedDestinationIds.splice(0)) {
            await db.delete(destinations).where(eq(destinations.id, id));
        }
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        '(a) corrects the description: same state, no trial, admin event with the reason and field names, email to the owner',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);

                // Act
                const edited = await service.update(
                    admin15(adminId),
                    accommodationId,
                    { description: 'Descripción corregida por soporte a pedido de la dueña.' },
                    { tx, actionReason: REASON }
                );

                // Assert
                expect(edited.error).toBeUndefined();
                const row = await readListing(tx, accommodationId);
                expect(row?.description).toBe(
                    'Descripción corregida por soporte a pedido de la dueña.'
                );
                expect(row?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
                expect(row?.deletedAt).toBeNull();
                expect(await readTrials(tx, ownerId)).toEqual([]);

                const events = await readEvents(tx, accommodationId);
                expect(events).toHaveLength(1);
                const event = events[0] as SelectDomainEvent;
                expect(event.eventType).toBe('listing.edited');
                expect(event.actorType).toBe('admin');
                expect(event.actorId).toBe(adminId);
                expect(event.actorId).not.toBe(ownerId);
                expect(event.reason).toBe(REASON);
                expect(event.changes).toEqual([{ field: 'description' }]);
                expect(JSON.stringify(event.changes)).not.toContain('corregida');

                const emails = await readSupportEmails(tx, ownerId);
                expect(emails).toHaveLength(1);
                expect(emails[0]?.payload).toMatchObject({
                    vertical: 'accommodation',
                    listingId: accommodationId,
                    parts: ['texts']
                });
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(b) creates a draft in the owner name: born DRAFT, owned by her, admin created event and email',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const destinationId = await seedCommittedDestination();
                const ownerId = await seedUser(tx);
                const adminId = await seedUser(tx);
                const input = {
                    name: 'Cabaña creada por soporte',
                    slug: `support-created-${crypto.randomUUID().slice(0, 8)}`,
                    summary: 'Ficha creada por soporte a nombre de la dueña',
                    description: 'Borrador que soporte le crea a la dueña a su pedido.',
                    type: 'CABIN',
                    ownerId,
                    destinationId,
                    location: {
                        state: 'Entre Rios',
                        country: 'Argentina',
                        coordinates: { lat: '-32.48', long: '-58.23' }
                    },
                    lifecycleState: 'DRAFT',
                    visibility: 'PRIVATE'
                } as unknown as AccommodationCreateInput;

                // Act
                const created = await service.create(admin15(adminId), input, {
                    tx,
                    actionReason: REASON
                });

                // Assert
                expect(created.error).toBeUndefined();
                const listingId = created.data?.id as string;
                const row = await readListing(tx, listingId);
                expect(row?.ownerId).toBe(ownerId);
                expect(row?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
                expect(await readTrials(tx, ownerId)).toEqual([]);

                const events = await readEvents(tx, listingId);
                expect(events).toHaveLength(1);
                expect(events[0]).toMatchObject({
                    eventType: 'listing.created',
                    actorType: 'admin',
                    actorId: adminId,
                    reason: REASON
                });
                const emails = await readSupportEmails(tx, ownerId);
                expect(emails).toHaveLength(1);
                expect(emails[0]?.payload).toMatchObject({ listingId });
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(c) restores an archived photo: stays DRAFT, admin event on media, email with the photos part',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);
                const [media] = await tx
                    .insert(accommodationMedia)
                    .values({
                        accommodationId,
                        url: 'https://cdn.example.com/archived.jpg',
                        state: 'archived',
                        archivedAt: new Date(),
                        sortOrder: 0
                    } as typeof accommodationMedia.$inferInsert)
                    .returning({ id: accommodationMedia.id });

                // Act
                const restored = await service.restoreMedia(
                    admin15(adminId),
                    { accommodationId, mediaId: media?.id as string },
                    { tx }
                );

                // Assert
                expect(restored.error).toBeUndefined();
                const row = await readListing(tx, accommodationId);
                expect(row?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
                expect(row?.deletedAt).toBeNull();

                const events = await readEvents(tx, accommodationId);
                expect(events).toHaveLength(1);
                expect(events[0]).toMatchObject({
                    eventType: 'listing.edited',
                    actorType: 'admin',
                    actorId: adminId,
                    changes: [{ field: 'media' }]
                });
                const emails = await readSupportEmails(tx, ownerId);
                expect(emails).toHaveLength(1);
                expect(emails[0]?.payload).toMatchObject({ parts: ['photos'] });
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(d) the owner editing her own listing still records an owner act and queues no support email',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const owner: Actor = {
                    id: ownerId,
                    roles: [RoleEnum.HOST],
                    permissions: [
                        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
                    ]
                };

                // Act
                const edited = await service.update(
                    owner,
                    accommodationId,
                    { description: 'La dueña edita su propia descripción.' },
                    { tx, actionReason: REASON }
                );

                // Assert
                expect(edited.error).toBeUndefined();
                const events = await readEvents(tx, accommodationId);
                expect(events).toHaveLength(1);
                expect(events[0]).toMatchObject({ actorType: 'owner', actorId: ownerId });
                expect(await readSupportEmails(tx, ownerId)).toEqual([]);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(e) a foreign admin WITHOUT the action 15 permission writes no admin event and no email',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);
                const adminAny: Actor = {
                    id: adminId,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
                };

                // Act
                const edited = await service.update(
                    adminAny,
                    accommodationId,
                    { description: 'Un admin sin la acción 15 edita la descripción.' },
                    { tx, actionReason: REASON }
                );

                // Assert
                expect(edited.error).toBeUndefined();
                const events = await readEvents(tx, accommodationId);
                expect(events.filter((e) => e.actorType === 'admin')).toEqual([]);
                expect(await readSupportEmails(tx, ownerId)).toEqual([]);
            });
        }
    );
});
