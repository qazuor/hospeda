/** PB6 over the real HTTP stack for gastronomy and experience. */
import { randomUUID } from 'node:crypto';
import { eq, getDb, trials } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    MATRIX_NOW,
    publicationControls,
    readResponse,
    readVerticalStatus,
    resetPublicationControls
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const verticals = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;
const url = (vertical: (typeof verticals)[number], id: string) =>
    `/api/v1/protected/${vertical === VerticalEnum.VENUE ? 'gastronomies' : 'experiences'}/${id}/unpublish`;

function unpublish(
    vertical: (typeof verticals)[number],
    id: string,
    headers?: Record<string, string>
) {
    return app.request(url(vertical, id), {
        method: 'POST',
        headers: headers ?? { 'content-type': 'application/json', 'user-agent': 'vitest' }
    });
}

async function listing(
    vertical: (typeof verticals)[number],
    status: PublicationStatusEnum,
    trial?: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED'
) {
    const owner = await createOwner();
    if (trial) await createTrial({ userId: owner.id, vertical, status: trial });
    const listingId = await createVerticalListing({
        vertical,
        ownerId: owner.id,
        destinationId: await createVerticalDestination(),
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
    resetPublicationControls();
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('PB6 route — %s (TEST:V6:2)', (vertical) => {
    beforeEach(async () => ensurePublicationCatalog(vertical));

    it('answers 401 UNAUTHORIZED without a session', async () => {
        const { listingId } = await listing(
            vertical,
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_ACTIVE'
        );
        const answer = await readResponse(await unpublish(vertical, listingId));
        expect(answer.status).toBe(401);
        expect(answer.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('answers 403 ENTITLEMENT_REQUIRED when the owner lacks EDIT capability (V5 step 6)', async () => {
        const { owner, listingId } = await listing(
            vertical,
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_EXPIRED'
        );
        const answer = await readResponse(
            await unpublish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(403);
        expect(answer.body.error?.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('answers 400 VALIDATION_ERROR to a malformed id', async () => {
        const owner = await createOwner();
        const answer = await readResponse(
            await unpublish(vertical, 'not-a-uuid', actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(400);
        expect(answer.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers the same 404 NOT_FOUND to foreign and missing listings', async () => {
        const { listingId } = await listing(
            vertical,
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_ACTIVE'
        );
        const actorId = randomUUID();
        const foreign = await readResponse(
            await unpublish(vertical, listingId, actorHeaders({ id: actorId }))
        );
        const missing = await readResponse(
            await unpublish(vertical, randomUUID(), actorHeaders({ id: actorId }))
        );
        expect(foreign.status).toBe(404);
        expect(foreign.body.error?.code).toBe('NOT_FOUND');
        expect(foreign.body.error).toEqual(missing.body.error);
    });

    it('answers 404 NOT_FOUND to ARCHIVED', async () => {
        const { owner, listingId } = await listing(
            vertical,
            PublicationStatusEnum.ARCHIVED,
            'TRIAL_ACTIVE'
        );
        const answer = await readResponse(
            await unpublish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(404);
        expect(answer.body.error?.code).toBe('NOT_FOUND');
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    ])('answers 409 ALREADY_EXISTS when the listing is %s', async (from) => {
        const { owner, listingId } = await listing(vertical, from, 'TRIAL_ACTIVE');
        const answer = await readResponse(
            await unpublish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(409);
        expect(answer.body.error?.code).toBe('ALREADY_EXISTS');
        expect(await readVerticalStatus(vertical, listingId)).toBe(from);
    });

    it('moves PUBLISHED to DRAFT, preserves the active trial, sends no coverage notice and revalidates', async () => {
        const { owner, listingId } = await listing(
            vertical,
            PublicationStatusEnum.PUBLISHED,
            'TRIAL_ACTIVE'
        );
        const answer = await readResponse(
            await unpublish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(201);
        expect(answer.body.data?.id).toBe(listingId);
        expect(answer.body.data?.amenityIds).toEqual([]);
        expect(answer.body.data?.featureIds).toEqual([]);
        if (vertical === VerticalEnum.EXPERIENCE)
            expect(answer.body.data?.meetingPointDirectionsEnabled).toBe(true);
        expect(await readVerticalStatus(vertical, listingId)).toBe(PublicationStatusEnum.DRAFT);
        const [trial] = await getDb().select().from(trials).where(eq(trials.userId, owner.id));
        expect(trial?.status).toBe('TRIAL_ACTIVE');
        expect(publicationControls.emitCoverageChanged).not.toHaveBeenCalled();
        expect(publicationControls.revalidate).toHaveBeenCalledWith({
            vertical,
            listingIds: [listingId]
        });
    });
});
