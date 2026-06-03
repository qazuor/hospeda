/**
 * SPEC-182 T-013 — Permission matrix integration test for `signup-as-host`.
 *
 * Endpoint: POST /api/v1/admin/auth/signup-as-host
 * Route tier: ADMIN (createAdminRoute), requiredPermissions: [USER_CREATE]
 *
 * Test cases:
 *   (a) Authenticated actor WITH USER_CREATE → 201 + body has user.role === 'HOST'
 *   (b) Unauthenticated (no actor headers) → 401
 *   (c) Authenticated actor WITHOUT USER_CREATE → 403
 *   (d) Authenticated WITH USER_CREATE but invalid body → 400 (Zod validation)
 *   (e) Duplicate email → not 200/201, status >= 400
 *
 * Strategy for (a)/(e):
 *   `getAuth` from `apps/api/src/lib/auth` is mocked via `vi.mock` so that
 *   `getAuth().api.signUpEmail` returns a stub user for the first call and
 *   returns null/throws for the duplicate case. The `@repo/db` mock provides
 *   a chainable query builder (update/set/where) as a no-op so the role
 *   UPDATE step succeeds without a real database.
 *
 * Cases (b)/(c)/(d) are pure middleware/validation assertions — the handler
 * never runs because the auth gate fires first.
 *
 * @module test/integration/auth/signup-as-host
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Environment variables — MUST be set at module scope before any src/ import.
// The e2e config loads .env.test via env-setup.ts, which already sets most
// vars including HOSPEDA_ALLOW_MOCK_ACTOR=true and NODE_ENV=test. We delete
// CI here to ensure isMockActorAllowed() returns true (see actor.ts:44).
// ---------------------------------------------------------------------------
// biome-ignore lint/performance/noDelete: required to ensure isMockActorAllowed() sees no CI flag
delete process.env.CI;

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE any import that transitively loads
// the mocked module so Vitest can hoist them properly.
// ---------------------------------------------------------------------------

/**
 * Mutable holder for signUpEmail behaviour, configured per-test.
 * Cleared in beforeEach via vi.clearAllMocks().
 */
const signUpEmailFn = vi.fn();

vi.mock('../../../src/lib/auth', () => ({
    getAuth: () => ({
        api: {
            signUpEmail: signUpEmailFn,
            // getSession is consumed by the global auth middleware when NOT in
            // DISABLE_AUTH mode; kept as a stub for completeness.
            getSession: vi.fn().mockResolvedValue(null)
        },
        handler: vi.fn()
    })
}));

// The handler calls getDb().update(users).set({role}).where(eq(users.id, id)).
// Mock @repo/db to provide a chainable no-op query builder.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const chainMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        query: {}
    };

    return {
        ...actual,
        getDb: vi.fn(() => chainMock),
        initializeDb: vi.fn(),
        resetDb: vi.fn(),
        // createBillingAdapter is called by billingMiddleware at module load
        createBillingAdapter: vi.fn(() => ({})),
        eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
        // users table schema reference used by the route handler
        users: { id: 'id', role: 'role' }
    };
});

// Silence logger noise in tests (required because logger is imported at
// module scope by many src/ files including the auth middleware).
vi.mock('@repo/logger', () => {
    const noop = vi.fn();
    const logger = {
        info: noop,
        warn: noop,
        error: noop,
        debug: noop,
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: noop
    };
    const baseLogger = {
        ...logger,
        registerCategory: vi.fn(() => logger),
        configure: noop,
        resetConfig: noop,
        createLogger: vi.fn(() => logger)
    };
    return {
        default: baseLogger,
        logger: baseLogger,
        createLogger: vi.fn(() => logger),
        LoggerColors: {},
        LogLevel: {
            LOG: 'LOG',
            INFO: 'INFO',
            WARN: 'WARN',
            ERROR: 'ERROR',
            DEBUG: 'DEBUG'
        },
        AuditEventType: {
            AUTH_LOGIN_FAILED: 'auth.login.failed',
            AUTH_LOGIN_SUCCESS: 'auth.login.success',
            AUTH_LOCKOUT: 'auth.lockout',
            AUTH_PASSWORD_CHANGED: 'auth.password.changed',
            ACCESS_DENIED: 'access.denied',
            BILLING_MUTATION: 'billing.mutation',
            PERMISSION_CHANGE: 'permission.change',
            SESSION_SIGNOUT: 'session.signout',
            USER_ADMIN_MUTATION: 'user.admin.mutation',
            ROUTE_MUTATION: 'route.mutation'
        }
    };
});

