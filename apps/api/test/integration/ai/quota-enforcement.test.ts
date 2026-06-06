/**
 * Integration tests for AI quota enforcement middleware (SPEC-173 T-037, AC-5 + AC-6).
 *
 * There are NO user-facing AI routes yet (children specs add them), so this file
 * builds a minimal Hono test app that wires the REAL middleware stack:
 *
 *   actorMiddleware()  → sets c.get('actor')
 *   [billing stub]     → sets userEntitlements / userLimits / billingLoadFailed
 *   createAiQuotaMiddleware('chat')
 *   dummy 200 handler
 *
 * Billing path: since seeding billing_plans + billing_customers +
 * billing_subscriptions would require wiring QZPay and the full
 * entitlementMiddleware resolution chain, this test instead directly injects
 * `userEntitlements`, `userLimits`, and `billingLoadFailed` via a stub
 * middleware — exactly the values that `entitlementMiddleware()` would produce
 * for a tourist-free user. This is the documented test-friendly seam: the
 * quota middleware contract is against `c.get(...)` context variables, not
 * against the billing tables directly.
 *
 * Decision: billing tables NOT seeded — the quota middleware does NOT read
 * billing tables itself; it reads context vars set by entitlementMiddleware.
 * Seeding billing to drive entitlementMiddleware would test a different layer
 * (the billing integration), not the quota enforcement contract. The stub
 * approach is documented here so reviewers can understand the boundary.
 *
 * Assertions:
 *   AC-5: no auth headers → 401, handler never reached.
 *   AC-6a: user at quota limit (count >= limit) → 403 LIMIT_REACHED +
 *          quota_exceeded metering row inserted in ai_usage.
 *   AC-6b: user under limit → 200 + handler reached.
 *
 * Auth: mock-actor header injection (NODE_ENV=test + HOSPEDA_ALLOW_MOCK_ACTOR=true).
 * DB:   testDb.setup() / testDb.clean() / testDb.teardown() for full isolation.
 *
 * @module test/integration/ai/quota-enforcement
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { aiUsage, getDb } from '@repo/db';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createAiQuotaMiddleware } from '../../../src/middlewares/ai-quota';
import { createErrorHandler } from '../../../src/middlewares/response';
import type { AppBindings } from '../../../src/types';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_FEATURE = 'chat' as const;
/** The plan quota limit we'll configure for the test user. */
const PLAN_LIMIT = 3;

const DUMMY_HANDLER_REACHED_HEADER = 'x-dummy-handler-reached';
const TEST_PATH = '/test-ai-quota';

// ---------------------------------------------------------------------------
// Build a minimal test Hono app
//
// Wires: actorMiddleware → billing-stub-middleware → createAiQuotaMiddleware
// The billing-stub middleware directly sets context variables without hitting
// the real billing stack (see module JSDoc for rationale).
// ---------------------------------------------------------------------------

function buildTestApp(
    _actorId: string,
    overrideEntitlements?: Set<EntitlementKey>,
    overrideLimits?: Map<LimitKey, number>
): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });

    // Attach the real error handler so ServiceError is mapped to the correct
    // HTTP status code (401/403/etc.) rather than falling through to Hono's
    // default 500.
    app.onError(createErrorHandler());

    // actorMiddleware reads mock-actor headers and sets c.get('actor').
    app.use(actorMiddleware());

    // Billing stub: inject entitlements + limits directly.
    // This is what entitlementMiddleware() would produce for a tourist-free
    // plan user that has AI_CHAT entitlement with a finite monthly limit.
    app.use(async (c, next) => {
        const actor = c.get('actor') as Actor | undefined;
        if (!actor) {
            await next();
            return;
        }

        const entitlements =
            overrideEntitlements ??
            new Set<EntitlementKey>([EntitlementKey.AI_CHAT, EntitlementKey.AI_TEXT_IMPROVE]);

        const limits =
            overrideLimits ??
            new Map<LimitKey, number>([
                [LimitKey.MAX_AI_CHAT_PER_MONTH, PLAN_LIMIT],
                [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH, PLAN_LIMIT]
            ]);

        c.set('userEntitlements', entitlements);
        c.set('userLimits', limits);
        c.set('billingLoadFailed', false);
        await next();
    });

    // AI quota middleware under test.
    app.use(createAiQuotaMiddleware(TEST_FEATURE));

    // Dummy handler — must only be reached when quota allows the call.
    app.get(TEST_PATH, (c) =>
        c.json({ reached: true }, 200, {
            [DUMMY_HANDLER_REACHED_HEADER]: 'true'
        })
    );

    return app;
}

