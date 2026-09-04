/**
 * The active-promotions cap REFUSES when it cannot count, asserted END-TO-END
 * (HOS-1087).
 *
 * ---
 * WHY THIS FILE IS A REQUEST TEST AND NOT A UNIT TEST
 *
 * HOS-973 R-2 (already proven by `accommodation-limit-fail-closed.e2e.test.ts`):
 * every key and every cap is asserted end to end against the real route,
 * NEVER by calling `checkLimit` with a hand-built context. A fabricated
 * context always answers green, which is exactly how `enforcePromotionLimit`
 * kept `await next()` on both its count-failure branches (the `Result`-shaped
 * failure at ~392-399 and the thrown-error catch at ~441-452) while the suite
 * stayed green — nothing exercised either path against `POST
 * /api/v1/protected/owner-promotions`.
 *
 * ## What is stubbed, and what stays real
 *
 * `OwnerPromotionService` is replaced wholesale (its `count` and `create`
 * methods) so the test controls the count outcome and can observe whether
 * `create` was ever reached. The entitlement GATE (`requireEntitlement`) is
 * bypassed and `getRemainingLimit` is stubbed directly — the same pattern
 * `toggleAtCap.test.ts` uses for favorites — so this file is not coupled to
 * the full billing/plan resolution chain; it isolates `enforcePromotionLimit`
 * and `checkLimit` exactly.
 *
 * ## The decisive assertion is the create call, not the status
 *
 * A status-only assertion would be ambiguous: a 403 could come from the
 * limit OR (before this fix) coincidentally from something else. Each
 * refusal case therefore asserts `create` was never called — the actual
 * product statement: a promotion is not handed out when the cap could not
 * be evaluated.
 *
 * @module test/routes/owner-promotion/protected/limit-fail-closed.e2e
 */

import { LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockCount, mockCreate } = vi.hoisted(() => ({
    mockCount: vi.fn(),
    mockCreate: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        OwnerPromotionService: vi.fn().mockImplementation(function () {
            return {
                count: mockCount,
                create: mockCreate
            };
        })
    };
});

/**
 * Bypass the entitlement GATE (`requireEntitlement(CREATE_PROMOTIONS)`) and
 * control `getRemainingLimit` (what `checkLimit` reads for MAX_ACTIVE_PROMOTIONS)
 * directly, instead of wiring the full billing/plan resolution chain — same
 * approach `toggleAtCap.test.ts` uses for `MAX_FAVORITES`.
 */
let maxActivePromotions = 2;
vi.mock('../../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        requireEntitlement: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        },
        getRemainingLimit: (_c: unknown, limitKey: string) => {
            if (limitKey === LimitKey.MAX_ACTIVE_PROMOTIONS) {
                return maxActivePromotions;
            }
            return -1;
        }
    };
});

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/protected/owner-promotions';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

const hostHeaders = {
    'user-agent': 'vitest',
    'content-type': 'application/json',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': RoleEnum.HOST,
    // `OWNER_PROMOTION_VIEW_OWN` is required too: the route factory attaches
    // route middlewares with `app.use(path, ...)`, method-agnostic, so
    // `list.ts` (GET, same base path `/`) and `create.ts` (POST, same path)
    // both run their permission gate on every request that matches the path
    // — not just their own method. Without it this actor 403s on
    // `list.ts`'s gate before ever reaching `enforcePromotionLimit`
    // (confirmed by capturing the real `auditLog` call during triage).
    'x-mock-actor-permissions': JSON.stringify([
        PermissionEnum.OWNER_PROMOTION_CREATE,
        PermissionEnum.OWNER_PROMOTION_VIEW_OWN
    ])
};

const validBody = JSON.stringify({
    title: 'Test Promotion',
    // Lowercase — `OwnerPromotionDiscountTypeEnum` is `percentage | fixed |
    // free_night`, not the uppercase form `create.test.ts` uses (that file's
    // assertions are loose enough — `[201, 401, 403]` — to never notice its
    // own body fails validation).
    discountType: 'percentage',
    discountValue: 10,
    validFrom: '2025-01-01T00:00:00.000Z'
});

