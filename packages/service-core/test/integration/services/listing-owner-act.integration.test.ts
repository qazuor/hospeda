/**
 * HOS-1499 (piece V9a) — the register of the owner's acts on a listing,
 * against a REAL PostgreSQL database.
 *
 * Creating and editing a listing write one `domain_event` row each, in the
 * same transaction as the change, with the minimum fields of NUCLEO/08 §1.2;
 * content fields carry only their name, so no event ever holds listing text.
 *
 * AC:V9a:1 is PARTIAL in this PR: "exportar" has no operation in the codebase
 * yet (owner decision pending on which piece builds it), so only create and
 * edit are covered here. Nothing writes `listing.exported`.
 *
 * Every test runs inside `withServiceTestTransaction`, which rolls back.
 */

import { domainEventModel, type SelectDomainEvent } from '@repo/db';
import {
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    GastronomyTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    seedAccommodation,
    seedExperience,
    seedGastronomy,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** An owner actor for the three verticals. `id` must be the seeded owner. */
function ownerActor(userId: string): Actor {
    return {
        id: userId,
        roles: [RoleEnum.HOST, RoleEnum.GASTRONOMY_OWNER, RoleEnum.EXPERIENCE_OWNER],
        permissions: [
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.GASTRONOMY_EDIT_OWN,
            PermissionEnum.EXPERIENCE_EDIT_OWN
        ]
    };
}

/** Asserts the minimum fields of NUCLEO/08 §1.2 on one owner-act event. */
function expectMinimumFields(input: {
    readonly event: SelectDomainEvent;
    readonly eventType: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly ownerId: string;
}): void {
    const { event } = input;
    expect(event.eventType).toBe(input.eventType);
    expect(event.entityType).toBe(input.entityType);
    expect(event.entityId).toBe(input.entityId);
    expect(event.actorId).toBe(input.ownerId);
    expect(event.actorType).toBe('owner');
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.correlationId).toMatch(UUID_RE);
    expect(Array.isArray(event.changes)).toBe(true);
}