// Stub out the billing middleware stack. These middlewares import from
// @repo/billing and @qazuor/qzpay-core which require real credentials and
// a DB to function. All three are pass-through stubs.
vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/middlewares/billing')>();
    return {
        ...original,
        billingMiddleware: vi.fn(
            async (
                c: { set: (key: string, value: unknown) => void },
                next: () => Promise<void>
            ) => {
                c.set('billingEnabled', false);
                await next();
            }
        ),
        requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }),
        getQZPayBilling: vi.fn(() => null),
        resetBillingInstance: vi.fn()
    };
});

vi.mock('../../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/trial', () => ({
    trialMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/sentry', () => ({
    sentryMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    sentryBillingMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mock declarations)
// ---------------------------------------------------------------------------

import { initApp } from '../../../src/app.js';
import { createAuthenticatedRequest, createMockActor } from '../../helpers/auth.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENDPOINT = '/api/v1/admin/auth/signup-as-host';

/**
 * Permissions that pass the base admin gate (ACCESS_API_ADMIN required by
 * adminAuthMiddleware) AND include USER_CREATE (the per-route gate).
 */
const ACTOR_WITH_USER_CREATE = createMockActor(RoleEnum.ADMIN, [
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.USER_CREATE
]);

/**
 * Actor that passes the base admin gate but lacks USER_CREATE.
 * This isolates the per-route USER_CREATE check as the 403 cause.
 * The actor has ACCESS_API_ADMIN (passes the outer admin gate) but NOT
 * USER_CREATE — so the per-route check is what produces the 403.
 */
const ACTOR_WITHOUT_USER_CREATE = createMockActor(RoleEnum.ADMIN, [
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.USER_READ_ALL
]);

const VALID_BODY = {
    email: 'newhost@example.com',
    password: 'securepassword',
    name: 'New Host'
};

const STUB_USER_ID = '11111111-1111-4111-8111-111111111111';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a Request with JSON body and optional mock-actor auth headers.
 */
function buildRequest(
    body: Record<string, unknown>,
    actor?: ReturnType<typeof createMockActor>
): Request {
    const authHeaders = actor ? createAuthenticatedRequest(actor).headers : {};

    return new Request(`http://localhost${ENDPOINT}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            // user-agent is required by the global validationMiddleware (default config).
            // Including it here ensures the request reaches the auth gate rather than
            // being rejected with 400 MISSING_REQUIRED_HEADER.
            'user-agent': 'vitest',
            ...authHeaders
        },
        body: JSON.stringify(body)
    });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SPEC-182 T-013 — POST /api/v1/admin/auth/signup-as-host permission matrix', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        // Reset all spy call histories between tests so assertions like
        // `expect(signUpEmailFn).not.toHaveBeenCalled()` check only the
        // current test's interactions, not cumulative calls.
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // (a) Authenticated WITH USER_CREATE → 201 + user.role === 'HOST'
    // =========================================================================

    describe('(a) actor WITH USER_CREATE', () => {
        it('returns 201 and a host user when all conditions pass', async () => {
            // Arrange
            signUpEmailFn.mockResolvedValueOnce({
                user: { id: STUB_USER_ID, email: VALID_BODY.email }
            });

            // Act
            const response = await app.request(buildRequest(VALID_BODY, ACTOR_WITH_USER_CREATE));

            // Assert — POST factory method returns 201 Created
            expect(response.status).toBe(201);
            const body = (await response.json()) as {
                success: boolean;
                data: { user: { id: string; email: string; role: string } };
            };
            expect(body.success).toBe(true);
            expect(body.data.user.role).toBe(RoleEnum.HOST);
            expect(body.data.user.id).toBe(STUB_USER_ID);
            expect(body.data.user.email).toBe(VALID_BODY.email);
        });

        it('marks the new host email as verified (regression: prod verification gate)', async () => {
            // Regression for the SPEC-182 review MAJOR: Better Auth has
            // `requireEmailVerification: true`, so without `emailVerified: true`
            // in the post-signup UPDATE a staff-provisioned host could not sign
            // in with the temporary password in production (where a real email
            // key disables the non-prod auto-verify branch). The staff member
            // vouches for the email, so the account must be created verified.

            // Arrange
            signUpEmailFn.mockResolvedValueOnce({
                user: { id: STUB_USER_ID, email: VALID_BODY.email }
            });

            // Act
            const response = await app.request(buildRequest(VALID_BODY, ACTOR_WITH_USER_CREATE));

            // Assert — the role UPDATE must also flip emailVerified to true.
            expect(response.status).toBe(201);
            const { getDb } = await import('@repo/db');
            const db = getDb() as unknown as { set: ReturnType<typeof vi.fn> };
            expect(db.set).toHaveBeenCalledWith({
                role: RoleEnum.HOST,
                emailVerified: true
            });
        });
    });

    // =========================================================================
    // (b) Unauthenticated → 401
    // =========================================================================

    describe('(b) unauthenticated actor', () => {
        it('returns 401 when no mock-actor headers are present', async () => {
            // Arrange — request without mock-actor headers (no x-mock-actor-*).
            // The global validationMiddleware requires a `user-agent` header for all
            // requests (default config). We include it here so the request passes
            // header validation and reaches the admin auth gate, which then rejects
            // the GUEST actor with 401. Without user-agent the response would be 400
            // (MISSING_REQUIRED_HEADER) before the auth check runs.
            const unauthRequest = new Request(`http://localhost${ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json',
                    'user-agent': 'vitest'
                },
                body: JSON.stringify(VALID_BODY)
            });

            // Act
            const response = await app.request(unauthRequest);

            // Assert
            expect(response.status).toBe(401);

            const body = (await response.json()) as Record<string, unknown>;
            expect(body.success).not.toBe(true);
        });
    });

    // =========================================================================
    // (c) Authenticated WITHOUT USER_CREATE → 403
    // =========================================================================

    describe('(c) actor WITHOUT USER_CREATE', () => {
        it('returns 403 when actor passes base admin gate but lacks USER_CREATE', async () => {
            // Arrange — actor has ACCESS_API_ADMIN (passes outer gate) but NOT USER_CREATE
            // Act
            const response = await app.request(buildRequest(VALID_BODY, ACTOR_WITHOUT_USER_CREATE));

            // Assert
            expect(response.status).toBe(403);

            const body = (await response.json()) as Record<string, unknown>;
            expect(body.success).not.toBe(true);
            // The auth gate fires before the handler — signUpEmail is never called
            expect(signUpEmailFn).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // (d) Authenticated WITH USER_CREATE but invalid body → 400 (Zod)
    // =========================================================================

    describe('(d) invalid request body', () => {
        it('returns 400 when email is missing', async () => {
            const response = await app.request(
                buildRequest(
                    { password: 'securepassword', name: 'Host Name' },
                    ACTOR_WITH_USER_CREATE
                )
            );

            expect(response.status).toBe(400);
            // Handler never runs — signUpEmail not called
            expect(signUpEmailFn).not.toHaveBeenCalled();
        });

        it('returns 400 when password is too short (< 8 chars)', async () => {
            const response = await app.request(
                buildRequest(
                    { email: 'host@example.com', password: 'short', name: 'Host Name' },
                    ACTOR_WITH_USER_CREATE
                )
            );

            expect(response.status).toBe(400);
            expect(signUpEmailFn).not.toHaveBeenCalled();
        });

        it('returns 400 when name is empty string', async () => {
            const response = await app.request(
                buildRequest(
                    { email: 'host@example.com', password: 'securepassword', name: '' },
                    ACTOR_WITH_USER_CREATE
                )
            );

            expect(response.status).toBe(400);
            expect(signUpEmailFn).not.toHaveBeenCalled();
        });

        it('returns 400 when email format is invalid', async () => {
            const response = await app.request(
                buildRequest(
                    { email: 'not-an-email', password: 'securepassword', name: 'Host Name' },
                    ACTOR_WITH_USER_CREATE
                )
            );

            expect(response.status).toBe(400);
            expect(signUpEmailFn).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // (e) Duplicate email → >= 400, not 200/201
    // =========================================================================

    describe('(e) duplicate email', () => {
        it('returns >= 400 when Better Auth signUpEmail returns null (no user created)', async () => {
            // Arrange — signUpEmail returns null (simulates BA rejecting the signup,
            // e.g. duplicate email or validation failure on the BA side).
            signUpEmailFn.mockResolvedValueOnce(null);

            // Act
            const response = await app.request(buildRequest(VALID_BODY, ACTOR_WITH_USER_CREATE));

            // Assert — handler detects signUpResult?.user?.id is falsy and returns 500.
            // The key contract: NOT 200/201 (not a success).
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.status).not.toBe(200);
            expect(response.status).not.toBe(201);

            const body = (await response.json()) as {
                success?: boolean;
                error?: { code: string };
            };
            expect(body.success).toBe(false);
        });

        it('returns >= 400 when Better Auth throws for duplicate email', async () => {
            // Arrange — signUpEmail throws (simulates a unique-constraint violation
            // or other BA-level error when the same email is registered twice).
            signUpEmailFn.mockRejectedValueOnce(new Error('Email already in use'));

            // Act
            const response = await app.request(buildRequest(VALID_BODY, ACTOR_WITH_USER_CREATE));

            // Assert — unhandled BA throw propagates through the route handler's
            // try/catch and returns >= 400. The exact code depends on how the
            // error handler maps the exception — we only assert the auth outcome.
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.status).not.toBe(200);
            expect(response.status).not.toBe(201);
        });
    });
});