describe('promotion cap fails CLOSED on a count failure (HOS-1087)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        maxActivePromotions = 2;
        // Full shape matching `OwnerPromotionProtectedSchema` — the response
        // validator middleware 500s on a partial object, which would make the
        // "still creates" assertions unreadable (500 instead of 201).
        mockCreate.mockResolvedValue({
            data: {
                id: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
                slug: 'test-promo',
                ownerId: ACTOR_ID,
                accommodationId: null,
                title: 'Test Promotion',
                description: null,
                discountType: 'percentage',
                discountValue: 10,
                minNights: null,
                validFrom: new Date('2025-01-01').toISOString(),
                validUntil: null,
                maxRedemptions: null,
                currentRedemptions: 0,
                planRestricted: false,
                lifecycleState: 'DRAFT',
                createdAt: new Date('2025-01-01').toISOString(),
                updatedAt: new Date('2025-01-01').toISOString()
            },
            error: undefined
        });
    });

    it('answers 403 LIMIT_REACHED and creates nothing when the count fails (Result error)', async () => {
        const app: AppOpenAPI = initApp();
        // The `Result`-shaped failure — `enforcePromotionLimit` used to log
        // this one and call `next()` anyway (the ~392-399 branch).
        mockCount.mockResolvedValue({
            data: undefined,
            error: { code: 'INTERNAL_ERROR', message: 'connection terminated unexpectedly' }
        });

        const res = await app.request(BASE, {
            method: 'POST',
            headers: hostHeaders,
            body: validBody
        });

        // Asserted first: the product statement is "no promotion came out of
        // an unevaluated cap", not the status alone.
        expect(mockCreate).not.toHaveBeenCalled();
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('LIMIT_REACHED');
    });

    it('answers 403 LIMIT_REACHED and creates nothing when the count THROWS', async () => {
        const app: AppOpenAPI = initApp();
        // The unexpected-error branch — the ~441-452 catch, which used to
        // log and `next()` too.
        mockCount.mockRejectedValue(new Error('connection terminated unexpectedly'));

        const res = await app.request(BASE, {
            method: 'POST',
            headers: hostHeaders,
            body: validBody
        });

        expect(mockCreate).not.toHaveBeenCalled();
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('LIMIT_REACHED');
    });

    it('still lets an under-cap create through (non-vacuity)', async () => {
        const app: AppOpenAPI = initApp();
        mockCount.mockResolvedValue({ data: { count: 0 }, error: undefined });

        const res = await app.request(BASE, {
            method: 'POST',
            headers: hostHeaders,
            body: validBody
        });

        expect(res.status).toBe(201);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('still answers 403 LIMIT_REACHED when the REAL cap is reached, not just on failure', async () => {
        const app: AppOpenAPI = initApp();
        mockCount.mockResolvedValue({ data: { count: 2 }, error: undefined });

        const res = await app.request(BASE, {
            method: 'POST',
            headers: hostHeaders,
            body: validBody
        });

        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('LIMIT_REACHED');
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('an UNLIMITED plan (maxAllowed = -1) still creates when the count fails — the -1 short-circuit must run BEFORE the fail-closed sentinel is compared', async () => {
        const app: AppOpenAPI = initApp();
        maxActivePromotions = -1; // owner-premium: unlimited active promotions
        mockCount.mockResolvedValue({
            data: undefined,
            error: { code: 'INTERNAL_ERROR', message: 'connection terminated unexpectedly' }
        });

        const res = await app.request(BASE, {
            method: 'POST',
            headers: hostHeaders,
            body: validBody
        });

        // This is the regression the fix must not introduce: a fail-closed
        // sentinel count that is compared BEFORE checkLimit's -1 branch would
        // block every host on an unlimited plan the instant a count hiccups.
        expect(res.status).toBe(201);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });
});
