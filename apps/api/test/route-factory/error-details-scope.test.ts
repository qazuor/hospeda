/**
 * HOS-700 — `handleRouteError` emits `error.details` for `LIMIT_REACHED` and
 * `ENTITLEMENT_REQUIRED` even with `HOSPEDA_API_DEBUG_ERRORS` off, because for
 * those two codes `details` is part of the PUBLIC error contract, not a
 * debug-only field.
 *
 * Before this fix, `handleRouteError` (apps/api/src/utils/response-helpers.ts)
 * stripped `details` for every code unless debug mode was on. On the web side,
 * `apps/web/src/lib/billing-limit-error.ts` reads `details.limitKey` to pick
 * the limit-specific copy — with `details` always `undefined` in production,
 * `limitKey` fell back to `'generic'` and EVERY limit (accommodations,
 * gastronomy listings, ...) rendered the same generic toast instead of the
 * one that names the limit and links its unlocking addon.
 *
 * ## Why this test does NOT use a hand-rolled `app.onError`
 *
 * The pre-existing limit/entitlement gate tests (e.g.
 * `test/routes/accommodation/protected/accommodation-entitlement-gates.test.ts`)
 * mount their own `app.onError` that mirrors `handleRouteError`'s shape by
 * hand. That handler forwards `error.details` unconditionally, so it stayed
 * green through this entire bug — it was never exercising the real debug
 * gate. That is the exact trap HOS-700 documents.
 *
 * This file instead builds its app with `createSimpleRoute` — the REAL route
 * factory (`apps/api/src/utils/route-factory.ts`) every route-factory route
 * is built with. `createSimpleRoute`'s own try/catch calls the production
 * `handleRouteError` directly (no custom error handler is registered here at
 * all), so a mutation reverting the fix in `response-helpers.ts` turns this
 * suite red — see the mutation note in HOS-700's report.
 */

import { LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { buildLimitReachedDetails } from '../../src/middlewares/limit-enforcement';
import { createSimpleRoute } from '../../src/utils/route-factory';

const FACTORY_OPTS = { skipAuth: true, skipValidation: true } as const;
const TestResponseSchema = z.object({ ok: z.boolean() });

describe('HOS-700 — handleRouteError public-details scope (real route-factory, no custom onError)', () => {
    it('LIMIT_REACHED: details.limitKey reaches the client with HOSPEDA_API_DEBUG_ERRORS off', async () => {
        // Arrange — the real structured details shape the limit-enforcement
        // middleware builds for an accommodation-limit refusal.
        const details = buildLimitReachedDetails({
            limitKey: LimitKey.MAX_ACCOMMODATIONS,
            currentCount: 3,
            maxAllowed: 3,
            usagePercent: 100
        });

        const app = createSimpleRoute({
            method: 'get',
            path: '/hos-700-limit-reached',
            summary: 'HOS-700 test route',
            description: 'HOS-700 test route',
            tags: ['Test'],
            responseSchema: TestResponseSchema,
            handler: () => {
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    'Accommodation limit reached',
                    details
                );
            },
            options: FACTORY_OPTS
        });

        // Act — a real HTTP request through the real route factory, landing
        // in the real `handleRouteError` via `createSimpleRoute`'s try/catch.
        const res = await app.request('/hos-700-limit-reached');

        // Assert
        expect(res.status).toBe(403);
        const body = (await res.json()) as {
            error: { code: string; details?: { limitKey?: string } };
        };
        expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);
        expect(body.error.details?.limitKey).toBe(LimitKey.MAX_ACCOMMODATIONS);
    });

    it('LIMIT_REACHED: details.limitKey reaches the client for a non-accommodation key (HOS-690 AC-24)', async () => {
        // Arrange — the mechanism `handleRouteError` uses is keyed on
        // `error.code === LIMIT_REACHED`, not on which limit was hit. This
        // proves that generality directly for the gastronomy vertical cap
        // (HOS-690 AC-24), rather than trusting it by inference from the
        // MAX_ACCOMMODATIONS case above.
        const details = buildLimitReachedDetails({
            limitKey: LimitKey.MAX_GASTRONOMIES,
            currentCount: 1,
            maxAllowed: 1,
            usagePercent: 100
        });

        const app = createSimpleRoute({
            method: 'get',
            path: '/hos-690-limit-reached-gastronomy',
            summary: 'HOS-690 test route',
            description: 'HOS-690 test route',
            tags: ['Test'],
            responseSchema: TestResponseSchema,
            handler: () => {
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    'Gastronomy listing limit reached',
                    details
                );
            },
            options: FACTORY_OPTS
        });

        // Act — real HTTP request through the real route factory, same as the
        // MAX_ACCOMMODATIONS case: no custom onError registered here.
        const res = await app.request('/hos-690-limit-reached-gastronomy');

        // Assert
        expect(res.status).toBe(403);
        const body = (await res.json()) as {
            error: { code: string; details?: { limitKey?: string } };
        };
        expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);
        expect(body.error.details?.limitKey).toBe(LimitKey.MAX_GASTRONOMIES);
    });

    it('ENTITLEMENT_REQUIRED: details reaches the client with HOSPEDA_API_DEBUG_ERRORS off', async () => {
        const app = createSimpleRoute({
            method: 'get',
            path: '/hos-700-entitlement-required',
            summary: 'HOS-700 test route',
            description: 'HOS-700 test route',
            tags: ['Test'],
            responseSchema: TestResponseSchema,
            handler: () => {
                throw new ServiceError(
                    ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    'Entitlement required',
                    { entitlementKey: 'FEATURED_LISTING' }
                );
            },
            options: FACTORY_OPTS
        });

        const res = await app.request('/hos-700-entitlement-required');

        expect(res.status).toBe(403);
        const body = (await res.json()) as {
            error: { code: string; details?: { entitlementKey?: string } };
        };
        expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        expect(body.error.details?.entitlementKey).toBe('FEATURED_LISTING');
    });

    it('a code NOT on the public-details list stays stripped — the scope did not widen', async () => {
        // Guards against the exact thing the issue owner ruled out: opening
        // `details` for every 4xx. FORBIDDEN carries `details` on its
        // ServiceError constructor here (some internal-only payload) and it
        // must still be stripped with debug off.
        const app = createSimpleRoute({
            method: 'get',
            path: '/hos-700-forbidden',
            summary: 'HOS-700 test route',
            description: 'HOS-700 test route',
            tags: ['Test'],
            responseSchema: TestResponseSchema,
            handler: () => {
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden', {
                    internalOnly: 'should-not-leak'
                });
            },
            options: FACTORY_OPTS
        });

        const res = await app.request('/hos-700-forbidden');

        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: { code: string; details?: unknown } };
        expect(body.error.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(body.error.details).toBeUndefined();
    });
});
