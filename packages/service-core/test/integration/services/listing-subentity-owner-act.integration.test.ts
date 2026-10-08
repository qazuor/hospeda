/**
 * HOS-1642 (piece V9a) — TEST:V9a:6, against a REAL PostgreSQL database.
 *
 * Every owner FAQ and photos/media write on a listing (accommodation,
 * gastronomy, experience) writes ONE `domain_event` row — the EXISTING
 * `recordListingOwnerAct` mechanism (HOS-1499) through the
 * `recordListingSubEntityEdit` wrapper — inside the operation's transaction,
 * with changes = `[{ field: 'faqs' }]` or `[{ field: 'media' }]`: the field
 * NAME only, never the question, answer, URL or alt text (DEC-DATA-005).
 * The mechanism's owner gate decides: a non-owner edit writes nothing.
 *
 * ## Transaction note (why every op is called with `ctx = { tx }`)
 *
 * The tests run inside `withServiceTestTransaction`, which is ALWAYS rolled
 * back. An op called WITHOUT ctx (the real route behavior) opens its OWN
 * transaction on a second pool connection — where the uncommitted seeded
 * listing is invisible, so the op answers NOT_FOUND and the test cannot run.
 * Calls inside the rollback boundary therefore pass the test's tx (the
 * `ctx?.tx`-present branch). The ctx-absent branch — the op opening its own
 * boundary and still leaving the event — is covered by the dedicated
 * route-behavior test at the bottom, which commits its own seed data and
 * cleans up after itself.
 *
 * AC:V9a:6 covers FAQ writes; AC:V9a:6 covers photos/media writes.
 */

import {
    accommodationFaqs,
    accommodationMedia,
    accommodations,
    type DrizzleClient,
    destinations,
    domainEventModel,
    ExperienceModel,
    eq,
    experienceFaqs,
    experienceMedia,
    GastronomyModel,
    gastronomyFaqs,
    gastronomyMedia,
    inArray,
    type SelectDomainEvent,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    addExperienceFaq,
    removeExperienceFaq,
    reorderExperienceFaqs,
    updateExperienceFaq
} from '../../../src/services/experience/experience.faq';
import {
    addExperienceMedia,
    removeExperienceMedia,
    reorderExperienceMedia,
    updateExperienceMedia
} from '../../../src/services/experience/experience.media';
import {
    addGastronomyFaq,
    removeGastronomyFaq,
    reorderGastronomyFaqs,
    updateGastronomyFaq
} from '../../../src/services/gastronomy/gastronomy.faq';
import {
    addGastronomyMedia,
    removeGastronomyMedia,
    reorderGastronomyMedia,
    updateGastronomyMedia
} from '../../../src/services/gastronomy/gastronomy.media';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    seedExperience,
    seedGastronomy,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

type Vertical = 'accommodation' | 'gastronomy' | 'experience';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// --- Content strings (must NEVER appear inside any event) -------------------

const FAQ_SEED_QUESTION = 'Pregunta semilla de la galeria de faqs';
const FAQ_SEED_ANSWER = 'Respuesta semilla de integracion, larga como exige el esquema.';
const FAQ_ADDED_QUESTION = 'Pregunta añadida por el dueño del listado';
const FAQ_ADDED_ANSWER = 'Respuesta añadida por el dueño, también suficientemente larga.';
const FAQ_UPDATED_QUESTION = 'Pregunta editada por el dueño del listado';
const MEDIA_SEED_URL = 'https://example.com/seed-gallery-photo.jpg';
const MEDIA_SEED_ALT = 'Texto alt semilla de la foto';
const MEDIA_ADDED_URL = 'https://example.com/photo-added-by-owner.jpg';
const MEDIA_UPDATED_ALT = 'Texto alt editado por el dueño';

/** Every string a sub-entity row carries — the events must not hold ANY of them. */
const ALL_CONTENT_STRINGS = [
    FAQ_SEED_QUESTION,
    FAQ_SEED_ANSWER,
    FAQ_ADDED_QUESTION,
    FAQ_ADDED_ANSWER,
    FAQ_UPDATED_QUESTION,
    MEDIA_SEED_URL,
    MEDIA_SEED_ALT,
    MEDIA_ADDED_URL,
    MEDIA_UPDATED_ALT
] as const;

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

