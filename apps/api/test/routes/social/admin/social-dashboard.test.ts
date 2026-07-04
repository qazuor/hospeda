/**
 * Integration tests for GET /api/v1/admin/social/dashboard — HOS-66 T-007 (G-7).
 *
 * Verifies the route forwards the (already Zod-validated) dateFrom/dateTo
 * query params to SocialPostService.getDashboard, and that the response
 * passes platformBreakdown through unchanged.
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler and invoke it
 * directly — same as social-post-transitions.test.ts.
 *
 * @module test/routes/social/admin/social-dashboard
 * @see HOS-66
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >()
}));

const { mockGetDashboard } = vi.hoisted(() => ({
    mockGetDashboard: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            method: string;
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            capturedHandlers.set(`${config.method}:${config.path}`, config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'admin-actor-id', role: 'ADMIN', permissions: [] }))
}));

vi.mock('@repo/service-core', () => ({
    SocialPostService: vi.fn(() => ({
        getDashboard: mockGetDashboard
    }))
}));

const { mockGetDecryptedSocialCredential } = vi.hoisted(() => ({
    mockGetDecryptedSocialCredential: vi.fn()
}));

vi.mock('../../../../src/services/social-credential-vault.service.js', () => ({
    getDecryptedSocialCredential: mockGetDecryptedSocialCredential
}));

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

type CapturedHandler = (
    ctx: unknown,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>
) => Promise<unknown>;

let dashboardHandler: CapturedHandler | undefined;

function buildDashboardResult(overrides: Record<string, unknown> = {}) {
    return {
        data: {
            kpis: {
                totalPosts: 10,
                pendingReview: 2,
                scheduled: 1,
                publishedLast30Days: 3,
                failedActionNeeded: 0
            },
            quickApprovalQueue: [],
            recentFailures: [],
            makeWebhookConfigured: true,
            platformBreakdown: [
                { platform: 'INSTAGRAM', count: 5 },
                { platform: 'FACEBOOK', count: 3 },
                { platform: 'X', count: 2 }
            ],
            ...overrides
        }
    };
}

beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers.clear();
    mockGetDecryptedSocialCredential.mockResolvedValue({
        data: { key: 'make_webhook_url', plaintext: 'https://hook.example.com' }
    });
    mockGetDashboard.mockResolvedValue(buildDashboardResult());

    await import('../../../../src/routes/social/admin/dashboard/get');
    dashboardHandler = capturedHandlers.get('get:/') as CapturedHandler;
});

afterEach(() => {
    vi.resetModules();
    capturedHandlers.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/social/dashboard', () => {
    it('calls getDashboard with dateFrom/dateTo undefined when no query params given (regression)', async () => {
        await dashboardHandler!({}, {}, {}, {});

        const input = mockGetDashboard.mock.calls[0]?.[0];
        expect(input.dateFrom).toBeUndefined();
        expect(input.dateTo).toBeUndefined();
    });

    it('forwards validated dateFrom/dateTo query params to getDashboard', async () => {
        const dateFrom = new Date('2026-06-01T00:00:00Z');
        const dateTo = new Date('2026-06-30T23:59:59Z');

        await dashboardHandler!({}, {}, {}, { dateFrom, dateTo });

        const input = mockGetDashboard.mock.calls[0]?.[0];
        expect(input.dateFrom).toBe(dateFrom);
        expect(input.dateTo).toBe(dateTo);
    });

    it('returns platformBreakdown from the service result unchanged', async () => {
        const result = (await dashboardHandler!({}, {}, {}, {})) as {
            platformBreakdown: Array<{ platform: string; count: number }>;
        };

        expect(result.platformBreakdown).toEqual([
            { platform: 'INSTAGRAM', count: 5 },
            { platform: 'FACEBOOK', count: 3 },
            { platform: 'X', count: 2 }
        ]);
    });
});
