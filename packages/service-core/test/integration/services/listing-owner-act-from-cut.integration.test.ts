/**
 * HOS-1500 (V9a.1b) — owner acts on listings left by the cut write to
 * `domain_event` from the first post-cut edit.
 *
 * The fixtures mirror the rows left by migration step 3 without running the
 * migration: published listings with a fixed cut instant and deadlines v1.
 * Export is deferred outside the MVP by owner decision DE (2026-10-08); there
 * is no `listing.exported` event.
 *
 * Every case runs in a transaction that is rolled back.
 */

import { type DrizzleClient, domainEventModel, type SelectDomainEvent } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    seedAccommodation,
    seedExperience,
    seedVenue,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();
const CUT_INSTANT = new Date('2026-10-10T12:00:00.000Z');

/** Builds an owner actor with the permissions used by the listing services. */
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

/**
 * Reads the latest owner create/edit instant for one entity from its events.
 *
 * @param input - Entity identity and the transaction used for the read.
 * @returns The latest owner's listing act instant, or null when none exists.
 */
async function findLatestOwnerAct(input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly tx: DrizzleClient;
}): Promise<Date | null> {
    const events = await domainEventModel.findByEntity(input);
    const ownerActs = events.filter(
        (event) =>
            (event.eventType === 'listing.created' || event.eventType === 'listing.edited') &&
            event.actorType === 'owner'
    );

    return ownerActs.reduce<Date | null>(
        (latest, event) =>
            latest === null || event.occurredAt > latest ? event.occurredAt : latest,
        null
    );
}

/** Asserts the single owner edit event written after the cut. */
function expectPostCutOwnerEdit(input: {
    readonly events: readonly SelectDomainEvent[];
    readonly entityType: string;
    readonly entityId: string;
    readonly ownerId: string;
}): Date {
    expect(input.events).toHaveLength(1);
    const event = input.events[0];
    expect(event).toBeDefined();
    if (!event) throw new Error('Expected exactly one owner-act event');
    expect(event?.eventType).toBe('listing.edited');
    expect(event?.entityType).toBe(input.entityType);
    expect(event?.entityId).toBe(input.entityId);
    expect(event?.actorType).toBe('owner');
    expect(event?.actorId).toBe(input.ownerId);
    expect(event?.occurredAt.getTime()).toBeGreaterThan(CUT_INSTANT.getTime());
    expect(input.events.every((item) => item.occurredAt.getTime() > CUT_INSTANT.getTime())).toBe(
        true
    );
    return event.occurredAt;
}

describe('HOS-1500 V9a — owner-act register starts at the cut (integration)', () => {
    let accommodationService: AccommodationService;
    let venueService: VenueService;
    let experienceService: ExperienceService;

    beforeAll(() => {
        if (!dbAvailable) return;
        const config = { logger: createLoggerMock() };
        accommodationService = new AccommodationService(config);
        venueService = new VenueService(config);
        experienceService = new ExperienceService(config);
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    // AC:V9a:4 y AC:V9a:5. TEST:V9a:4
    it.skipIf(!dbAvailable)(
        'TEST:V9a:4 — accommodation first owner edit after cut is the latest recorded act',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId, accommodationId } = await seedAccommodation(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    inactiveSince: CUT_INSTANT,
                    deadlinesVersion: 1
                });

                const beforeEvents = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                expect(beforeEvents).toEqual([]);
                expect(
                    await findLatestOwnerAct({
                        entityType: 'accommodation',
                        entityId: accommodationId,
                        tx
                    })
                ).toBeNull();

                const edited = await accommodationService.update(
                    ownerActor(userId),
                    accommodationId,
                    { summary: 'Resumen editado después del corte' },
                    { tx }
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                const occurredAt = expectPostCutOwnerEdit({
                    events,
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    ownerId: userId
                });
                expect(
                    await findLatestOwnerAct({
                        entityType: 'accommodation',
                        entityId: accommodationId,
                        tx
                    })
                ).toEqual(occurredAt);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:4 — gastronomy first owner edit after cut is the latest recorded act',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, gastronomyId } = await seedVenue(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    inactiveSince: CUT_INSTANT,
                    deadlinesVersion: 1
                });
                const entityType = 'venue';

                expect(
                    await domainEventModel.findByEntity({ entityType, entityId: gastronomyId, tx })
                ).toEqual([]);
                expect(
                    await findLatestOwnerAct({ entityType, entityId: gastronomyId, tx })
                ).toBeNull();

                const edited = await venueService.updateOwn(
                    gastronomyId,
                    { summary: 'Resumen editado después del corte' },
                    ownerActor(ownerId),
                    { tx }
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType,
                    entityId: gastronomyId,
                    tx
                });
                const occurredAt = expectPostCutOwnerEdit({
                    events,
                    entityType,
                    entityId: gastronomyId,
                    ownerId
                });
                expect(
                    await findLatestOwnerAct({ entityType, entityId: gastronomyId, tx })
                ).toEqual(occurredAt);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:4 — experience first owner edit after cut is the latest recorded act',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, experienceId } = await seedExperience(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    inactiveSince: CUT_INSTANT,
                    deadlinesVersion: 1
                });
                const entityType = 'experience';

                expect(
                    await domainEventModel.findByEntity({ entityType, entityId: experienceId, tx })
                ).toEqual([]);
                expect(
                    await findLatestOwnerAct({ entityType, entityId: experienceId, tx })
                ).toBeNull();

                const edited = await experienceService.updateOwn(
                    experienceId,
                    { summary: 'Resumen editado después del corte' },
                    ownerActor(ownerId),
                    { tx }
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType,
                    entityId: experienceId,
                    tx
                });
                const occurredAt = expectPostCutOwnerEdit({
                    events,
                    entityType,
                    entityId: experienceId,
                    ownerId
                });
                expect(
                    await findLatestOwnerAct({ entityType, entityId: experienceId, tx })
                ).toEqual(occurredAt);
            });
        }
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:4 — accommodation administrator edit does not become an owner act',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx, {
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    inactiveSince: CUT_INSTANT,
                    deadlinesVersion: 1
                });
                const { userId: adminId } = await seedAccommodation(tx);
                const admin: Actor = {
                    id: adminId,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
                };
                const entityType = 'accommodation';

                expect(
                    await domainEventModel.findByEntity({
                        entityType,
                        entityId: accommodationId,
                        tx
                    })
                ).toEqual([]);
                expect(
                    await findLatestOwnerAct({ entityType, entityId: accommodationId, tx })
                ).toBeNull();

                const edited = await accommodationService.update(
                    admin,
                    accommodationId,
                    { summary: 'Resumen editado por administración' },
                    { tx }
                );
                expect(edited.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType,
                    entityId: accommodationId,
                    tx
                });
                expect(events).toHaveLength(0);
                expect(
                    await findLatestOwnerAct({ entityType, entityId: accommodationId, tx })
                ).toBeNull();
            });
        }
    );
});