/** Narrow shape the assertions need from any op result. */
type OpResult = { readonly error?: unknown; readonly data?: unknown };

/**
 * The eight sub-entity ops of one vertical, bound to one listing, actor and
 * context. Each op receives only the row ids it needs; every result is narrowed
 * to {@link OpResult} so the three verticals share one test body.
 */
interface VerticalOps {
    readonly addFaq: () => Promise<OpResult>;
    readonly updateFaq: (faqId: string) => Promise<OpResult>;
    readonly reorderFaqs: (faqIds: readonly string[]) => Promise<OpResult>;
    readonly removeFaq: (faqId: string) => Promise<OpResult>;
    readonly addMedia: () => Promise<OpResult>;
    readonly updateMedia: (mediaId: string) => Promise<OpResult>;
    readonly reorderMedia: (orderedIds: readonly string[]) => Promise<OpResult>;
    readonly removeMedia: (mediaId: string) => Promise<OpResult>;
}

function buildVerticalOps(
    vertical: Vertical,
    listingId: string,
    actor: Actor,
    ctx: ServiceContext
): VerticalOps {
    if (vertical === 'accommodation') {
        const service = new AccommodationService({ logger: createLoggerMock() });
        return {
            addFaq: () =>
                service.addFaq(
                    actor,
                    {
                        accommodationId: listingId,
                        faq: { question: FAQ_ADDED_QUESTION, answer: FAQ_ADDED_ANSWER }
                    },
                    ctx
                ),
            updateFaq: (faqId) =>
                service.updateFaq(
                    actor,
                    {
                        accommodationId: listingId,
                        faqId,
                        faq: { question: FAQ_UPDATED_QUESTION }
                    },
                    ctx
                ),
            reorderFaqs: (faqIds) =>
                service.reorderFaqs(
                    actor,
                    {
                        accommodationId: listingId,
                        order: faqIds.map((faqId, i) => ({
                            faqId,
                            displayOrder: faqIds.length - i
                        }))
                    },
                    ctx
                ),
            removeFaq: (faqId) =>
                service.removeFaq(actor, { accommodationId: listingId, faqId }, ctx),
            addMedia: () =>
                service.addMedia(
                    actor,
                    { accommodationId: listingId, media: { url: MEDIA_ADDED_URL } },
                    ctx
                ),
            updateMedia: (mediaId) =>
                service.updateMedia(
                    actor,
                    { accommodationId: listingId, mediaId, alt: MEDIA_UPDATED_ALT },
                    ctx
                ),
            reorderMedia: (orderedIds) =>
                service.reorderMedia(
                    actor,
                    { accommodationId: listingId, orderedIds: [...orderedIds] },
                    ctx
                ),
            removeMedia: (mediaId) =>
                service.removeMedia(actor, { accommodationId: listingId, mediaId }, ctx)
        };
    }

    if (vertical === 'gastronomy') {
        const model = new GastronomyModel();
        return {
            addFaq: () =>
                addGastronomyFaq(
                    model,
                    actor,
                    {
                        gastronomyId: listingId,
                        faq: { question: FAQ_ADDED_QUESTION, answer: FAQ_ADDED_ANSWER }
                    },
                    ctx
                ),
            updateFaq: (faqId) =>
                updateGastronomyFaq(
                    model,
                    actor,
                    { gastronomyId: listingId, faqId, faq: { question: FAQ_UPDATED_QUESTION } },
                    ctx
                ),
            reorderFaqs: (faqIds) =>
                reorderGastronomyFaqs(
                    model,
                    actor,
                    {
                        gastronomyId: listingId,
                        order: faqIds.map((faqId, i) => ({
                            faqId,
                            displayOrder: faqIds.length - i
                        }))
                    },
                    ctx
                ),
            removeFaq: (faqId) =>
                removeGastronomyFaq(model, actor, { gastronomyId: listingId, faqId }, ctx),
            addMedia: () =>
                addGastronomyMedia(
                    model,
                    actor,
                    { gastronomyId: listingId, media: { url: MEDIA_ADDED_URL } },
                    ctx
                ),
            updateMedia: (mediaId) =>
                updateGastronomyMedia(
                    model,
                    actor,
                    { gastronomyId: listingId, mediaId, alt: MEDIA_UPDATED_ALT },
                    ctx
                ),
            reorderMedia: (orderedIds) =>
                reorderGastronomyMedia(
                    model,
                    actor,
                    { gastronomyId: listingId, orderedIds: [...orderedIds] },
                    ctx
                ),
            removeMedia: (mediaId) =>
                removeGastronomyMedia(
                    model,
                    actor,
                    { gastronomyId: listingId, mediaId },
                    undefined,
                    ctx
                )
        };
    }

    const model = new ExperienceModel();
    return {
        addFaq: () =>
            addExperienceFaq(
                model,
                actor,
                {
                    experienceId: listingId,
                    faq: { question: FAQ_ADDED_QUESTION, answer: FAQ_ADDED_ANSWER }
                },
                ctx
            ),
        updateFaq: (faqId) =>
            updateExperienceFaq(
                model,
                actor,
                { experienceId: listingId, faqId, faq: { question: FAQ_UPDATED_QUESTION } },
                ctx
            ),
        reorderFaqs: (faqIds) =>
            reorderExperienceFaqs(
                model,
                actor,
                {
                    experienceId: listingId,
                    order: faqIds.map((faqId, i) => ({ faqId, displayOrder: faqIds.length - i }))
                },
                ctx
            ),
        removeFaq: (faqId) =>
            removeExperienceFaq(model, actor, { experienceId: listingId, faqId }, ctx),
        addMedia: () =>
            addExperienceMedia(
                model,
                actor,
                { experienceId: listingId, media: { url: MEDIA_ADDED_URL } },
                ctx
            ),
        updateMedia: (mediaId) =>
            updateExperienceMedia(
                model,
                actor,
                { experienceId: listingId, mediaId, alt: MEDIA_UPDATED_ALT },
                ctx
            ),
        reorderMedia: (orderedIds) =>
            reorderExperienceMedia(
                model,
                actor,
                { experienceId: listingId, orderedIds: [...orderedIds] },
                ctx
            ),
        removeMedia: (mediaId) =>
            removeExperienceMedia(
                model,
                actor,
                { experienceId: listingId, mediaId },
                undefined,
                ctx
            )
    };
}

