/**
 * TEST:U1:15 (HOS-1419 / AC:U1:8) — owner writes on a vertical listing run
 * WITHOUT any plan.
 *
 * `PATCH /api/v1/protected/gastronomies/:id` no longer carries an entitlement
 * or limits gate: the whole request goes through the REAL app (auth, actor,
 * route factory, validation) and the REAL `GastronomyService.updateOwn`
 * (ownership + permission chain). Only the persistence layer is replaced by an
 * in-memory model, and NO plan, subscription, entitlement or billing state
 * exists anywhere in the test — so a 200 for the owner proves no plan is
 * needed, while the permission/ownership rejections prove the chain that
 * remains.
 *
 * `x-mock-actor-*` needs all three headers (id, role, permissions); a request
 * with only some of them falls through to the guest actor.
 */
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const BASE = '/api/v1/protected/gastronomies';
const LISTING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STRANGER_ID = '22222222-2222-4222-8222-222222222222';

const { fakeModel } = vi.hoisted(() => ({
    fakeModel: {
        findById: vi.fn(),
        update: vi.fn()
    }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...orig,
        GastronomyService: class InMemoryGastronomyService extends orig.GastronomyService {
            constructor(...args: ConstructorParameters<typeof orig.GastronomyService>) {
                super(...args);
                Object.defineProperty(this, 'model', { value: fakeModel });
            }
        }
    };
});

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId: OWNER_ID, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER_ID
        }),
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: VerticalEnum.GASTRONOMY,
                hasLiveNonTrialTitle: false,
                entries: []
            })
    })
}));

const listingRow = (): Record<string, unknown> => ({
    id: LISTING_ID,
    slug: 'la-parrilla',
    name: 'La Parrilla',
    type: 'PARRILLA',
    summary: 'Una parrilla de prueba.',
    description: 'Descripción detallada de la parrilla de prueba.',
    ownerId: OWNER_ID,
    destinationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    lifecycleState: 'DRAFT',
    visibility: 'PRIVATE',
    averageRating: 0,
    reviewsCount: 0,
    isPriceOnRequest: false,
    moderationState: 'PENDING',
    media: null,
    seo: null,
    socialNetworks: null,
    contactInfo: { mobilePhone: '+541112345678' },
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    richDescription: null,
    openingHours: null,
    deletedAt: null,
    deletedById: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdById: null,
    updatedById: null
});

const headersFor = (input: {
    readonly actorId: string;
    readonly permissions: readonly PermissionEnum[];
}): Record<string, string> => ({
    'content-type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': input.actorId,
    'x-mock-actor-role': RoleEnum.GASTRONOMY_OWNER,
    'x-mock-actor-permissions': JSON.stringify(input.permissions)
});

describe('TEST:U1:15 — owner write on a vertical listing without a plan', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        fakeModel.findById.mockResolvedValue(listingRow());
        fakeModel.update.mockImplementation(
            async (_where: unknown, data: Record<string, unknown>) => ({
                ...listingRow(),
                ...data
            })
        );
    });

    it('lets the owner with permission write, with no plan or entitlement anywhere', async () => {
        const res = await app.request(`${BASE}/${LISTING_ID}`, {
            method: 'PATCH',
            headers: headersFor({
                actorId: OWNER_ID,
                permissions: [PermissionEnum.GASTRONOMY_EDIT_OWN]
            }),
            body: JSON.stringify({ priceRange: 'HIGH' })
        });

        expect(res.status).toBe(200);
        expect(fakeModel.update).toHaveBeenCalledTimes(1);
        const [, written] = fakeModel.update.mock.calls[0] as [unknown, Record<string, unknown>];
        expect(written.priceRange).toBe('HIGH');
    });

    it('rejects an owner without the edit permission and writes nothing', async () => {
        const res = await app.request(`${BASE}/${LISTING_ID}`, {
            method: 'PATCH',
            headers: headersFor({ actorId: OWNER_ID, permissions: [] }),
            body: JSON.stringify({ priceRange: 'HIGH' })
        });

        expect(res.status).toBe(403);
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('answers 404, never 403, to a user who does not own the listing', async () => {
        const res = await app.request(`${BASE}/${LISTING_ID}`, {
            method: 'PATCH',
            headers: headersFor({
                actorId: STRANGER_ID,
                permissions: [PermissionEnum.GASTRONOMY_EDIT_OWN]
            }),
            body: JSON.stringify({ priceRange: 'HIGH' })
        });

        expect(res.status).toBe(404);
        expect(fakeModel.update).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated write with 401', async () => {
        const res = await app.request(`${BASE}/${LISTING_ID}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ priceRange: 'HIGH' })
        });

        expect(res.status).toBe(401);
        expect(fakeModel.update).not.toHaveBeenCalled();
    });
});
