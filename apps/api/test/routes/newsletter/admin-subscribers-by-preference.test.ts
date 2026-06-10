/**
 * Unit tests for the admin newsletter subscribers-by-preference route — SPEC-155 T-007.
 *
 * Verifies:
 *  - Handler returns the four-key preference count object on service success.
 *  - Handler throws ServiceError when the service returns an error.
 *  - Handler propagates FORBIDDEN when the actor lacks NEWSLETTER_SUBSCRIBER_VIEW.
 *  - All four keys (OFFERS, EVENTS, GUIDES, PRODUCT_NEWS) are present in the result.
 *  - Zero counts are returned correctly (empty database scenario).
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke it
 * directly. Avoids booting the full Hono application and middleware chain.
 * Copied from the T-012 pilot (apps/api/test/routes/user/admin-stats.test.ts).
 *
 * @module test/routes/newsletter/admin-subscribers-by-preference
 * @see SPEC-155 T-007
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs — available inside vi.mock() factory closures.
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>
    >()
}));

const { mockGetStatsByPreference } = vi.hoisted(() => ({
    mockGetStatsByPreference: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Intercept createAdminRoute to capture the raw handler without mounting Hono.
vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            capturedHandlers.set(config.path, config.handler);
            return config.handler;
        }
    )
}));

// Mock actor extraction so tests can control who is performing the request.
vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Mock the protected newsletter singletons so no real service is instantiated.
vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: vi.fn(() => ({
        getStatsByPreference: mockGetStatsByPreference
    }))
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        log: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';

// Trigger module execution — causes createAdminRoute to be called, which
// stores the handler in capturedHandlers.
await import('../../../src/routes/newsletter/admin/subscribers-by-preference');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW]
};

/**
 * Minimal mock context — the handler only reads the actor via
 * getActorFromContext; it does not call c.json() itself (that is handled
 * by the route factory wrapper).
 */
function buildMockContext(): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        json: vi.fn()
    };
}

/** Retrieve the captured handler for the by-preference path. Throws if not found. */
function getByPreferenceHandler(): (
    ctx: unknown,
    params: unknown,
    body: unknown
) => Promise<unknown> {
    const handler = capturedHandlers.get('/subscribers/by-preference');
    if (!handler) {
        throw new Error('No handler captured for path: /subscribers/by-preference');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminSubscribersByPreferenceRoute handler — SPEC-155 T-007', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('on service success', () => {
        it('returns the four-key preference count object', async () => {
            // Arrange
            const serviceData = {
                OFFERS: 980,
                EVENTS: 870,
                GUIDES: 750,
                PRODUCT_NEWS: 620
            };
            mockGetStatsByPreference.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = await handler(ctx, {}, {});

            // Assert
            expect(result).toEqual(serviceData);
        });

        it('result contains all four expected keys', async () => {
            // Arrange
            const serviceData = { OFFERS: 10, EVENTS: 20, GUIDES: 5, PRODUCT_NEWS: 3 };
            mockGetStatsByPreference.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as typeof serviceData;

            // Assert — all four keys present
            expect(result).toHaveProperty('OFFERS');
            expect(result).toHaveProperty('EVENTS');
            expect(result).toHaveProperty('GUIDES');
            expect(result).toHaveProperty('PRODUCT_NEWS');
        });

        it('handles zero counts (empty database scenario)', async () => {
            // Arrange
            const serviceData = { OFFERS: 0, EVENTS: 0, GUIDES: 0, PRODUCT_NEWS: 0 };
            mockGetStatsByPreference.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as typeof serviceData;

            // Assert
            expect(result.OFFERS).toBe(0);
            expect(result.EVENTS).toBe(0);
            expect(result.GUIDES).toBe(0);
            expect(result.PRODUCT_NEWS).toBe(0);
        });

        it('calls getStatsByPreference with the resolved actor', async () => {
            // Arrange
            const specificActor = { ...ADMIN_ACTOR, id: 'specific-admin-99' };
            mockGetActorFromContext.mockReturnValue(specificActor);
            mockGetStatsByPreference.mockResolvedValue({
                data: { OFFERS: 0, EVENTS: 0, GUIDES: 0, PRODUCT_NEWS: 0 },
                error: undefined
            });

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            await handler(ctx, {}, {});

            // Assert — first argument must be the actor
            expect(mockGetStatsByPreference).toHaveBeenCalledOnce();
            const [calledWithActor] = mockGetStatsByPreference.mock.calls[0] ?? [];
            expect(calledWithActor).toEqual(specificActor);
        });

        it('returns non-negative integer values for all keys', async () => {
            // Arrange
            const serviceData = { OFFERS: 1500, EVENTS: 1200, GUIDES: 900, PRODUCT_NEWS: 750 };
            mockGetStatsByPreference.mockResolvedValue({ data: serviceData, error: undefined });

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act
            const result = (await handler(ctx, {}, {})) as typeof serviceData;

            // Assert — all values are non-negative integers
            for (const [key, value] of Object.entries(result)) {
                expect(typeof value).toBe('number');
                expect(Number.isInteger(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(0);
                void key; // suppress unused-var
            }
        });
    });

    // -----------------------------------------------------------------------
    // Error path
    // -----------------------------------------------------------------------

    describe('on service error', () => {
        it('throws ServiceError when service returns an error object', async () => {
            // Arrange
            mockGetStatsByPreference.mockResolvedValue({
                data: undefined,
                error: { code: 'INTERNAL_ERROR', message: 'DB exploded' }
            });

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('DB exploded');
        });

        it('propagates unexpected thrown errors', async () => {
            // Arrange
            mockGetStatsByPreference.mockRejectedValue(new Error('network timeout'));

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert
            await expect(handler(ctx, {}, {})).rejects.toThrow('network timeout');
        });
    });

    // -----------------------------------------------------------------------
    // Permission / auth
    // -----------------------------------------------------------------------

    describe('permission gating', () => {
        it('handler is registered on path /subscribers/by-preference', () => {
            // Assert — ensures createAdminRoute was called with the correct path
            expect(capturedHandlers.has('/subscribers/by-preference')).toBe(true);
        });

        it('forwards actor to service (service enforces NEWSLETTER_SUBSCRIBER_VIEW)', async () => {
            // The route handler trusts the service to enforce the permission.
            // We verify the actor is passed through correctly.
            const actorWithoutPermissions: Actor = {
                id: 'restricted-user',
                role: RoleEnum.USER,
                permissions: []
            };
            mockGetActorFromContext.mockReturnValue(actorWithoutPermissions);

            // Simulate service throwing FORBIDDEN
            const { ServiceError } = await import('@repo/service-core');
            const { ServiceErrorCode } = await import('@repo/schemas');
            mockGetStatsByPreference.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Permission denied: NEWSLETTER_SUBSCRIBER_VIEW required'
                )
            );

            const handler = getByPreferenceHandler();
            const ctx = buildMockContext() as unknown as Context;

            // Act & Assert — error propagates to the route factory error handler
            await expect(handler(ctx, {}, {})).rejects.toThrow(
                /NEWSLETTER_SUBSCRIBER_VIEW required/
            );
        });
    });
});
