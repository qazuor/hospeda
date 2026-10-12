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
import { protectedUpdateAccommodationRoute } from '../../src/routes/accommodation/protected/update';
import type { AppBindings } from '../../src/types';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    update: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        update = mocks.update;
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
const VERTICAL = VerticalEnum.ACCOMMODATION;
const BASE = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'base' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

function app(args: { readonly roles: readonly RoleEnum[] }): Hono<AppBindings> {
    const router = new Hono<AppBindings>();
    router.use((ctx, next) => {
        ctx.set('actor', {
            id: OWNER,
            roles: [...args.roles],
            permissions: Object.values(PermissionEnum),
            emailVerified: true
        });
        return next();
    });
    router.route('/update', protectedUpdateAccommodationRoute);
    return router;
}

async function update(router: Hono<AppBindings>) {
    const response = await router.request(`/update/${LISTING}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated listing' })
    });
    return { status: response.status, body: await response.json() };
}

function setEffectiveEntries(args: {
    readonly userId: string;
    readonly entries: readonly {
        readonly key: string;
        readonly value: number;
        readonly strategy: 'MAX' | 'SUM';
    }[];
}): void {
    mocks.effectiveSet.mockImplementation(async () =>
        rehydrateEffectiveSet({
            version: 1,
            userId: args.userId,
            vertical: VERTICAL,
            hasLiveNonTrialTitle: false,
            inheritsTouristVip: false,
            entries: args.entries
        })
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: OWNER
    });
    mocks.coverage.mockResolvedValue({ covered: false, sources: [BASE] });
    setEffectiveEntries({ userId: OWNER, entries: [] });
    mocks.update.mockResolvedValue({ data: {} });
});

describe('AC:V5:17 - a suspended HOST does not operate for holding the role', () => {
    it('a HOST with only the floor set is denied and never reaches update', async () => {
        const result = await update(app({ roles: [RoleEnum.HOST] }));

        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'edit_accommodation_info' }
        });
        expect(mocks.coverage).toHaveBeenCalledWith({ userId: OWNER, vertical: VERTICAL });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('ADMIN and SUPER_ADMIN roles do not change the floor-set denial', async () => {
        const result = await update(
            app({ roles: [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN, RoleEnum.HOST] })
        );

        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'edit_accommodation_info' }
        });
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('allows the HOST when the effective set has the required entitlement', async () => {
        setEffectiveEntries({
            userId: OWNER,
            entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }]
        });
        const result = await update(app({ roles: [RoleEnum.HOST] }));

        expect(result.status).toBe(200);
        expect(mocks.update).toHaveBeenCalledTimes(1);
    });
});
