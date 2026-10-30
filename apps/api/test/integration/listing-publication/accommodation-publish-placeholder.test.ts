import { accommodationMedia, accommodations, eq, getDb, trials } from '@repo/db';
import {
    DRAFT_DESCRIPTION_PLACEHOLDER,
    PublicationStatusEnum,
    parsePublishRequirementsReason
} from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createDestination,
    createOwner,
    ensureAccommodationCatalog,
    MATRIX_NOW,
    readResponse,
    resetPublicationControls
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const realDescription = 'A welcoming cabin surrounded by quiet woodland and trails.';

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

async function createOnboardingDraft() {
    const owner = await createOwner();
    const destinationId = await createDestination();
    const started = await app.request('/api/v1/protected/host-onboarding/start', {
        method: 'POST',
        headers: actorHeaders({ id: owner.id }),
        body: JSON.stringify({
            name: 'Onboarding cabin',
            summary: 'A cabin summary long enough for onboarding',
            type: 'CABIN',
            destinationId
        })
    });
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as { data?: { accommodationId?: string } };
    const id = startedBody.data?.accommodationId;
    expect(id).toBeTruthy();
    await getDb()
        .update(accommodations)
        .set({ extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 } })
        .where(eq(accommodations.id, id as string));
    await getDb()
        .insert(accommodationMedia)
        .values({
            accommodationId: id as string,
            url: 'https://example.test/onboarding-main.jpg',
            moderationState: 'APPROVED',
            state: 'visible',
            isFeatured: true,
            sortOrder: 0
        });
    return { id: id as string, owner };
}

async function publish(id: string, ownerId: string) {
    return readResponse(
        await app.request(`/api/v1/protected/accommodations/${id}/publish`, {
            method: 'POST',
            headers: actorHeaders({ id: ownerId })
        })
    );
}

describe('TEST:1722:1 accommodation publish rejects the onboarding placeholder', () => {
    it('reports the missing description and leaves draft and trial unchanged', async () => {
        const { id, owner } = await createOnboardingDraft();
        const [saved] = await getDb()
            .select({ description: accommodations.description })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        expect(saved?.description).toBe(DRAFT_DESCRIPTION_PLACEHOLDER);

        const { status, body } = await publish(id, owner.id);
        expect(status).toBe(400);
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        const reason = (body.error as { readonly reason?: string } | undefined)?.reason;
        expect(parsePublishRequirementsReason({ reason })).toContain('description');
        const [after] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        expect(after?.status).toBe(PublicationStatusEnum.DRAFT);
        expect(await getDb().select().from(trials).where(eq(trials.userId, owner.id))).toHaveLength(
            0
        );
    });

    it('publishes the same complete draft after a real description is saved', async () => {
        const { id, owner } = await createOnboardingDraft();
        await getDb()
            .update(accommodations)
            .set({ description: realDescription })
            .where(eq(accommodations.id, id));

        const { status } = await publish(id, owner.id);
        expect(status).toBe(201);
        const [after] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        expect(after?.status).toBe(PublicationStatusEnum.PUBLISHED);
    });
});
