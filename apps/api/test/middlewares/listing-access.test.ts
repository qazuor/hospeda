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
import { createGuestActor } from '../../src/utils/actor';
import { apiLogger } from '../../src/utils/logger';
import { handleRouteError } from '../../src/utils/response-helpers';

vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    subscribeDestination: vi.fn()
}));
vi.mock('../../src/services/listing-publication/subscribe-destination.service', () => ({
    resolveSubscribeDestinationForUser: (...args: unknown[]) => mocks.subscribeDestination(...args)
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
    operation?: 'EDIT' | 'PUBLISH' | 'DELETE';
    administrativeAction?: 'ACC_15' | 'ACC_23';
    limit?: number;
    guest?: boolean;
}) {
    const app = new Hono<AppBindings>();
    const requested = args.limit;
    app.get('/:id', async (c) => {
        c.set(
            'actor',
            args.guest
                ? createGuestActor()
                : {
                      id: args.actorId ?? OWNER,
                      roles: [RoleEnum.ADMIN],
                      permissions: args.permissions ?? [],
                      emailVerified: true
                  }
        );
        try {
            await enforceListingAccess({
                ctx: c,
                params: { id: c.req.param('id') },
                config: {
                    vertical,
                    operation: args.operation ?? 'EDIT',
                    administrativeAction: args.administrativeAction,
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
    mocks.subscribeDestination.mockResolvedValue({
        destination: 'CHECKOUT',
        reason: 'USER_ALREADY_HAS_TRIAL_ROW'
    });
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: false,
            inheritsTouristVip: false,
            entries: []
        })
    );
});

describe('AC:V5:9 listing access HTTP mapping', () => {
    it('maps UNAUTHENTICATED for the API guest to 401 before reading coverage', async () => {
        const result = await probe(appFor({ guest: true }));
        expect(result.status).toBe(401);
        expect(result.body.error).toMatchObject({ code: ServiceErrorCode.UNAUTHORIZED });
        expect(mocks.coverage).not.toHaveBeenCalled();
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

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

    it('maps a PUBLISH denial without commercial coverage to PB1 subscription_required', async () => {
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER
        });
        const result = await probe(appFor({ operation: 'PUBLISH' }));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.FORBIDDEN,
            message: 'subscription_required'
        });
    });

    it('keeps PUBLISH denied when resolving the subscribe destination fails', async () => {
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER
        });
        mocks.subscribeDestination.mockRejectedValue(new Error('reader unavailable'));
        const logSpy = vi.spyOn(apiLogger, 'error').mockImplementation(() => undefined);
        try {
            const result = await probe(appFor({ operation: 'PUBLISH' }));
            expect(result.status).toBe(403);
            expect(result.body.error).toMatchObject({
                code: ServiceErrorCode.FORBIDDEN,
                message: 'subscription_required'
            });
            expect(logSpy).toHaveBeenCalledWith(
                expect.objectContaining({ userId: OWNER, vertical, error: 'reader unavailable' }),
                'Failed to resolve listing publication subscribe destination'
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    it('maps a PUBLISH denial to no_plans_available only when the canonical destination has no plans', async () => {
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER
        });
        mocks.subscribeDestination.mockResolvedValue({ destination: 'NO_PLANS_AVAILABLE' });
        const result = await probe(appFor({ operation: 'PUBLISH' }));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.FORBIDDEN,
            message: 'no_plans_available'
        });
        expect(mocks.subscribeDestination).toHaveBeenCalledWith({ userId: OWNER, vertical });
    });

    it('keeps ENTITLEMENT_REQUIRED when covered but missing the PUBLISH capability', async () => {
        mocks.loadFacts.mockResolvedValue({
            facts: { ownerId: OWNER, publicationStatus: PublicationStatusEnum.DRAFT },
            ownerId: OWNER
        });
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: []
            })
        );
        const result = await probe(appFor({ operation: 'PUBLISH' }));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            message: 'Entitlement required'
        });
    });

    it('keeps EDIT denials as ENTITLEMENT_REQUIRED without commercial coverage', async () => {
        const result = await probe(appFor({ operation: 'EDIT' }));
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            message: 'Entitlement required'
        });
    });

    it('maps LIMIT_REACHED with requested minus one and the subject limit', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
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
                inheritsTouristVip: false,
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

describe('AC:V5:26 route capabilities on the subject', () => {
    it('passes capabilities array as requiredKeys to the resolver', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' as const }]
            })
        );
        const app = new Hono<AppBindings>();
        app.get('/:id', async (c) => {
            c.set('actor', {
                id: OWNER,
                roles: [RoleEnum.ADMIN],
                permissions: [],
                emailVerified: true
            });
            try {
                await enforceListingAccess({
                    ctx: c,
                    params: { id: c.req.param('id') },
                    config: {
                        vertical,
                        operation: 'EDIT',
                        capabilities: ['can_use_calendar']
                    },
                    tier: 'protected',
                    body: {}
                });
                return c.json(c.get('listingAccess'));
            } catch (error) {
                return handleRouteError(error, c);
            }
        });
        const result = await probe(app);
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'can_use_calendar' }
        });
    });

    it('capabilities function receives body and resolves requiredKeys', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' as const }]
            })
        );
        let capturedBody: Record<string, unknown> | undefined;
        const app = new Hono<AppBindings>();
        app.get('/:id', async (c) => {
            c.set('actor', {
                id: OWNER,
                roles: [RoleEnum.ADMIN],
                permissions: [],
                emailVerified: true
            });
            try {
                await enforceListingAccess({
                    ctx: c,
                    params: { id: c.req.param('id') },
                    config: {
                        vertical,
                        operation: 'EDIT',
                        capabilities: ({ body }) => {
                            capturedBody = body;
                            return body && 'photo' in body ? ['can_use_calendar'] : [];
                        }
                    },
                    tier: 'protected',
                    body: { photo: true }
                });
                return c.json(c.get('listingAccess'));
            } catch (error) {
                return handleRouteError(error, c);
            }
        });
        const result = await probe(app);
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'can_use_calendar' }
        });
        expect(capturedBody).toEqual({ photo: true });
    });

    it('no capabilities: no requiredKeys passed', async () => {
        const app = new Hono<AppBindings>();
        app.get('/:id', async (c) => {
            c.set('actor', {
                id: OWNER,
                roles: [RoleEnum.ADMIN],
                permissions: [],
                emailVerified: true
            });
            try {
                await enforceListingAccess({
                    ctx: c,
                    params: { id: c.req.param('id') },
                    config: { vertical, operation: 'EDIT' },
                    tier: 'protected',
                    body: undefined
                });
                return c.json(c.get('listingAccess'));
            } catch (error) {
                return handleRouteError(error, c);
            }
        });
        const result = await probe(app);
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({
            code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
            details: { entitlementKey: 'edit_accommodation_info' }
        });
    });
});

