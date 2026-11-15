/**
 * PATCH /api/v1/protected/accommodations/:id: the `reason` of a service error
 * reaches the response (HOS-1810). The editor tells a DUPLICATE_LOCATION 409
 * from any other conflict by it; the route used to drop it.
 */

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockPublish, mockGetById, mockUpdate } = vi.hoisted(() => ({
    mockPublish: vi.fn(),
    mockGetById: vi.fn(),
    mockUpdate: vi.fn()
}));

vi.mock('../../src/services/listing-publication/listing-publication.service', () => ({
    ListingPublicationService: vi.fn().mockImplementation(function () {
        return { publish: mockPublish };
    })
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                publish: mockPublish,
                getById: mockGetById,
                update: mockUpdate
            };
        })
    };
});

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId: ACTOR_ID, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: ACTOR_ID
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'activate_trial', value: 1, strategy: 'MAX' }]
            })
    })
}));

// Actor: HOST owner — ownerId will match actor.id in the accommodation stub.
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mockActor = {
    id: ACTOR_ID,
    roles: ['HOST'],
    permissions: ['accommodation.update.own', 'accommodation.update.any', 'access.panelProtected']
};
vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return {
        ...actual,
        getActorFromContext: () => mockActor
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks are set up
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
const ACCOMMODATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}`;

describe('PATCH /api/v1/protected/accommodations/:id: error reason (HOS-1810)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockGetById.mockResolvedValue({
            data: { id: ACCOMMODATION_ID, ownerId: ACTOR_ID },
            error: undefined
        });
    });

    it('propagates DUPLICATE_LOCATION with its public details', async () => {
        mockUpdate.mockResolvedValue({
            data: undefined,
            error: {
                code: 'ALREADY_EXISTS',
                message: 'Another published listing of yours already occupies this address',
                details: { reason: 'DUPLICATE_LOCATION', existingListingId: 'own-id' },
                reason: 'DUPLICATE_LOCATION'
            }
        });
        const res = await app.request(BASE_URL, {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer test-protected-token',
                'User-Agent': 'vitest',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ street: 'Mitre' })
        });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'DUPLICATE_LOCATION',
            details: { reason: 'DUPLICATE_LOCATION', existingListingId: 'own-id' }
        });
    });
});
