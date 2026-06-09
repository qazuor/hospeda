/**
 * Integration tests for the guest conversation thread IDOR security invariant.
 *
 * Covers the write-IDOR fix introduced in apps/api/src/routes/conversations/
 * protected/thread.ts: the pre-check that validates ownership BEFORE invoking
 * ConversationService.getThread (which runs side effects: read-receipt update +
 * notification cancellation).
 *
 * Invariant under test: when a guest requests a conversation that does NOT
 * belong to them, ConversationService.getThread MUST NEVER be called.
 *
 * @module test/integration/conversation-guest-idor
 */

// ---------------------------------------------------------------------------
// Environment setup (BEFORE any module loads)
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

process.env.NODE_ENV = 'test';
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.PORT = '3001';
process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
process.env.API_VALIDATION_AUTH_ENABLED = 'false';
process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';
process.env.HOSPEDA_SITE_URL = 'http://localhost:4321';

// ---------------------------------------------------------------------------
// Module mocks (hoisted before all imports)
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@repo/logger', async (importOriginal) => {
    // Bring in real constant values (AuditEventType, LogLevel, LoggerColors, etc.)
    // so consumers that import them from @repo/logger still get usable values.
    const actual = await importOriginal<Record<string, unknown>>();

    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    return {
        ...actual,
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger
    };
});

// ---------------------------------------------------------------------------
// Hoisted stubs: shared across all ConversationModel/AccommodationModel/
// UserModel instances so the route's top-level `new XxxModel()` calls
// and the per-test assertions share the same vi.fn() references.
// ---------------------------------------------------------------------------

const { mockConversationFindById, mockAccommodationFindById, mockUserFindById, mockGetThreadFn } =
    vi.hoisted(() => {
        return {
            mockConversationFindById: vi.fn(),
            mockAccommodationFindById: vi.fn(),
            mockUserFindById: vi.fn(),
            mockGetThreadFn: vi.fn()
        };
    });

// Mock @repo/db: replace ConversationModel, AccommodationModel, UserModel with
// lightweight stubs that share the hoisted vi.fn() references. Also stub
// initializeDb / getDb / resetDb so initApp() can boot without a real DB pool.
vi.mock('@repo/db', async (importOriginal) => {
    // Pull in the real drizzle-orm helpers (sql, eq, etc.) so other
    // middleware or utils that import them from @repo/db still work.
    const actual = await importOriginal<Record<string, unknown>>();

    class ConversationModel {
        findById: Mock = mockConversationFindById;
    }

    class AccommodationModel {
        findById: Mock = mockAccommodationFindById;
    }

    class UserModel {
        findById: Mock = mockUserFindById;
    }

    return {
        ...actual,
        ConversationModel,
        AccommodationModel,
        UserModel,
        // Stub db lifecycle — the route handler itself does not call these;
        // they are called by other bootstrapping code. A no-op is enough.
        initializeDb: vi.fn(),
        getDb: vi.fn(() => ({})),
        resetDb: vi.fn()
    };
});

// Auto-mock @repo/service-core so ConversationService is a mock class.
// Vitest replaces every exported class with a mock class whose constructor
// and instance methods are vi.fn(). We override getThread per-test via the
// hoisted mockGetThreadFn.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    class ConversationService {
        getThread: Mock = mockGetThreadFn;
    }

    return {
        ...actual,
        ConversationService
    };
});

// Stub notifications so it does not try to connect to anything.
vi.mock('@repo/notifications', async (importOriginal) => {
    try {
        const actual = await importOriginal<Record<string, unknown>>();
        return { ...actual };
    } catch {
        return { NotificationType: {}, NotificationService: vi.fn() };
    }
});

// Stub billing middlewares (required by createApp's middleware chain).
vi.mock('../../src/middlewares/billing', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../src/middlewares/billing')>();
    return {
        ...original,
        getQZPayBilling: vi.fn(),
        requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }),
        billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
            await next();
        })
    };
});

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        entitlementMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../src/middlewares/past-due-grace.middleware', () => ({
    pastDueGraceMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../src/middlewares/sentry', () => ({
    sentryMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    },
    sentryBillingMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../src/services/billing-metrics.service', () => ({
    getBillingMetricsService: vi.fn(() => ({
        getOverviewMetrics: vi.fn().mockResolvedValue({ success: true, data: {} }),
        getRevenueTimeSeries: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getSubscriptionBreakdown: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getRecentActivity: vi.fn().mockResolvedValue({ success: true, data: [] })
    }))
}));

vi.mock('../../src/services/billing-usage.service', () => ({
    getSystemUsage: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getApproachingLimits: vi.fn().mockResolvedValue({ success: true, data: [] })
}));