describe('TEST:V8a:9 each listing administrative action asks for its own permission', () => {
    it.each([
        [
            'an ACC_23 route to the action 15 holder',
            'DELETE',
            'ACC_23',
            'LISTING_FOREIGN_CONTENT_EDIT'
        ],
        ['an ACC_15 route asked to DELETE', 'DELETE', 'ACC_15', 'LISTING_FOREIGN_CONTENT_EDIT'],
        [
            'an EDIT route (default ACC_15) to the action 23 holder',
            'EDIT',
            undefined,
            'LISTING_PURGE_ON_REQUEST'
        ]
    ] as const)('refuses %s with 403 before coverage', async (_label, operation, action, permission) => {
        const app = appFor({
            actorId: ADMIN,
            tier: 'admin',
            operation,
            administrativeAction: action,
            permissions: [PermissionEnum[permission]]
        });
        const result = await probe(app);
        expect(result.status).toBe(403);
        expect(result.body.error).toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(mocks.coverage).not.toHaveBeenCalled();
        expect(mocks.effectiveSet).not.toHaveBeenCalled();
    });

    it('lets an admin holding the action 23 permission purge with the owner as subject', async () => {
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [{ key: 'recover_own_listing', value: 1, strategy: 'MAX' }]
            })
        );
        const app = appFor({
            actorId: ADMIN,
            tier: 'admin',
            operation: 'DELETE',
            administrativeAction: 'ACC_23',
            permissions: [PermissionEnum.LISTING_PURGE_ON_REQUEST]
        });
        const result = await probe(app);
        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ subjectId: OWNER });
        expect(result.body.evaluatedSteps).toContain(3);
        expect(mocks.effectiveSet).toHaveBeenCalledWith({ userId: OWNER, vertical });
    });
});