describe('HOS-1499 V9a — owner acts on a listing land in domain_event (integration)', () => {
    let accommodationService: AccommodationService;
    let gastronomyService: GastronomyService;
    let experienceService: ExperienceService;

    beforeAll(() => {
        if (!dbAvailable) return;
        const config = { logger: createLoggerMock() };
        accommodationService = new AccommodationService(config);
        gastronomyService = new GastronomyService(config);
        experienceService = new ExperienceService(config);
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    // TEST:V9a:1 — AC:V9a:1 (create + edit; export pending, see header)
    it.skipIf(!dbAvailable)(
        'TEST:V9a:1 — gastronomy: creating and editing write one event each, with the minimum fields',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, destinationId } = await seedGastronomy(tx);
                const actor = ownerActor(ownerId);
                const correlationId = crypto.randomUUID();
                const ctx: ServiceContext = { tx, correlationId };

                const created = await gastronomyService.createForOwner(
                    actor,
                    {
                        name: 'Parrilla del Dueño',
                        summary: 'Resumen de la parrilla del dueño',
                        description: 'Descripción de la parrilla creada por su dueño.',
                        type: GastronomyTypeEnum.PARRILLA,
                        ownerId: ownerId as Uuid,
                        destinationId: destinationId as Uuid,
                        visibility: VisibilityEnum.PRIVATE,
                        lifecycleState: LifecycleStatusEnum.DRAFT,
                        moderationState: ModerationStatusEnum.PENDING,
                        averageRating: 0,
                        reviewsCount: 0
                    },
                    ctx
                );
                expect(created.error).toBeUndefined();
                const listingId = created.data?.id as string;

                const edited = await gastronomyService.updateOwn(
                    listingId,
                    { summary: 'Un resumen editado por el dueño' },
                    actor,
                    ctx
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'gastronomy',
                    entityId: listingId,
                    tx
                });
                expect(events.map((e) => e.eventType)).toEqual([
                    'listing.created',
                    'listing.edited'
                ]);
                for (const event of events) {
                    expectMinimumFields({
                        event,
                        eventType: event.eventType,
                        entityType: 'gastronomy',
                        entityId: listingId,
                        ownerId
                    });
                    expect(event.correlationId).toBe(correlationId);
                }
                expect(events[1]?.changes).toEqual([{ field: 'summary' }]);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:1 — experience: creating and editing write one event each, with the minimum fields',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, destinationId } = await seedExperience(tx);
                const actor = ownerActor(ownerId);
                const ctx: ServiceContext = { tx };

                const created = await experienceService.createForOwner(
                    actor,
                    {
                        name: 'Kayak del Dueño',
                        summary: 'Resumen del kayak del dueño',
                        description: 'Descripción del kayak creado por su dueño.',
                        type: ExperienceTypeEnum.KAYAK_RENTAL,
                        priceFrom: 150000,
                        priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
                        isPriceOnRequest: false,
                        ownerId: ownerId as Uuid,
                        destinationId: destinationId as Uuid,
                        visibility: VisibilityEnum.PRIVATE,
                        lifecycleState: LifecycleStatusEnum.DRAFT,
                        moderationState: ModerationStatusEnum.PENDING,
                        averageRating: 0,
                        reviewsCount: 0
                    } as never,
                    ctx
                );
                expect(created.error).toBeUndefined();
                const listingId = created.data?.id as string;

                const edited = await experienceService.updateOwn(
                    listingId,
                    { durationMinutes: 90 },
                    actor,
                    ctx
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'experience',
                    entityId: listingId,
                    tx
                });
                expect(events.map((e) => e.eventType)).toEqual([
                    'listing.created',
                    'listing.edited'
                ]);
                for (const event of events) {
                    expectMinimumFields({
                        event,
                        eventType: event.eventType,
                        entityType: 'experience',
                        entityId: listingId,
                        ownerId
                    });
                }
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:1 — accommodation: an owner edit writes one listing.edited event, with the minimum fields',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId, accommodationId } = await seedAccommodation(tx);
                const ctx: ServiceContext = { tx };

                const edited = await accommodationService.update(
                    ownerActor(userId),
                    accommodationId,
                    { summary: 'Resumen editado del alojamiento' },
                    ctx
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                expect(events).toHaveLength(1);
                expectMinimumFields({
                    event: events[0] as SelectDomainEvent,
                    eventType: 'listing.edited',
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    ownerId: userId
                });
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:1 — an administrator editing somebody else listing writes no owner act',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                const { userId: adminId } = await seedAccommodation(tx);
                const admin: Actor = {
                    id: adminId,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
                };

                const edited = await accommodationService.update(
                    admin,
                    accommodationId,
                    { summary: 'Resumen editado por un administrador' },
                    { tx }
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                expect(events).toHaveLength(0);
            });
        }
    );

    // TEST:V9a:2 — AC:V9a:2
    it.skipIf(!dbAvailable)(
        'TEST:V9a:2 — editing the description and the state in one act stores only the description name and the state old/new',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId, accommodationId } = await seedAccommodation(tx);
                const newDescription =
                    'Una descripción nueva y suficientemente larga para pasar la validación.';

                const edited = await accommodationService.update(
                    ownerActor(userId),
                    accommodationId,
                    {
                        description: newDescription,
                        lifecycleState: LifecycleStatusEnum.INACTIVE
                    },
                    { tx }
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                expect(events).toHaveLength(1);
                expect(events[0]?.changes).toEqual([
                    { field: 'description' },
                    {
                        field: 'lifecycleState',
                        old: LifecycleStatusEnum.ACTIVE,
                        new: LifecycleStatusEnum.INACTIVE
                    }
                ]);
                expect(JSON.stringify(events[0])).not.toContain(newDescription);
                expect(JSON.stringify(events[0])).not.toContain('Seed accommodation description');
            });
        }
    );

    // TEST:V9a:3 — AC:V9a:3
    it.skipIf(!dbAvailable)(
        'TEST:V9a:3 — five description edits leave none of the five texts in any event of the listing',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, gastronomyId } = await seedGastronomy(tx);
                const actor = ownerActor(ownerId);
                const texts = [1, 2, 3, 4, 5].map(
                    (n) => `Texto de descripción número ${n} — marca única ${crypto.randomUUID()}`
                );

                for (const description of texts) {
                    const edited = await gastronomyService.updateOwn(
                        gastronomyId,
                        { description },
                        actor,
                        { tx }
                    );
                    expect(edited.error).toBeUndefined();
                }

                const events = await domainEventModel.findByEntity({
                    entityType: 'gastronomy',
                    entityId: gastronomyId,
                    tx
                });
                expect(events).toHaveLength(5);
                const serialized = JSON.stringify(events);
                for (const text of texts) {
                    expect(serialized).not.toContain(text);
                }
                for (const event of events) {
                    expect(event.changes).toEqual([{ field: 'description' }]);
                }
            });
        }
    );
});
