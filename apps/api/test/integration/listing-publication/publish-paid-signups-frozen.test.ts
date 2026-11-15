import { accommodations, eq, getDb, platformSettings, trials } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
const publishUrl = (id: string) => `/api/v1/protected/accommodations/${id}/publish`;

async function setFreeze(frozen: boolean, updatedBy: string): Promise<void> {
    await getDb()
        .insert(platformSettings)
        .values({
            key: 'billing.paidSignupsFreeze',
            value: { frozen },
            updatedBy
        })
        .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value: { frozen }, updatedBy }
        });
}

async function publish(id: string, ownerId: string) {
    return readResponse(
        await app.request(publishUrl(id), {
            method: 'POST',
            headers: actorHeaders({
                id: ownerId,
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
            })
        })
    );
}

async function ownerWithDraft() {
    const owner = await createOwner();
    const listingId = await createListing({
        ownerId: owner.id,
        destinationId: await createDestination(),
        status: PublicationStatusEnum.DRAFT
    });
    return { owner, listingId };
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

describe('HOS-1749 POST /protected/accommodations/:id/publish answers 409 FIRST_PUBLISH_PAUSED while frozen', () => {
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
    afterEach(async () => {
        await getDb()
            .delete(platformSettings)
            .where(eq(platformSettings.key, 'billing.paidSignupsFreeze'));
    });
    afterAll(async () => testDb.teardown());

    it('frozen first publish answers 409 FIRST_PUBLISH_PAUSED and leaves the listing in draft', async () => {
        const { owner, listingId } = await ownerWithDraft();
        await setFreeze(true, owner.id);

        const response = await publish(listingId, owner.id);
        const listingStatus = await statusOf(listingId);
        const ownerTrials = await trialsOf(owner.id);

        expect(response.status).toBe(409);
        expect(response.body.error).toMatchObject({
            code: 'NEW_PAID_SIGNUPS_FROZEN',
            reason: 'FIRST_PUBLISH_PAUSED'
        });
        expect(listingStatus).toBe(PublicationStatusEnum.DRAFT);
        expect(ownerTrials).toEqual([]);
    });

    it('a covered owner can publish while new signups are frozen', async () => {
        const { owner, listingId } = await ownerWithDraft();
        await setFreeze(true, owner.id);
        publicationControls.covered = true;

        const response = await publish(listingId, owner.id);

        expect(response.status).toBe(201);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await trialsOf(owner.id)).toEqual([]);
    });

    it('an owner whose trial is spent keeps subscription_required while signups are frozen', async () => {
        const { owner, listingId } = await ownerWithDraft();
        await setFreeze(true, owner.id);
        await createTrial({ userId: owner.id, status: 'TRIAL_EXPIRED' });

        const response = await publish(listingId, owner.id);

        expect(response.status).toBe(403);
        expect(response.body.error).toMatchObject({
            code: 'FORBIDDEN',
            message: 'subscription_required'
        });
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.DRAFT);
        expect(await trialsOf(owner.id)).toHaveLength(1);
    });

    it('an absent freeze row allows first publish and starts the trial', async () => {
        const { owner, listingId } = await ownerWithDraft();

        const response = await publish(listingId, owner.id);
        const ownerTrials = await trialsOf(owner.id);

        expect(response.status).toBe(201);
        expect(await statusOf(listingId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(ownerTrials).toHaveLength(1);
        expect(ownerTrials[0]?.status).toBe('TRIAL_ACTIVE');
    });
});