/** Asserts the minimum fields of NUCLEO/08 §1.2 plus the exact field-name change. */
function expectSubEntityEvent(input: {
    readonly event: SelectDomainEvent;
    readonly vertical: Vertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly field: 'faqs' | 'media';
}): void {
    const { event } = input;
    expect(event.eventType).toBe('listing.edited');
    expect(event.entityType).toBe(input.vertical);
    expect(event.entityId).toBe(input.listingId);
    expect(event.actorId).toBe(input.ownerId);
    expect(event.actorType).toBe('owner');
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.correlationId).toMatch(UUID_RE);
    expect(event.changes).toEqual([{ field: input.field }]);
}

/** Inserts one FAQ row directly (no seed helper exists for sub-entities). */
async function insertSeedFaq(
    tx: DrizzleClient,
    vertical: Vertical,
    listingId: string
): Promise<string> {
    const id = crypto.randomUUID();
    const row = {
        id,
        question: FAQ_SEED_QUESTION,
        answer: FAQ_SEED_ANSWER,
        displayOrder: 0
    };
    if (vertical === 'accommodation') {
        await tx.insert(accommodationFaqs).values({ ...row, accommodationId: listingId });
    } else if (vertical === 'gastronomy') {
        await tx.insert(gastronomyFaqs).values({ ...row, gastronomyId: listingId });
    } else {
        await tx.insert(experienceFaqs).values({ ...row, experienceId: listingId });
    }
    return id;
}

/** Inserts one visible gallery media row directly (no seed helper exists). */
async function insertSeedMedia(
    tx: DrizzleClient,
    vertical: Vertical,
    listingId: string
): Promise<string> {
    const id = crypto.randomUUID();
    const row = {
        id,
        url: MEDIA_SEED_URL,
        alt: MEDIA_SEED_ALT,
        sortOrder: 0,
        state: 'visible' as const,
        isFeatured: false
    };
    if (vertical === 'accommodation') {
        await tx.insert(accommodationMedia).values({ ...row, accommodationId: listingId });
    } else if (vertical === 'gastronomy') {
        await tx.insert(gastronomyMedia).values({ ...row, gastronomyId: listingId });
    } else {
        await tx.insert(experienceMedia).values({ ...row, experienceId: listingId });
    }
    return id;
}

