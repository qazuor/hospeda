import {
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enforceListingAccess } from '../../src/middlewares/listing-access';
import type { AppBindings } from '../../src/types';
import { handleRouteError } from '../../src/utils/response-helpers';

vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn()
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const LISTING = '33333333-3333-4333-8333-333333333333';
const vertical = VerticalEnum.ACCOMMODATION;

function appFor(args: {
    actorId?: string;
    permissions?: PermissionEnum[];
    tier?: 'protected' | 'admin';
    operation?: 'EDIT' | 'PUBLISH';
    limit?: number;
}) {
    const app = new Hono<AppBindings>();
    const requested = args.limit;
    app.get('/:id', async (c) => {
        c.set('actor', {
            id: args.actorId ?? OWNER,
            roles: [RoleEnum.ADMIN],
            permissions: args.permissions ?? [],
            emailVerified: true
        });
        try {
            await enforceListingAccess({
                ctx: c,
                params: { id: c.req.param('id') },
                config: {
                    vertical,
                    operation: args.operation ?? 'EDIT',
                    limit:
                        requested === undefined
                            ? undefined
                            : async () => ({ key: 'max_photos_per_accommodation', requested })
                },
                tier: args.tier ?? 'protected'
            });
            return c.json(c.get('listingAccess'));
        } catch (error) {
            return handleRouteError(error, c);
        }
    });
    app.get('/ownership/missing', (c) =>
        handleRouteError(new HTTPException(404, { message: 'accommodation not found' }), c)
    );
    return app;
}

async function probe(app: Hono<AppBindings>, path = `/${LISTING}`) {
    const response = await app.request(path);
    const body = await response.json();
    return { status: response.status, body };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: OWNER
    });
    mocks.coverage.mockResolvedValue({ covered: false, sources: [{ type: 'BASE' }] });
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: false,
            entries: []
        })
    );
});

describe('AC:V5:9 listing access HTTP mapping', () => {
    it('maps NOT_FOUND to the identical ownership 404 body', async () => {
        mocks.loadFacts.mockResolvedValue({ facts: null, ownerId: null });
        const app = appFor({});
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const missing = await probe(app);
        const ownership = await probe(app, '/ownership/missing');
        vi.useRealTimers();
        expect(missing.status).toBe(404);
        expect(missing.body).toEqual(ownership.body);
    });

    it('maps FORBIDDEN on an admin foreign write without the action permission', async () => {
        const result = await probe(appFor({ actorId: ADMIN, tier: 'admin' }));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
    });

    it('maps NO_COVERAGE with public details', async () => {
        mocks.coverage.mockResolvedValue({ covered: false, sources: [] });
        const result = await probe(appFor({}));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: null, reason: 'NO_COVERAGE' }
        });
    });

    it('maps NO_CAPABILITY with its key', async () => {
        const result = await probe(appFor({}));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'edit_accommodation_info' }
        });
    });

    it('maps LIMIT_REACHED with requested minus one and the subject limit', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: [
                    { key: 'edit_accommodation_info', value: 1, strategy: 'MAX' },
                    { key: 'max_photos_per_accommodation', value: 10, strategy: 'MAX' }
                ]
            })
        );
        const result = await probe(appFor({ limit: 11 }));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_photos_per_accommodation', currentCount: 10, maxAllowed: 10 }
        });
    });
});

describe('AC:V5:8 foreign listing subject', () => {
    it('hides a protected foreign write without the action permission', async () => {
        const result = await probe(appFor({ actorId: ADMIN }));
        expect(result.status).toBe(404);
        expect(result.body.error).toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });

    it('uses the owner for coverage and effective set when the admin holds action 15', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }]
            })
        );
        const result = await probe(
            appFor({
                actorId: ADMIN,
                tier: 'admin',
                permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
            })
        );
        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ subjectId: OWNER, evaluatedSteps: [3, 4, 5, 6] });
        expect(mocks.coverage).toHaveBeenCalledWith({ userId: OWNER, vertical });
        expect(mocks.effectiveSet).toHaveBeenCalledWith({ userId: OWNER, vertical });
    });

    it('keeps owner actions outside the administrative branch', async () => {
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER
        });
        const result = await probe(
            appFor({ permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT] })
        );
        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ subjectId: OWNER, evaluatedSteps: [4, 5] });
    });
});
