import {
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { protectedCreateAccommodationDraftRoute } from '../../src/routes/accommodation/protected/createDraft';
import { protectedPublishAccommodationRoute } from '../../src/routes/accommodation/protected/publish';
import { protectedUpdateAccommodationRoute } from '../../src/routes/accommodation/protected/update';
import type { AppBindings } from '../../src/types';
import { createProtectedRoute } from '../../src/utils/route-factory';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    publish: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        create = mocks.create;
        update = mocks.update;
        publish = mocks.publish;
    }
}));
vi.mock('../../src/middlewares/ownership', () => ({
    ownershipMiddleware: () => async (_ctx: unknown, next: () => Promise<void>) => next()
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));
vi.mock('../../src/utils/entitlement-filter', () => ({
    stripRichDescriptionFields: () =>
        new Response(JSON.stringify({ ok: true }), {
            headers: { 'content-type': 'application/json' }
        })
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const LISTING = '33333333-3333-4333-8333-333333333333';
const vertical = VerticalEnum.ACCOMMODATION;
const baseSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'base' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

function app() {
    const router = new Hono<AppBindings>();
    router.use((c, next) => {
        c.set('actor', {
            id: OWNER,
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.ACCOMMODATION_CREATE],
            emailVerified: true
        });
        return next();
    });
    router.route('/update', protectedUpdateAccommodationRoute);
    router.route('/publish', protectedPublishAccommodationRoute);
    router.route('/draft', protectedCreateAccommodationDraftRoute);
    return router;
}

async function post(router: Hono<AppBindings>, path: string, body?: unknown) {
    const response = await router.request(path, {
        method: path.startsWith('/update') ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: OWNER
    });
    mocks.coverage.mockResolvedValue({ covered: false, sources: [baseSource] });
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: false,
            entries: []
        })
    );
    mocks.create.mockResolvedValue({ data: {} });
    mocks.update.mockResolvedValue({ data: {} });
    mocks.publish.mockResolvedValue({ data: {} });
});

describe('TEST:V5:10 coverage step on three accommodation pilots', () => {
    it('rejects PUT update at step 6 after BASE coverage, without calling the service', async () => {
        const result = await post(app(), `/update/${LISTING}`, { name: 'Updated listing' });
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'edit_accommodation_info' }
        });
        expect(mocks.coverage).toHaveBeenCalledWith({ userId: OWNER, vertical });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('rejects POST publish on a DRAFT without either publication capability', async () => {
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER
        });
        const result = await post(app(), `/publish/${LISTING}/publish`);
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'publish_accommodations' }
        });
        expect(mocks.coverage).toHaveBeenCalledWith({ userId: OWNER, vertical });
        expect(mocks.publish).not.toHaveBeenCalled();
    });

    it('allows CREATE with BASE and no step-6 key', async () => {
        const result = await post(app(), '/draft/draft', {
            name: 'Draft listing',
            summary: 'A valid draft listing',
            type: 'HOTEL',
            destinationId: '44444444-4444-4444-8444-444444444444'
        });
        expect(result.status).toBe(200);
        expect(mocks.coverage).toHaveBeenCalledWith({ userId: OWNER, vertical });
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
        expect(mocks.create).toHaveBeenCalledOnce();
    });

    it('lets an update with the capability reach the service', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }]
            })
        );
        const result = await post(app(), `/update/${LISTING}`, { name: 'Updated listing' });
        expect(result.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledOnce();
    });
});

describe('TEST:V5:10 route factory ordering', () => {
    it('rejects an undeclared listing id at route construction', () => {
        expect(() =>
            createProtectedRoute({
                method: 'put',
                path: '/{slug}',
                summary: 'Test',
                description: 'Test',
                tags: ['Test'],
                responseSchema: z.object({ ok: z.boolean() }),
                listingAccess: { vertical, operation: 'EDIT', idParam: 'id' },
                handler: async () => ({ ok: true })
            })
        ).toThrow(/listingAccess/);
    });

    it('answers 400 for an invalid body before calling coverage', async () => {
        const result = await post(app(), `/update/${LISTING}`, { name: 4 });
        expect(result.status).toBe(400);
        expect(mocks.coverage).not.toHaveBeenCalled();
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