/**
 * The full FAQ + media cycle of one vertical: eight ops, each adding exactly
 * one event, every event name-only.
 */
async function runVerticalCycle(vertical: Vertical): Promise<void> {
    await withServiceTestTransaction(async (tx) => {
        // Seed the listing for the vertical under test.
        let ownerId: string;
        let listingId: string;
        if (vertical === 'accommodation') {
            const seeded = await seedAccommodation(tx);
            ownerId = seeded.userId;
            listingId = seeded.accommodationId;
        } else if (vertical === 'gastronomy') {
            const seeded = await seedGastronomy(tx);
            ownerId = seeded.ownerId;
            listingId = seeded.gastronomyId;
        } else {
            const seeded = await seedExperience(tx);
            ownerId = seeded.ownerId;
            listingId = seeded.experienceId;
        }

        const actor = ownerActor(ownerId);
        const ops = buildVerticalOps(vertical, listingId, actor, { tx });

        // Pre-existing sub-entity rows, so update/reorder/remove have targets.
        const seedFaqId = await insertSeedFaq(tx, vertical, listingId);
        const seedMediaId = await insertSeedMedia(tx, vertical, listingId);

        const fetchEvents = () =>
            domainEventModel.findByEntity({ entityType: vertical, entityId: listingId, tx });

        // --- FAQ add → exactly one new event ---
        const addedFaq = await ops.addFaq();
        expect(addedFaq.error, `${vertical} FAQ add succeeds`).toBeUndefined();
        const addedFaqId = (addedFaq.data as { faq: { id: string } }).faq.id;
        let events = await fetchEvents();
        expect(events, `${vertical} FAQ add → 1 event`).toHaveLength(1);

        // --- FAQ update ---
        const updatedFaq = await ops.updateFaq(addedFaqId);
        expect(updatedFaq.error, `${vertical} FAQ update succeeds`).toBeUndefined();
        events = await fetchEvents();
        expect(events, `${vertical} FAQ update → 2 events`).toHaveLength(2);

        // --- FAQ reorder (one event for the whole reorder) ---
        const reorderedFaqs = await ops.reorderFaqs([seedFaqId, addedFaqId]);
        expect(reorderedFaqs.error, `${vertical} FAQ reorder succeeds`).toBeUndefined();
        events = await fetchEvents();
        expect(events, `${vertical} FAQ reorder → 3 events`).toHaveLength(3);

        // --- FAQ remove ---
        const removedFaq = await ops.removeFaq(addedFaqId);
        expect(removedFaq.error, `${vertical} FAQ remove succeeds`).toBeUndefined();
        events = await fetchEvents();
        expect(events, `${vertical} FAQ remove → 4 events`).toHaveLength(4);

        // --- media add ---
        const addedMedia = await ops.addMedia();
        expect(addedMedia.error, `${vertical} media add succeeds`).toBeUndefined();
        const addedMediaId = (addedMedia.data as { media: { id: string } }).media.id;
        events = await fetchEvents();
        expect(events, `${vertical} media add → 5 events`).toHaveLength(5);

        // --- media update ---
        const updatedMedia = await ops.updateMedia(addedMediaId);
        expect(updatedMedia.error, `${vertical} media update succeeds`).toBeUndefined();
        events = await fetchEvents();
        expect(events, `${vertical} media update → 6 events`).toHaveLength(6);

        // --- media reorder ---
        const reorderedMedia = await ops.reorderMedia([addedMediaId, seedMediaId]);
        expect(reorderedMedia.error, `${vertical} media reorder succeeds`).toBeUndefined();
        events = await fetchEvents();
        expect(events, `${vertical} media reorder → 7 events`).toHaveLength(7);

        // --- media remove ---
        const removedMedia = await ops.removeMedia(addedMediaId);
        expect(removedMedia.error, `${vertical} media remove succeeds`).toBeUndefined();
        events = await fetchEvents();
        expect(events, `${vertical} media remove → 8 events`).toHaveLength(8);

        // --- per-event shape: minimum fields + the exact field name ---
        for (const event of events) {
            expectSubEntityEvent({
                event,
                vertical,
                listingId,
                ownerId,
                field:
                    JSON.stringify(event.changes) === JSON.stringify([{ field: 'faqs' }])
                        ? 'faqs'
                        : 'media'
            });
        }

        // Exactly four 'faqs' events and four 'media' events, nothing else.
        const changesJson = events.map((e) => JSON.stringify(e.changes));
        expect(
            changesJson.filter((c) => c === JSON.stringify([{ field: 'faqs' }])),
            `${vertical} → four 'faqs' events`
        ).toHaveLength(4);
        expect(
            changesJson.filter((c) => c === JSON.stringify([{ field: 'media' }])),
            `${vertical} → four 'media' events`
        ).toHaveLength(4);

        // --- name-only guarantee (DEC-DATA-005): no content in ANY event ---
        const serialized = JSON.stringify(events);
        for (const content of ALL_CONTENT_STRINGS) {
            expect(serialized, `${vertical} events hold no "${content}"`).not.toContain(content);
        }
    });
}

