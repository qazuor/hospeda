/**
 * `GET /billing/usage/{limitKey}` resolves the key's OWN product domain
 * (HOS-1247).
 *
 * ---
 * WHAT WAS MEASURED
 *
 * Staging, 2026-09-08, SHA `4dbfb9ae4`, with a browser session:
 *
 * - `commerce-gastronomy-at-cap@local.test`, whose ONLY subscription is a
 *   gastronomy one, got **404 NOT_FOUND on all four** limit keys it asked for;
 * - `commerce-gastronomy@local.test`, who holds an accommodation subscription
 *   AND a gastronomy one, got `max_accommodations: 1` (right) and
 *   `max_gastronomies: 0` (wrong — its `gastronomy-basico` declares 1).
 *
 * Both follow from one line: the route resolved the subscription with
 * `productDomain ?? 'accommodation'`. With no accommodation row,
 * `getUsageForLimit` answers `null` and the route turns that into a 404; with
 * one, the accommodation PLAN is read for a key it never declares, so
 * `planLimits[limitKey] || 0` is zero.
 *
 * Which domain answers `max_gastronomies` is a property of the KEY, so it is no
 * longer a question the caller gets to answer wrong.
 *
 * The assertions below read the domain the route hands the service rather than
 * the response body: that argument IS the decision under test, and a body
 * assertion would additionally depend on the whole plan/addon/count pipeline
 * this change does not touch.
 *
 * @module test/routes/billing/usage-limit-key-domain
 */

import { LimitKey } from '@repo/billing';
import type { MiddlewareHandler } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { UsageTrackingService } from '../../../src/services/usage-tracking.service.js';
import type { AppOpenAPI } from '../../../src/types.js';

vi.mock('../../../src/middlewares/billing.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/billing.js')>();
    const fakeBillingMiddleware: MiddlewareHandler = async (c, next) => {
        c.set('billingEnabled', true);
        await next();
    };
    return {
        ...actual,
        billingMiddleware: fakeBillingMiddleware,
        getQZPayBilling: () => ({
            customers: { getByExternalId: async () => ({ id: 'cus-usage-1247' }) },
            subscriptions: { getByCustomerId: async () => [] },
            plans: { get: async () => null },
            limits: { getByCustomerId: async () => [] }
        })
    };
});

const OWNER_ID = '33333333-3333-4333-8333-333333333333';

const ownerHeaders = {
    'user-agent': 'vitest',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    // The self-billing gate this route sits behind; unrelated to the domain
    // resolution under test, but a 403 would make every assertion below vacuous.
    'x-mock-actor-permissions': JSON.stringify(['billing.view.own'])
};

/**
 * Spies on the one call whose third argument is the decision under test.
 *
 * @returns The spy, whose `mock.calls[0][2]` is the resolved product domain.
 */
function spyOnUsageLookup() {
    return vi
        .spyOn(UsageTrackingService.prototype, 'getUsageForLimit')
        .mockResolvedValue({ success: true, data: null } as never);
}

/**
 * Issues one usage read.
 *
 * @param app - The booted app.
 * @param limitKey - The key to read.
 * @param query - Optional query string, without the leading `?`.
 */
async function readUsage(app: AppOpenAPI, limitKey: string, query = ''): Promise<void> {
    await app.request(`/api/v1/protected/billing/usage/${limitKey}${query ? `?${query}` : ''}`, {
        headers: ownerHeaders
    });
}

describe('usage read — the limit key decides its own product domain (HOS-1247)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resolves max_gastronomies against the GASTRONOMY subscription', async () => {
        const spy = spyOnUsageLookup();

        await readUsage(app, LimitKey.MAX_GASTRONOMIES);

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0]?.[2]).toBe('gastronomy');
    });

    it('resolves max_experiences against the EXPERIENCE subscription', async () => {
        const spy = spyOnUsageLookup();

        await readUsage(app, LimitKey.MAX_EXPERIENCES);

        expect(spy.mock.calls[0]?.[2]).toBe('experience');
    });

    it('leaves max_accommodations on accommodation — the vertical that bills correctly today', async () => {
        // The discriminating half. A change that routed EVERY key by some new
        // rule would pass both tests above and break the one vertical whose
        // usage read has always been right.
        const spy = spyOnUsageLookup();

        await readUsage(app, LimitKey.MAX_ACCOMMODATIONS);

        expect(spy.mock.calls[0]?.[2]).toBe('accommodation');
    });

    it('keeps honouring ?productDomain= for a key no single vertical owns', async () => {
        // `max_favorites` is declared by the accommodation, tourist AND commerce
        // catalogues, so the key cannot name its own domain and the caller's
        // choice still decides.
        const spy = spyOnUsageLookup();

        await readUsage(app, LimitKey.MAX_FAVORITES, 'productDomain=tourist');

        expect(spy.mock.calls[0]?.[2]).toBe('tourist');
    });

    it('ignores a ?productDomain= that contradicts the key', async () => {
        // Asking for the gastronomy cap "on the accommodation plan" is not a
        // question with an answer — it is how the dual-role owner was told 0.
        const spy = spyOnUsageLookup();

        await readUsage(app, LimitKey.MAX_GASTRONOMIES, 'productDomain=accommodation');

        expect(spy.mock.calls[0]?.[2]).toBe('gastronomy');
    });
});