vi.mock('@qazuor/qzpay-hono', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAPIHono } = require('@hono/zod-openapi');
    return {
        createBillingRoutes: vi.fn(() => {
            return new OpenAPIHono({ strict: false });
        })
    };
});

// ---------------------------------------------------------------------------
// Imports (after all mocks are registered)
// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';
import { createAuthenticatedRequest, createMockUserActor } from '../helpers/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUEST_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUEST_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONVERSATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACCOMMODATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds authenticated request headers for a guest user. */
function buildGuestHeaders(actorId: string): Record<string, string> {
    const actor = createMockUserActor({
        id: actorId,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.CONVERSATION_VIEW_OWN, PermissionEnum.CONVERSATION_REPLY_OWN]
    });
    const req = createAuthenticatedRequest(actor, {
        authorization: 'Bearer test-valid-token'
    });
    return req.headers;
}

/** Minimal conversation row belonging to the given userId. */
function makeConversation(userId: string) {
    return {
        id: CONVERSATION_ID,
        userId,
        accommodationId: ACCOMMODATION_ID,
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Guest conversation thread IDOR security invariant', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
    });

    afterAll(() => {
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                delete process.env[key];
            }
        }
        Object.assign(process.env, originalEnv);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // TC-001: IDOR regression — foreign conversation must return 404 and
    // MUST NOT invoke getThread (no side effects on a different user's data).
    // -----------------------------------------------------------------------

    it('rejects a foreign conversation with 404 WITHOUT invoking getThread', async () => {
        // Arrange: conversation belongs to GUEST_B; requester is GUEST_A.
        (mockConversationFindById as Mock).mockResolvedValue(makeConversation(GUEST_B_ID));

        const headers = buildGuestHeaders(GUEST_A_ID);

        // Act
        const res = await app.request(`/api/v1/protected/conversations/${CONVERSATION_ID}`, {
            method: 'GET',
            headers
        });

        // Assert: 404 (anti-enumeration) and zero side effects.
        expect(res.status).toBe(404);

        // THE CORE invariant: getThread must never run for a foreign conversation.
        expect(mockGetThreadFn).not.toHaveBeenCalled();

        const body = (await res.json()) as {
            success: boolean;
            error?: { reason?: string };
        };
        expect(body.success).toBe(false);
        expect(body.error?.reason).toBe('CONVERSATION_NOT_FOUND');
    });

    // -----------------------------------------------------------------------
    // TC-002: Happy path — owner gets 200 and getThread IS invoked once.
    // -----------------------------------------------------------------------

    it("returns 200 and invokes getThread for the owner's own conversation", async () => {
        // Arrange: conversation belongs to GUEST_A; requester is GUEST_A.
        (mockConversationFindById as Mock).mockResolvedValue(makeConversation(GUEST_A_ID));

        // Stub accommodation + user lookups (enrichment step).
        (mockAccommodationFindById as Mock).mockResolvedValue({
            id: ACCOMMODATION_ID,
            name: 'Cabaña Test',
            slug: 'cabana-test',
            ownerId: GUEST_B_ID
        });
        (mockUserFindById as Mock).mockResolvedValue({
            id: GUEST_B_ID,
            displayName: 'Owner Name'
        });

        // Stub getThread to return a minimal valid thread result.
        (mockGetThreadFn as Mock).mockResolvedValue({
            data: {
                conversation: makeConversation(GUEST_A_ID),
                messages: [],
                hasMore: false
            }
        });

        const headers = buildGuestHeaders(GUEST_A_ID);

        // Act
        const res = await app.request(`/api/v1/protected/conversations/${CONVERSATION_ID}`, {
            method: 'GET',
            headers
        });

        // Assert
        expect(res.status).toBe(200);
        expect(mockGetThreadFn).toHaveBeenCalledOnce();
    });

    // -----------------------------------------------------------------------
    // TC-003: Non-existent conversation returns 404 without calling getThread.
    // -----------------------------------------------------------------------

    it('rejects a non-existent conversation with 404 without invoking getThread', async () => {
        // Arrange: findById returns null (conversation does not exist).
        (mockConversationFindById as Mock).mockResolvedValue(null);

        const headers = buildGuestHeaders(GUEST_A_ID);

        // Act
        const res = await app.request(`/api/v1/protected/conversations/${CONVERSATION_ID}`, {
            method: 'GET',
            headers
        });

        // Assert
        expect(res.status).toBe(404);
        expect(mockGetThreadFn).not.toHaveBeenCalled();

        const body = (await res.json()) as {
            success: boolean;
            error?: { reason?: string };
        };
        expect(body.success).toBe(false);
        expect(body.error?.reason).toBe('CONVERSATION_NOT_FOUND');
    });
});
