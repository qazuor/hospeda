/**
 * TEST:V6:2 / TEST:V6:3 over HTTP — `POST /protected/accommodations/:id/publish`.
 *
 * Real app, real database: authentication (mock actor), the protected tier,
 * shape validation, the ownership middleware and the V5 listing chain run as
 * in production. Only the publication ports are replaced (see
 * `publication-routes.helpers.ts`). Cases follow `docs/error-contract.md`:
 * 401 → 403 → 400 → 404 → business rules.
 *
 * The route declares no route-level permission; its authorization denials
 * come from the listing chain: step 3 (an administrative actor may not publish
 * somebody else's listing) and step 6 (the owner lacks the PUBLISH capability).
 */
import { randomUUID } from 'node:crypto';
import { accommodations, eq, getDb, trials } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { computeTrialEmailPseudonym } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createDestination,
    createListing,
    createOwner,
    createTrial,
    ensureAccommodationCatalog,
    MATRIX_NOW,
    publicationControls,
    readResponse,
    resetPublicationControls
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const url = (id: string) => `/api/v1/protected/accommodations/${id}/publish`;

function publish(id: string, headers?: Record<string, string>) {
    return app.request(url(id), {
        method: 'POST',
        headers: headers ?? { 'content-type': 'application/json', 'user-agent': 'vitest' }
    });
}

async function statusOf(id: string) {
    const [row] = await getDb()
        .select({ status: accommodations.publicationStatus })
        .from(accommodations)
        .where(eq(accommodations.id, id));
    return row?.status;
}

async function trialsOf(userId: string) {
    return getDb().select().from(trials).where(eq(trials.userId, userId));
}

/** An owner in PRE_TRIAL (no trial row) with one listing in `status`. */
async function ownerWithListing(status: PublicationStatusEnum, complete = true) {
    const owner = await createOwner();
    const destinationId = await createDestination();
    const listingId = await createListing({
        ownerId: owner.id,
        destinationId,
        status,
        complete
    });
    return { owner, destinationId, listingId };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    await ensureAccommodationCatalog();
    resetPublicationControls();
});
afterAll(async () => testDb.teardown());

