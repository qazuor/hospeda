import { type PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { expect } from 'vitest';
import { clearEntityFetchers } from '../../src/middlewares/ownership';
import { createErrorHandler } from '../../src/middlewares/response';
import { protectedAccommodationRoutes } from '../../src/routes/accommodation/protected/index';
import { protectedBillingSubscriptionReadRoutes } from '../../src/routes/billing-subscription';
import { protectedExperienceRoutes } from '../../src/routes/experience/protected/index';
import { protectedGastronomyRoutes } from '../../src/routes/gastronomy/protected/index';
import { protectedUserRoutes } from '../../src/routes/user/protected/index';
import type { AppBindings } from '../../src/types';
import { registerEntityFetchers } from '../../src/utils/entity-fetchers';

/** Shared IDs for the step-2 staff bypass route tests. */
export const OWNER_ID = '11111111-1111-4111-8111-111111111111';
/** Shared foreign actor ID for the step-2 staff bypass route tests. */
export const OTHER_ID = '22222222-2222-4222-8222-222222222222';
/** Shared listing ID for the step-2 staff bypass route tests. */
export const LISTING_ID = '33333333-3333-4333-8333-333333333333';

/** Registers entity fetchers before each route test suite. */
export function registerTestEntityFetchers(_options: Record<string, never>): void {
    registerEntityFetchers();
}

/** Clears entity fetchers after each route test suite. */
export function clearTestEntityFetchers(_options: Record<string, never>): void {
    clearEntityFetchers();
}

type RouteProbeOptions = {
    readonly actorId: string;
    readonly emailVerified: boolean;
    readonly permissions: PermissionEnum[];
    readonly path: string;
    readonly method?: 'GET' | 'POST';
};

function buildApp(options: RouteProbeOptions) {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use('*', (ctx, next) => {
        ctx.set('actor', {
            id: options.actorId,
            roles: [RoleEnum.USER],
            permissions: options.permissions,
            emailVerified: options.emailVerified
        });
        return next();
    });
    app.route('/api/v1/protected/users', protectedUserRoutes);
    app.route('/api/v1/protected/accommodations', protectedAccommodationRoutes);
    app.route('/api/v1/protected/gastronomies', protectedGastronomyRoutes);
    app.route('/api/v1/protected/experiences', protectedExperienceRoutes);
    app.route('/api/v1/protected/billing-subscription', protectedBillingSubscriptionReadRoutes);
    return app;
}

/** Sends a request through the real protected routers and removes volatile metadata. */
export async function probe(options: RouteProbeOptions) {
    const response = await buildApp(options).request(options.path, {
        method: options.method ?? (options.path.includes('/reactivate') ? 'POST' : 'GET')
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    delete body.metadata;
    return { status: response.status, body };
}

type ListingAccessMockPorts = {
    readonly loadFacts: { mockResolvedValue(value: unknown): unknown };
    readonly coverage: { mockResolvedValue(value: unknown): unknown };
    readonly effectiveSet: { mockResolvedValue(value: unknown): unknown };
};

/** Stubs listing access ports for the requested owner and publication state. */
export function setPorts(options: {
    readonly ownerId: string;
    readonly publicationStatus?: PublicationStatusEnum;
    readonly ports: ListingAccessMockPorts;
}): void {
    options.ports.loadFacts.mockResolvedValue({
        facts: {
            ownerId: options.ownerId,
            publicationStatus: options.publicationStatus ?? PublicationStatusEnum.DRAFT
        },
        ownerId: options.ownerId
    });
    options.ports.coverage.mockResolvedValue({ covered: false, sources: [] });
    options.ports.effectiveSet.mockResolvedValue({ entitlements: { get: () => 0 } });
}

/** Builds the listing fixture used by route service spies. */
export function listing(options: {
    readonly ownerId: string;
    readonly publicationStatus?: PublicationStatusEnum;
}) {
    return {
        id: LISTING_ID,
        ownerId: options.ownerId,
        publicationStatus: options.publicationStatus ?? PublicationStatusEnum.DRAFT
    };
}

/** Asserts the result was not rejected by the unverified-email gate. */
export function expectNotEmailNotVerified(options: {
    readonly result: Awaited<ReturnType<typeof probe>>;
}): void {
    expect((options.result.body.error as { code?: string } | undefined)?.code).not.toBe(
        'EMAIL_NOT_VERIFIED'
    );
}
