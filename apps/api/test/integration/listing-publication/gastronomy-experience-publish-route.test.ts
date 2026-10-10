/** TEST:V6:2/3 — PB1 over the real HTTP stack for gastronomy and experience. */
import { randomUUID } from 'node:crypto';
import { eq, getDb, trials } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { computeTrialEmailPseudonym } from '@repo/service-core';
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
const verticals = [VerticalEnum.GASTRONOMY, VerticalEnum.EXPERIENCE] as const;
const url = (vertical: (typeof verticals)[number], id: string) =>
    `/api/v1/protected/${vertical === VerticalEnum.GASTRONOMY ? 'gastronomies' : 'experiences'}/${id}/publish`;

function publish(
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
    complete = true
) {
    const owner = await createOwner();
    const listingId = await createVerticalListing({
        vertical,
        ownerId: owner.id,
        destinationId: await createVerticalDestination(),
        status,
        complete
    });
    return { owner, listingId };
}

async function trialsOf(userId: string) {
    return getDb().select().from(trials).where(eq(trials.userId, userId));
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

describe.each(verticals)('PB1 route — %s (TEST:V6:2/3)', (vertical) => {
    beforeEach(async () => ensurePublicationCatalog(vertical));

    it('answers 401 UNAUTHORIZED without a session', async () => {
        const { listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        const answer = await readResponse(await publish(vertical, listingId));
        expect(answer.status).toBe(401);
        expect(answer.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('answers 403 FORBIDDEN to a foreign publish by an admin with LISTING_FOREIGN_CONTENT_EDIT', async () => {
        const { listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        const viewPermission =
            vertical === VerticalEnum.GASTRONOMY
                ? PermissionEnum.GASTRONOMY_VIEW_ALL
                : PermissionEnum.EXPERIENCE_VIEW_ALL;
        const answer = await readResponse(
            await publish(
                vertical,
                listingId,
                actorHeaders({
                    id: randomUUID(),
                    role: RoleEnum.ADMIN,
                    permissions: [viewPermission, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
                })
            )
        );
        expect(answer.status).toBe(403);
        expect(answer.body.error?.code).toBe('FORBIDDEN');
    });

    // open question AC:V6:2 — V5 step 6 currently answers before PB1 when T1 is spent.
    it('records the current 403 ENTITLEMENT_REQUIRED for an owner whose trial is spent', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_EXPIRED' });
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(403);
        expect(answer.body.error?.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('answers 400 VALIDATION_ERROR to a malformed id', async () => {
        const owner = await createOwner();
        const answer = await readResponse(
            await publish(vertical, 'not-a-uuid', actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(400);
        expect(answer.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers the same 404 NOT_FOUND to foreign and missing listings', async () => {
        const { listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        const actorId = randomUUID();
        const foreign = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: actorId }))
        );
        const missing = await readResponse(
            await publish(vertical, randomUUID(), actorHeaders({ id: actorId }))
        );
        expect(foreign.status).toBe(404);
        expect(foreign.body.error?.code).toBe('NOT_FOUND');
        expect(foreign.body.error).toEqual(missing.body.error);
    });

    it('answers 404 NOT_FOUND for a PUBLISHED listing', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.PUBLISHED);
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(404);
        expect(answer.body.error?.code).toBe('NOT_FOUND');
    });

    it('answers 400 VALIDATION_ERROR with missing fields when completeness fails', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.DRAFT, false);
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(400);
        expect(answer.body.error?.code).toBe('VALIDATION_ERROR');
        expect(answer.body.error?.message).toContain('media.featuredImage');
        expect(await readVerticalStatus(vertical, listingId)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('answers 400 VALIDATION_ERROR when the owner email cannot seed T1', async () => {
        const owner = await createOwner({ email: `invalid-${randomUUID()}` });
        const listingId = await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: PublicationStatusEnum.DRAFT
        });
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(400);
        expect(answer.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers 403 LIMIT_REACHED with the vertical limitKey when covered capacity is full', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: PublicationStatusEnum.PUBLISHED
        });
        publicationControls.covered = true;
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(403);
        expect(answer.body.error?.code).toBe('LIMIT_REACHED');
        expect(answer.body.error?.details?.limitKey).toBe(
            vertical === 'gastronomy' ? 'max_gastronomies' : 'max_experiences'
        );
    });

    it('answers 409 ALREADY_EXISTS for covered UNPUBLISHED_BY_BILLING (PB3 owns restoration)', async () => {
        const { owner, listingId } = await listing(
            vertical,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        );
        publicationControls.covered = true;
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(409);
        expect(answer.body.error?.code).toBe('ALREADY_EXISTS');
    });

    it('answers 403 FORBIDDEN subscription_required when the trial slot is occupied', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: PublicationStatusEnum.PUBLISHED
        });
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(403);
        expect(answer.body.error?.code).toBe('FORBIDDEN');
        expect(answer.body.error?.message).toBe('subscription_required');
    });

    it('answers subscription_required when the email pseudonym already consumed T1', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        const pseudonym = computeTrialEmailPseudonym({ email: owner.email });
        if (!pseudonym.ok) throw new Error('Fixture mailbox was rejected');
        const previous = await createOwner();
        await createTrial({
            userId: previous.id,
            vertical,
            status: 'TRIAL_EXPIRED',
            emailPseudonym: pseudonym.pseudonym
        });
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(403);
        expect(answer.body.error?.code).toBe('FORBIDDEN');
        expect(answer.body.error?.message).toBe('subscription_required');
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    ])('starts T1 and publishes from %s in the same act', async (from) => {
        const { owner, listingId } = await listing(vertical, from);
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(201);
        expect(answer.body.data?.id).toBe(listingId);
        expect(answer.body.data?.amenityIds).toEqual([]);
        expect(answer.body.data?.featureIds).toEqual([]);
        if (vertical === VerticalEnum.EXPERIENCE)
            expect(answer.body.data?.meetingPointDirectionsEnabled).toBe(true);
        expect(await readVerticalStatus(vertical, listingId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect((await trialsOf(owner.id))[0]?.status).toBe('TRIAL_ACTIVE');
        expect(publicationControls.emitCoverageChanged).toHaveBeenCalledTimes(1);
        expect(publicationControls.revalidate).toHaveBeenCalledWith({
            vertical,
            listingIds: [listingId]
        });
    });

    it('publishes a covered DRAFT without starting a trial', async () => {
        const { owner, listingId } = await listing(vertical, PublicationStatusEnum.DRAFT);
        publicationControls.covered = true;
        const answer = await readResponse(
            await publish(vertical, listingId, actorHeaders({ id: owner.id }))
        );
        expect(answer.status).toBe(201);
        expect(answer.body.data?.amenityIds).toEqual([]);
        expect(answer.body.data?.featureIds).toEqual([]);
        if (vertical === VerticalEnum.EXPERIENCE)
            expect(answer.body.data?.meetingPointDirectionsEnabled).toBe(true);
        expect(await readVerticalStatus(vertical, listingId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await trialsOf(owner.id)).toHaveLength(0);
        expect(publicationControls.emitCoverageChanged).not.toHaveBeenCalled();
    });

    it('serializes concurrent PB1 requests under one covered slot (TEST:V6:3)', async () => {
        const owner = await createOwner();
        const destinationId = await createVerticalDestination();
        const ids = await Promise.all(
            [1, 2].map(() =>
                createVerticalListing({
                    vertical,
                    ownerId: owner.id,
                    destinationId,
                    status: PublicationStatusEnum.DRAFT
                })
            )
        );
        publicationControls.covered = true;
        const answers = await Promise.all(
            ids.map(async (id) =>
                readResponse(await publish(vertical, id, actorHeaders({ id: owner.id })))
            )
        );
        expect(answers.map((answer) => answer.status).sort()).toEqual([201, 403]);
        expect(answers.find((answer) => answer.status === 403)?.body.error?.code).toBe(
            'LIMIT_REACHED'
        );
        const statuses = await Promise.all(ids.map((id) => readVerticalStatus(vertical, id)));
        expect(
            statuses.filter((status) => status === PublicationStatusEnum.PUBLISHED)
        ).toHaveLength(1);
    });
});
