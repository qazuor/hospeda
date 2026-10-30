/**
 * PB6 over HTTP — `POST /protected/accommodations/:id/unpublish` (HOS-1471).
 *
 * Same harness as `accommodation-publish-route.test.ts`: the real app and
 * database, with only the publication ports replaced. Cases follow
 * `docs/error-contract.md`: 401 → 403 → 400 → 404 → business rules.
 *
 * The route declares no route-level permission; it runs the listing chain as
 * `EDIT`, whose step 6 asks for `edit_accommodation_info` in every state but
 * DRAFT. That is the authorization 403 this route can answer.
 */
import { randomUUID } from 'node:crypto';
import { accommodations, eq, getDb, trials } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
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
const url = (id: string) => `/api/v1/protected/accommodations/${id}/unpublish`;

function unpublish(id: string, headers?: Record<string, string>) {
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

/** An owner with one listing in `status`, optionally holding a trial row. */
async function ownerWithListing(
    status: PublicationStatusEnum,
    trial?: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED'
) {
    const owner = await createOwner();
    if (trial) await createTrial({ userId: owner.id, status: trial });
    const listingId = await createListing({
        ownerId: owner.id,
        destinationId: await createDestination(),
        status
    });
    return { owner, listingId };
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

describe('unpublish route — authentication, permission, shape and ownership', () => {
    it('answers 401 UNAUTHORIZED without a session', async () => {
        const { listingId } = await ownerWithListing(
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_ACTIVE'
        );
        const { status, body } = await readResponse(await unpublish(listingId));
        expect(status).toBe(401);
        expect(body.error?.code).toBe('UNAUTHORIZED');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('answers 403 ENTITLEMENT_REQUIRED to an owner without the EDIT capability (step 6)', async () => {
        const { owner, listingId } = await ownerWithListing(
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_EXPIRED'
        );
        const { status, body } = await readResponse(
            await unpublish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(403);
        expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('answers 400 VALIDATION_ERROR to a malformed id', async () => {
        const owner = await createOwner();
        const { status, body } = await readResponse(
            await unpublish('not-a-uuid', actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(400);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers the same 404 NOT_FOUND to a foreign listing and to a missing id', async () => {
        const { listingId } = await ownerWithListing(
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_ACTIVE'
        );
        const stranger = randomUUID();
        const foreign = await readResponse(
            await unpublish(listingId, actorHeaders({ id: stranger }))
        );
        const missing = await readResponse(
            await unpublish(randomUUID(), actorHeaders({ id: stranger }))
        );
        expect(foreign.status).toBe(404);
        expect(foreign.body.error?.code).toBe('NOT_FOUND');
        expect(foreign.body.error).toEqual(missing.body.error);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('answers 404 NOT_FOUND for a state EDIT does not admit (ARCHIVED)', async () => {
        const { owner, listingId } = await ownerWithListing(
            PublicationStatusEnum.ARCHIVED,
            'TRIAL_ACTIVE'
        );
        const { status, body } = await readResponse(
            await unpublish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(404);
        expect(body.error?.code).toBe('NOT_FOUND');
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.ARCHIVED);
    });
});

describe('unpublish route — PB6 business rejections and success', () => {
    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    ])('answers 409 ALREADY_EXISTS when the listing is %s, not PUBLISHED', async (from) => {
        const { owner, listingId } = await ownerWithListing(from, 'TRIAL_ACTIVE');
        const { status, body } = await readResponse(
            await unpublish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(409);
        expect(body.error?.code).toBe('ALREADY_EXISTS');
        expect(await statusOf(listingId)).toBe(from);
    });

    it('moves a PUBLISHED listing to DRAFT and leaves the trial running', async () => {
        const { owner, listingId } = await ownerWithListing(
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_ACTIVE'
        );
        const { status, body } = await readResponse(
            await unpublish(listingId, actorHeaders({ id: owner.id }))
        );
        expect(status).toBe(201);
        expect(body.data?.id).toBe(listingId);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
        const [trial] = await getDb().select().from(trials).where(eq(trials.userId, owner.id));
        expect(trial?.status).toBe('TRIAL_ACTIVE');
        expect(publicationControls.emitCoverageChanged).not.toHaveBeenCalled();
        expect(publicationControls.revalidate).toHaveBeenCalledWith({
            vertical: 'accommodation',
            listingIds: [listingId]
        });
    });
});