function makeHeaders(
    actor: { id: string; role: string; permissions: readonly string[] },
    extra: Record<string, string> = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...extra
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AI quota enforcement middleware (SPEC-173 T-037 AC-5 + AC-6)', () => {
    let userId: string;
    let quotaApp: OpenAPIHono<AppBindings>;

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();

        // Stable userId used across all test cases in this suite.
        userId = crypto.randomUUID();

        // Default app: user has AI_CHAT entitlement + limit = PLAN_LIMIT
        quotaApp = buildTestApp(userId);
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // AC-5: no auth → 401, handler not reached
    // -------------------------------------------------------------------------

    describe('AC-5 — anonymous request', () => {
        it('returns 401 when no mock-actor headers are provided', async () => {
            const res = await quotaApp.request(TEST_PATH, {
                headers: { 'user-agent': 'vitest' }
            });

            expect(res.status).toBe(401);

            // Handler MUST NOT have been reached
            expect(res.headers.get(DUMMY_HANDLER_REACHED_HEADER)).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // AC-6: user at quota limit → 403 LIMIT_REACHED + metering row
    // -------------------------------------------------------------------------

    describe('AC-6 — at-limit user', () => {
        it('returns 403 with LIMIT_REACHED code and inserts a quota_exceeded metering row', async () => {
            const db = getDb();
            const now = new Date();

            // Seed exactly PLAN_LIMIT successful usage rows so the user is AT the limit.
            // status 'success' is the only quota-consuming status per the monthly-call-count
            // decision (success + fallback count; error/quota_exceeded/ceiling_hit do not).
            const usageRows = Array.from({ length: PLAN_LIMIT }, () => ({
                userId,
                feature: TEST_FEATURE,
                provider: 'stub',
                model: 'stub-model',
                tokensIn: 10,
                tokensOut: 10,
                costEstimateMicroUsd: 0,
                latencyMs: 50,
                status: 'success',
                createdAt: now
            }));

            await db.insert(aiUsage).values(usageRows);

            // Actor matching the userId seeded above
            const actor = {
                id: userId,
                role: RoleEnum.USER,
                permissions: [] as PermissionEnum[]
            };

            const res = await quotaApp.request(TEST_PATH, {
                headers: makeHeaders(actor)
            });

            // Quota exceeded → 403
            expect(res.status).toBe(403);

            const body = await res.json();
            expect(body.success).toBe(false);
            // ServiceError maps LIMIT_REACHED → code in error body
            expect(JSON.stringify(body)).toContain('LIMIT_REACHED');

            // Handler must NOT have been reached
            expect(res.headers.get(DUMMY_HANDLER_REACHED_HEADER)).toBeNull();

            // AC-6 metering: a quota_exceeded row with provider 'none' must exist
            const meteredRows = await db
                .select()
                .from(aiUsage)
                .where(
                    and(
                        eq(aiUsage.userId, userId),
                        eq(aiUsage.feature, TEST_FEATURE),
                        eq(aiUsage.status, 'quota_exceeded')
                    )
                );

            expect(meteredRows.length).toBeGreaterThanOrEqual(1);
            const meteredRow = meteredRows[0];
            if (!meteredRow) throw new Error('Expected a quota_exceeded metering row');

            expect(meteredRow.provider).toBe('none');
            expect(meteredRow.model).toBe('none');
            expect(meteredRow.status).toBe('quota_exceeded');
        });
    });

    // -------------------------------------------------------------------------
    // AC-6b: user under limit → 200, handler reached
    // -------------------------------------------------------------------------

    describe('AC-6b — under-limit user', () => {
        it('returns 200 and reaches the handler when user is under quota', async () => {
            const db = getDb();
            const now = new Date();

            // Seed PLAN_LIMIT - 1 successful rows → user has one call remaining
            const usageRows = Array.from({ length: PLAN_LIMIT - 1 }, () => ({
                userId,
                feature: TEST_FEATURE,
                provider: 'stub',
                model: 'stub-model',
                tokensIn: 10,
                tokensOut: 10,
                costEstimateMicroUsd: 0,
                latencyMs: 50,
                status: 'success',
                createdAt: now
            }));

            if (usageRows.length > 0) {
                await db.insert(aiUsage).values(usageRows);
            }

            const actor = {
                id: userId,
                role: RoleEnum.USER,
                permissions: [] as PermissionEnum[]
            };

            const res = await quotaApp.request(TEST_PATH, {
                headers: makeHeaders(actor)
            });

            expect(res.status).toBe(200);
            expect(res.headers.get(DUMMY_HANDLER_REACHED_HEADER)).toBe('true');
        });

        it('returns 200 for a fresh user with no usage rows (count = 0 < limit)', async () => {
            const freshUserId = crypto.randomUUID();
            const freshApp = buildTestApp(freshUserId);

            const actor = {
                id: freshUserId,
                role: RoleEnum.USER,
                permissions: [] as PermissionEnum[]
            };

            const res = await freshApp.request(TEST_PATH, {
                headers: makeHeaders(actor)
            });

            expect(res.status).toBe(200);
        });
    });

    // -------------------------------------------------------------------------
    // Entitlement gate: user without AI_CHAT entitlement → 403
    // -------------------------------------------------------------------------

    describe('entitlement gate', () => {
        it('returns 403 when user lacks AI_CHAT entitlement (no entitlements at all)', async () => {
            // Build an app where the user has NO AI entitlements
            const noEntitlementApp = buildTestApp(
                userId,
                new Set<EntitlementKey>(), // empty set — no AI_CHAT
                new Map<LimitKey, number>([[LimitKey.MAX_AI_CHAT_PER_MONTH, PLAN_LIMIT]])
            );

            const actor = {
                id: userId,
                role: RoleEnum.USER,
                permissions: [] as PermissionEnum[]
            };

            const res = await noEntitlementApp.request(TEST_PATH, {
                headers: makeHeaders(actor)
            });

            expect(res.status).toBe(403);
            expect(res.headers.get(DUMMY_HANDLER_REACHED_HEADER)).toBeNull();
        });
    });
});
