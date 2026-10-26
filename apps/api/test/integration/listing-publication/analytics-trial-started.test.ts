import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import {
    createAnalyticsFactSink,
    resetAnalyticsFactSinkForTests,
    setAnalyticsFactSinkForTests
} from '../../../src/utils/analytics/analytics-facts';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createDestination,
    createListing,
    createOwner,
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
const publish = (id: string, ownerId: string) =>
    app.request(`/api/v1/protected/accommodations/${id}/publish`, {
        method: 'POST',
        headers: actorHeaders({ id: ownerId })
    });

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
afterEach(resetAnalyticsFactSinkForTests);
afterAll(async () => testDb.teardown());

describe('TEST:1878:20 publication trial analytics', () => {
    it('emits trial_started only when this publish started T1', async () => {
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        const owner = await createOwner();
        const destinationId = await createDestination();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT,
            complete: true
        });
        const response = await readResponse(await publish(listingId, owner.id));
        expect(response.status).toBe(201);
        expect(capture).toHaveBeenCalledTimes(1);
        const captured = capture.mock.calls[0]?.[0];
        expect(captured?.name).toBe('trial_started');
        expect(captured?.distinctId).toBe(owner.id);
        expect(captured?.properties).toEqual({
            vertical: VerticalEnum.ACCOMMODATION,
            actor_kind: 'USER',
            activation_event: 'listing_published',
            trial_days: undefined
        });
    });

    it('does not emit when publication does not start a new trial', async () => {
        const capture = vi.fn();
        setAnalyticsFactSinkForTests(createAnalyticsFactSink({ capture }));
        publicationControls.covered = true;
        const owner = await createOwner();
        const destinationId = await createDestination();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT,
            complete: true
        });
        const response = await readResponse(await publish(listingId, owner.id));
        expect(response.status).toBe(201);
        expect(capture).toHaveBeenCalledTimes(0);
    });
});
