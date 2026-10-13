/**
 * HOS-1493 (V8a, ACC:15) — through the SERVICE, against real PostgreSQL: action
 * 15 (only inside the authorization a route grants, bound to the owner) edits
 * content and nothing else: same state, no trial, one `admin` event with the
 * reason and field NAMES, the owner's email in the same transaction. Every test
 * rolls back (`withServiceTestTransaction`); committed destinations are removed
 * in `afterEach`, so no global population is altered.
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
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import { LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE } from '../../../src/services/listing/listing-support-edit';
import type { Actor } from '../../../src/types';
import { runWithAdministrativeAuthorization } from '../../../src/utils/administrative-authorization';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    seedGastronomy,
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

const committedDestinationIds: string[] = [];

/** A COMMITTED city: the create path checks the destination outside the caller tx. */
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
        publicationStatus: PublicationStatusEnum.DRAFT
    });
}

/** Runs a call as an action-15 route does: inside the authorization granted for the owner. */
const asAction15 = <T>(ownerId: string, run: () => Promise<T>): Promise<T> =>
    runWithAdministrativeAuthorization({
        authorization: { action: 'ACC_15', subjectId: ownerId },
        run
    });

/** Action 15's own permission and nothing else of the accommodation family. */
const admin15 = (id: string): Actor => ({
    id,
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
});

/** The error code of a service call, whether it answered an envelope or threw (inside a caller tx). */
async function errorCodeOf(call: Promise<{ readonly error?: { readonly code: string } }>) {
    try {
        return (await call).error?.code;
    } catch (error) {
        return (error as { readonly code?: string }).code;
    }
}

async function readListing(tx: DrizzleClient, id: string) {
    const [row] = await tx
        .select({
            ownerId: accommodations.ownerId,
            slug: accommodations.slug,
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
    let gastronomyService: GastronomyService;

    beforeAll(() => {
        if (!dbAvailable) return;
        service = new AccommodationService({ logger: createLoggerMock() });
        gastronomyService = new GastronomyService({ logger: createLoggerMock() });
    });

    afterEach(async () => {
        if (!dbAvailable) return;
        const db = getServiceTestDb();
        for (const id of committedDestinationIds.splice(0)) {
            await db.delete(destinations).where(eq(destinations.id, id));
        }
    });

    afterAll(async () => {
        if (dbAvailable) await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        '(a) corrects the description: same state, no trial, admin event with the reason and field names, email to the owner',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);

                // Act
                const edited = await asAction15(ownerId, () =>
                    service.update(
                        admin15(adminId),
                        accommodationId,
                        { description: 'Descripción corregida por soporte a pedido de la dueña.' },
                        { tx, actionReason: REASON }
                    )
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
                    publicationStatus: PublicationStatusEnum.DRAFT
                } as unknown as AccommodationCreateInput;

                // Act
                const created = await asAction15(ownerId, () =>
                    service.create(admin15(adminId), input, { tx, actionReason: REASON })
                );

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
                const restored = await asAction15(ownerId, () =>
                    service.restoreMedia(
                        admin15(adminId),
                        { accommodationId, mediaId: media?.id as string },
                        { tx }
                    )
                );
                expect(restored.error).toBeUndefined();
                const row = await readListing(tx, accommodationId);
                expect(row?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);

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
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const owner: Actor = {
                    id: ownerId,
                    roles: [RoleEnum.HOST],
                    permissions: [
                        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
                    ]
                };
                const edited = await service.update(
                    owner,
                    accommodationId,
                    { description: 'La dueña edita su propia descripción.' },
                    { tx, actionReason: REASON }
                );
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
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);
                const adminAny: Actor = {
                    id: adminId,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
                };
                const edited = await service.update(
                    adminAny,
                    accommodationId,
                    { description: 'Un admin sin la acción 15 edita la descripción.' },
                    { tx, actionReason: REASON }
                );
                expect(edited.error).toBeUndefined();
                const events = await readEvents(tx, accommodationId);
                expect(events.filter((e) => e.actorType === 'admin')).toEqual([]);
                expect(await readSupportEmails(tx, ownerId)).toEqual([]);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(f) the action 15 permission alone, without the route authorization, edits nothing',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);

                const code = await errorCodeOf(
                    service.update(
                        admin15(adminId),
                        accommodationId,
                        { description: 'Intento sin la autorización de la ruta.' },
                        { tx }
                    )
                );

                expect(['FORBIDDEN', 'NOT_FOUND']).toContain(code);
                expect((await readListing(tx, accommodationId))?.description).not.toBe(
                    'Intento sin la autorización de la ruta.'
                );
                expect(await readEvents(tx, accommodationId)).toEqual([]);
                expect(await readSupportEmails(tx, ownerId)).toEqual([]);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(g) through action 15, non-content fields and refreshSlugFromName are refused, and a rename keeps the slug',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId: ownerId, accommodationId } = await seedDraftOwner(tx);
                const adminId = await seedUser(tx);

                // A never-published draft (seeded DRAFT): the one whose rename
                // would move the slug.
                const before = await readListing(tx, accommodationId);
                const update = (data: Record<string, unknown>) =>
                    errorCodeOf(
                        asAction15(ownerId, () =>
                            service.update(admin15(adminId), accommodationId, data as never, {
                                tx
                            })
                        )
                    );

                expect(
                    await update({
                        description: 'Texto nuevo de soporte que no debería escribirse nunca.',
                        // A non-content field the update schema still accepts. The
                        // state columns no longer reach this gate: the update schema
                        // has none since V6.9b (HOS-1641) and strips a smuggled one.
                        type: 'CABIN'
                    })
                ).toBe('FORBIDDEN');
                expect(await update({ name: 'Cabaña renombrada', refreshSlugFromName: true })).toBe(
                    'FORBIDDEN'
                );
                expect((await readListing(tx, accommodationId))?.description).toBe(
                    before?.description
                );
                expect(await readEvents(tx, accommodationId)).toEqual([]);
                expect(await readSupportEmails(tx, ownerId)).toEqual([]);

                expect(await update({ name: 'Cabaña renombrada por soporte' })).toBeUndefined();
                const after = await readListing(tx, accommodationId);
                expect(after?.slug).toBe(before?.slug);
                expect(after?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        '(h) gastronomy: action 15 edits content, and refuses a non-content field',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, gastronomyId } = await seedGastronomy(tx);
                const adminId = await seedUser(tx);

                const refusedCode = await errorCodeOf(
                    asAction15(ownerId, () =>
                        gastronomyService.update(
                            admin15(adminId),
                            gastronomyId,
                            { type: 'PARRILLA' } as never,
                            { tx }
                        )
                    )
                );
                const edited = await asAction15(ownerId, () =>
                    gastronomyService.update(
                        admin15(adminId),
                        gastronomyId,
                        { description: 'Descripción de la parrilla corregida por soporte.' },
                        { tx, actionReason: REASON }
                    )
                );

                expect(refusedCode).toBe('FORBIDDEN');
                expect(edited.error).toBeUndefined();
                const events = await domainEventModel.findByEntity({
                    entityType: 'gastronomy',
                    entityId: gastronomyId,
                    tx
                });
                expect(events).toHaveLength(1);
                expect(events[0]).toMatchObject({
                    actorType: 'admin',
                    actorId: adminId,
                    reason: REASON,
                    changes: [{ field: 'description' }]
                });
                expect(await readSupportEmails(tx, ownerId)).toHaveLength(1);
            });
        }
    );
});