describe('HOS-1642 V9a — owner FAQ/media writes land in domain_event (integration)', () => {
    // Committed rows left by the route-behavior test (see that test for why).
    const committedRows: {
        readonly userId: string;
        readonly destinationId: string;
        readonly accommodationId: string;
    }[] = [];

    afterAll(async () => {
        if (!dbAvailable) return;
        // Best-effort cleanup of the route-behavior test's committed rows:
        // media/FAQ rows cascade with the listing. `domain_event` is
        // append-only (its trigger rejects deletes), so those event rows stay —
        // harmless inside the per-run ephemeral test database.
        if (committedRows.length > 0) {
            const db = getServiceTestDb();
            for (const { userId, destinationId, accommodationId } of committedRows) {
                await db.delete(accommodations).where(eq(accommodations.id, accommodationId));
                await db.delete(destinations).where(eq(destinations.id, destinationId));
                await db.delete(users).where(inArray(users.id, [userId]));
            }
        }
        await closeServiceTestPool();
    });

    // TEST:V9a:6 — AC:V9a:6 (FAQ) + AC:V9a:6 (photos/media), one test per vertical.
    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — accommodation: each FAQ and media add/update/reorder/remove writes exactly one name-only event',
        () => runVerticalCycle('accommodation')
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — gastronomy: each FAQ and media add/update/reorder/remove writes exactly one name-only event',
        () => runVerticalCycle('gastronomy')
    );

    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — experience: each FAQ and media add/update/reorder/remove writes exactly one name-only event',
        () => runVerticalCycle('experience')
    );

    // TEST:V9a:6 — the owner gate: a non-owner edit records nothing.
    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — accommodation: a non-owner adding a FAQ writes no event',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId } = await seedAccommodation(tx);
                // A second seed gives the non-owner a real user row (same pattern
                // as the HOS-1499 admin test).
                const { userId: adminId } = await seedAccommodation(tx);
                const admin: Actor = {
                    id: adminId,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
                };

                const result = await new AccommodationService({
                    logger: createLoggerMock()
                }).addFaq(
                    admin,
                    {
                        accommodationId,
                        faq: { question: FAQ_ADDED_QUESTION, answer: FAQ_ADDED_ANSWER }
                    },
                    { tx }
                );
                expect(result.error).toBeUndefined();

                const events = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                expect(events).toHaveLength(0);
            });
        }
    );

    // TEST:V9a:6 (atomicity, FAQ) — the event dies with a rolled-back write.
    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — accommodation FAQ add inside a rolled-back savepoint leaves no event',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { userId, accommodationId } = await seedAccommodation(tx);

                let failed = false;
                try {
                    await tx.transaction(async (savepoint) => {
                        const result = await new AccommodationService({
                            logger: createLoggerMock()
                        }).addFaq(
                            ownerActor(userId),
                            {
                                accommodationId,
                                faq: { question: FAQ_ADDED_QUESTION, answer: FAQ_ADDED_ANSWER }
                            },
                            { tx: savepoint as unknown as ServiceContext['tx'] }
                        );
                        if (result.error) throw result.error;

                        const inside = await domainEventModel.findByEntity({
                            entityType: 'accommodation',
                            entityId: accommodationId,
                            tx: savepoint as unknown as ServiceContext['tx']
                        });
                        expect(inside, 'event exists inside the savepoint').toHaveLength(1);

                        // Force the savepoint to roll back.
                        throw new Error('rollback the savepoint');
                    });
                } catch {
                    failed = true;
                }
                expect(failed, 'the savepoint rolled back').toBe(true);

                const after = await domainEventModel.findByEntity({
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    tx
                });
                expect(after, 'no event survives the savepoint rollback').toHaveLength(0);
            });
        }
    );

    // TEST:V9a:6 (atomicity, media) — same savepoint pattern for a media write.
    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — gastronomy media add inside a rolled-back savepoint leaves no event',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, gastronomyId } = await seedGastronomy(tx);

                let failed = false;
                try {
                    await tx.transaction(async (savepoint) => {
                        const result = await addGastronomyMedia(
                            new GastronomyModel(),
                            ownerActor(ownerId),
                            { gastronomyId, media: { url: MEDIA_ADDED_URL } },
                            { tx: savepoint as unknown as ServiceContext['tx'] }
                        );
                        if (result.error) throw result.error;

                        const inside = await domainEventModel.findByEntity({
                            entityType: 'gastronomy',
                            entityId: gastronomyId,
                            tx: savepoint as unknown as ServiceContext['tx']
                        });
                        expect(inside, 'event exists inside the savepoint').toHaveLength(1);

                        throw new Error('rollback the savepoint');
                    });
                } catch {
                    failed = true;
                }
                expect(failed, 'the savepoint rolled back').toBe(true);

                const after = await domainEventModel.findByEntity({
                    entityType: 'gastronomy',
                    entityId: gastronomyId,
                    tx
                });
                expect(after, 'no event survives the savepoint rollback').toHaveLength(0);
            });
        }
    );

    // TEST:V9a:6 (route behavior) — an op called WITHOUT ctx opens its own
    // transaction and must STILL leave the event. Its seed data must be
    // COMMITTED (a second connection cannot see the rollback tx's rows), so
    // this test registers its committed rows for the afterAll cleanup above.
    it.skipIf(!dbAvailable)(
        'TEST:V9a:6 — accommodation FAQ + media ops called without ctx still leave one event each',
        async () => {
            const db = getServiceTestDb();
            // Committed seed data (plain client, no transaction).
            const seeded = await seedAccommodation(db);
            committedRows.push(seeded);
            const { userId, accommodationId } = seeded;
            const service = new AccommodationService({ logger: createLoggerMock() });

            const addedFaq = await service.addFaq(
                ownerActor(userId),
                {
                    accommodationId,
                    faq: { question: FAQ_ADDED_QUESTION, answer: FAQ_ADDED_ANSWER }
                }
                // no ctx: the op opens its own transaction, exactly like the route
            );
            expect(addedFaq.error, 'FAQ add without ctx succeeds').toBeUndefined();

            const addedMedia = await service.addMedia(
                ownerActor(userId),
                { accommodationId, media: { url: MEDIA_ADDED_URL } }
                // no ctx
            );
            expect(addedMedia.error, 'media add without ctx succeeds').toBeUndefined();

            // The events were committed by the ops' own transactions.
            const events = await domainEventModel.findByEntity({
                entityType: 'accommodation',
                entityId: accommodationId
            });
            expect(events, 'one event per op').toHaveLength(2);
            const changesJson = events.map((e) => JSON.stringify(e.changes));
            expect(changesJson).toContain(JSON.stringify([{ field: 'faqs' }]));
            expect(changesJson).toContain(JSON.stringify([{ field: 'media' }]));
            for (const event of events) {
                expectSubEntityEvent({
                    event,
                    vertical: 'accommodation',
                    listingId: accommodationId,
                    ownerId: userId,
                    field: event.changes[0]?.field === 'faqs' ? 'faqs' : 'media'
                });
            }
        }
    );
});