describe('publish route — authentication, permission, shape and ownership', () => {
    it('answers 401 UNAUTHORIZED without a session and leaves the listing alone', async () => {
        const { listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT);
        const { status, body } = await readResponse(await publish(listingId));
        expect(status).toBe(401);
        expect(body.error?.code).toBe('UNAUTHORIZED');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 403 FORBIDDEN to an administrator publishing a foreign listing (step 3)', async () => {
        const { listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT);
        const { status, body } = await readResponse(
            await publish(
                listingId,
                actorHeaders({
                    id: randomUUID(),
                    role: RoleEnum.ADMIN,
                    permissions: [
                        PermissionEnum.ACCOMMODATION_VIEW_ALL,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
                    ]
                })
            )
        );
        expect(status).toBe(403);
        expect(body.error?.code).toBe('FORBIDDEN');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 403 FORBIDDEN subscription_required to an owner whose trial is spent', async () => {
        const { owner, listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT);
        await createTrial({ userId: owner.id, status: 'TRIAL_EXPIRED' });
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(403);
        expect(body.error?.code).toBe('FORBIDDEN');
        expect(body.error?.message).toBe('subscription_required');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 400 VALIDATION_ERROR to a malformed id', async () => {
        const owner = await createOwner();
        const { status, body } = await readResponse(
            await publish('not-a-uuid', actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(400);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers the same 404 NOT_FOUND to a foreign listing, with or without the bypass, and to a missing id', async () => {
        const { listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT);
        const stranger = randomUUID();
        const plain = await readResponse(await publish(listingId, actorHeaders({ id: stranger })));
        const bypass = await readResponse(
            await publish(
                listingId,
                actorHeaders({
                    id: stranger,
                    role: RoleEnum.ADMIN,
                    permissions: [
                        PermissionEnum.ACCOMMODATION_VIEW_ALL,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]
                })
            )
        );
        const missing = await readResponse(
            await publish(randomUUID(), actorHeaders({ id: stranger }))
        );
        for (const answer of [plain, bypass, missing]) {
            expect(answer.status).toBe(404);
            expect(answer.body.error?.code).toBe('NOT_FOUND');
        }
        expect(plain.body.error).toEqual(missing.body.error);
        expect(bypass.body.error).toEqual(missing.body.error);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 404 NOT_FOUND for a state PUBLISH does not admit (already PUBLISHED)', async () => {
        const { owner, listingId } = await ownerWithListing(PublicationStatusEnum.PUBLISHED);
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(404);
        expect(body.error?.code).toBe('NOT_FOUND');
    });
});

describe('publish route — PB1/T1 business rejections', () => {
    it('answers 400 VALIDATION_ERROR when the completeness guard fails, naming what is missing', async () => {
        const { owner, listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT, false);
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(400);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
        expect(await trialsOf(owner.id)).toHaveLength(0);
    });

    it('answers 400 VALIDATION_ERROR when the owner mailbox cannot seed the trial pseudonym', async () => {
        const owner = await createOwner({ email: `no-mailbox-${randomUUID()}` });
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId: await createDestination(),
            status: PublicationStatusEnum.DRAFT
        });
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(400);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 403 LIMIT_REACHED with the vertical limitKey when the covered slot is full', async () => {
        const { owner, destinationId, listingId } = await ownerWithListing(
            PublicationStatusEnum.DRAFT
        );
        await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        publicationControls.covered = true;
        publicationControls.limit = 1;
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(403);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        expect(body.error?.details?.limitKey).toBe('max_accommodations');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 409 ALREADY_EXISTS to a covered owner publishing from UNPUBLISHED_BY_BILLING (PB3, not PB1)', async () => {
        const { owner, listingId } = await ownerWithListing(
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        );
        publicationControls.covered = true;
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(409);
        expect(body.error?.code).toBe('ALREADY_EXISTS');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
    });

    it('answers 403 FORBIDDEN subscription_required when uncovered and the trial slot is taken', async () => {
        const { owner, destinationId, listingId } = await ownerWithListing(
            PublicationStatusEnum.DRAFT
        );
        await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(403);
        expect(body.error?.code).toBe('FORBIDDEN');
        expect(body.error?.message).toBe('subscription_required');
        expect(await trialsOf(owner.id)).toHaveLength(0);
    });

    it('answers 403 FORBIDDEN subscription_required when T1 refuses a mailbox that already had a trial', async () => {
        const { owner, listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT);
        const pseudonym = computeTrialEmailPseudonym({ email: owner.email });
        if (!pseudonym.ok) throw new Error('Fixture mailbox was rejected');
        const previous = await createOwner();
        await createTrial({
            userId: previous.id,
            status: 'TRIAL_EXPIRED',
            emailPseudonym: pseudonym.pseudonym
        });
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(403);
        expect(body.error?.code).toBe('FORBIDDEN');
        expect(body.error?.message).toBe('subscription_required');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
        expect(await trialsOf(owner.id)).toHaveLength(0);
    });
});

describe('publish route — PB1 success', () => {
    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    ])('publishes from %s in PRE_TRIAL by starting T1 in the same act', async (from) => {
        const { owner, listingId } = await ownerWithListing(from);
        const { status, body } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(201);
        expect(body.data?.id).toBe(listingId);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
        const started = await trialsOf(owner.id);
        expect(started).toHaveLength(1);
        expect(started[0]?.status).toBe('TRIAL_ACTIVE');
        expect(publicationControls.emitCoverageChanged).toHaveBeenCalledTimes(1);
        expect(publicationControls.revalidate).toHaveBeenCalledWith({
            vertical: 'accommodation',
            listingIds: [listingId]
        });
    });

    it('publishes a covered DRAFT without starting a trial', async () => {
        const { owner, listingId } = await ownerWithListing(PublicationStatusEnum.DRAFT);
        publicationControls.covered = true;
        const { status } = await readResponse(
            await publish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(201);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await trialsOf(owner.id)).toHaveLength(0);
        expect(publicationControls.emitCoverageChanged).not.toHaveBeenCalled();
    });

    it('serializes two simultaneous publishes with one slot: exactly one listing ends PUBLISHED', async () => {
        const { owner, destinationId, listingId } = await ownerWithListing(
            PublicationStatusEnum.DRAFT
        );
        const second = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        publicationControls.covered = true;
        publicationControls.limit = 1;
        const answers = await Promise.all(
            [listingId, second].map(async (id) =>
                readResponse(await publish(id, actorHeaders({ id: owner.id })))
            )
        );
        expect(answers.map((answer) => answer.status).sort()).toEqual([201, 403]);
        expect(answers.find((answer) => answer.status === 403)?.body.error?.code).toBe(
            'LIMIT_REACHED'
        );
        const statuses = [await statusOf(listingId), await statusOf(second)];
        expect(statuses.filter((value) => value === PublicationStatusEnum.PUBLISHED)).toHaveLength(
            1
        );
    });
});
