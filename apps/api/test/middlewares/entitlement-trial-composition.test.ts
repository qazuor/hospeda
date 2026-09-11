/**
 * HOS-1012 T-035 / D-5 (spec §6.8) — the composition seam in `loadEntitlements`.
 *
 * A trial plan grants nothing of its own: it declares
 * `metadata.trialComposition` and the two halves are resolved LIVE, entitlements
 * from its vertical's `pro` tier and limits from its `basico` tier.
 *
 * Every test here gives the trial plan row a **deliberately WRONG snapshot** —
 * no `FEATURED_LISTING`, `max_accommodations: 99`. That is not incidental
 * fixture noise, it is the whole instrument: an implementation that reads the
 * snapshot instead of composing passes a fixture where the snapshot happens to
 * be right, and only fails against one where it is not. Which is also the real
 * production shape, since HOS-39's Model C means the snapshot goes stale the
 * moment an operator edits `owner-pro` or `owner-basico` in the admin panel.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { isOwnerCategorySubscription, PlanService, RoleEnum } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    clearEntitlementCache,
    clearHostDraftDefaultsCache,
    entitlementMiddleware
} from '../../src/middlewares/entitlement';
import type { AppBindings } from '../../src/types';

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

/** The LIVE `owner-pro` row: this is where the trial's entitlements come from. */
const LIVE_OWNER_PRO = {
    id: 'plan-owner-pro',
    slug: 'owner-pro',
    name: 'Professional',
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO,
        EntitlementKey.FEATURED_LISTING,
        EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR
    ] as string[],
    // Present, and must NOT be used: the trial takes its limits from basico.
    limits: { [LimitKey.MAX_ACCOMMODATIONS]: 3, [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 30 }
};

/** The LIVE `owner-basico` row: this is where the trial's limits come from. */
const LIVE_OWNER_BASICO = {
    id: 'plan-owner-basico',
    slug: 'owner-basico',
    name: 'Basic',
    // Present, and must NOT be used: the trial takes its entitlements from pro.
    entitlements: [
        EntitlementKey.PUBLISH_ACCOMMODATIONS,
        EntitlementKey.EDIT_ACCOMMODATION_INFO
    ] as string[],
    limits: { [LimitKey.MAX_ACCOMMODATIONS]: 1, [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 15 }
};

/**
 * The trial plan row as `billing.plans.get` returns it.
 *
 * The snapshot is WRONG on purpose — see the file docblock.
 */
function trialPlanRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'plan-owner-trial',
        name: 'owner-trial',
        entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS] as string[],
        limits: { [LimitKey.MAX_ACCOMMODATIONS]: 99 },
        metadata: {
            slug: 'owner-trial',
            category: 'owner',
            trialComposition: { entitlementsFrom: 'owner-pro', limitsFrom: 'owner-basico' }
        },
        ...overrides
    };
}

describe('loadEntitlements — composed trial plans (HOS-1012 D-5)', () => {
    let app: Hono<AppBindings>;
    let mockBilling: {
        subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
        entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
        limits: { getByCustomerId: ReturnType<typeof vi.fn> };
    };
    let getBySlugSpy: ReturnType<typeof vi.spyOn>;

    const CUSTOMER_ID = 'customer-on-trial';

    beforeEach(() => {
        app = new Hono<AppBindings>();
        mockBilling = {
            subscriptions: { getByCustomerId: vi.fn() },
            plans: { get: vi.fn() },
            entitlements: { getByCustomerId: vi.fn().mockResolvedValue([]) },
            limits: { getByCustomerId: vi.fn().mockResolvedValue([]) }
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            mockBilling as unknown as ReturnType<typeof getQZPayBilling>
        );

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-trial', planId: 'plan-owner-trial', status: 'trialing' }
        ]);
        vi.mocked(isOwnerCategorySubscription).mockResolvedValue(true);

        // The live source rows. Default: both resolve.
        getBySlugSpy = vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(
            // biome-ignore lint/suspicious/noExplicitAny: the mock stands in for BillingPlanResponse
            (async (slug: string): Promise<any> => {
                if (slug === 'owner-pro') return { success: true, data: LIVE_OWNER_PRO };
                if (slug === 'owner-basico') return { success: true, data: LIVE_OWNER_BASICO };
                return { success: false, error: { code: 'NOT_FOUND', message: slug } };
            }) as never
        );

        clearEntitlementCache(CUSTOMER_ID);
        clearHostDraftDefaultsCache();
    });

    afterEach(() => {
        getBySlugSpy.mockRestore();
        vi.clearAllMocks();
    });

    /** Mounts a HOST actor on `customerId` and a reporter route. */
    function mount(customerId: string = CUSTOMER_ID) {
        type InjectedActor = import('../../src/types').AppBindings['Variables']['actor'];
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
            c.set('actor', {
                id: 'host-on-trial',
                roles: [RoleEnum.HOST],
                permissions: [],
                email: 'host-on-trial@example.com'
            } as unknown as InjectedActor);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/test', (c) =>
            c.json({
                entitlements: Array.from(c.get('userEntitlements')).sort(),
                limits: Object.fromEntries(c.get('userLimits'))
            })
        );
    }

    async function run(customerId: string = CUSTOMER_ID) {
        mount(customerId);
        const res = await app.request('/test');
        expect(res.status).toBe(200);
        return (await res.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Record<string, number>;
        };
    }

    it('grants PRO entitlements and BASICO limits — the reverse trial', async () => {
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());

        const data = await run();

        // From owner-pro. This is what the host is meant to EXPERIENCE, and it
        // is absent from both the snapshot and from owner-basico.
        expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        expect(data.entitlements).toContain(EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR);
        // From owner-basico. This is what makes the downgrade problem
        // impossible rather than mitigated: whatever the host loads fits in any
        // plan they subsequently buy.
        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
        expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBe(15);
    });

    it('IGNORES the trial plan snapshot — the snapshot is for showing, not gating', async () => {
        // The snapshot says one accommodation limit of 99 and no featured
        // listing. If either of those reaches the request, the composition was
        // not resolved.
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());

        const data = await run();

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).not.toBe(99);
        expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('does NOT take entitlements from the limits source, nor limits from the entitlements source', async () => {
        // The swap mutation's target, stated as an assertion rather than left
        // implicit in the happy path: swapping the two sources yields
        // basico's entitlements (no FEATURED_LISTING) and pro's limits (3).
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());

        const data = await run();

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).not.toBe(3);
        expect(data.limits[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).not.toBe(30);
        expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('resolves BOTH sources by slug, live, on every load', async () => {
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());

        await run();

        expect(getBySlugSpy).toHaveBeenCalledWith('owner-pro');
        expect(getBySlugSpy).toHaveBeenCalledWith('owner-basico');
    });

    it('is driven by METADATA, not by the slug — a differently-named trial plan composes too', async () => {
        // Kills `if (slug === 'owner-trial')`: with three verticals a hardcoded
        // chain is three chances to forget one, and the third is always the one
        // forgotten.
        mockBilling.plans.get.mockResolvedValue(
            trialPlanRow({
                id: 'plan-some-other-trial',
                name: 'some-other-trial',
                metadata: {
                    slug: 'some-other-trial',
                    category: 'owner',
                    trialComposition: {
                        entitlementsFrom: 'owner-pro',
                        limitsFrom: 'owner-basico'
                    }
                }
            })
        );

        const data = await run();

        expect(data.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
    });

    it('names no trial plan slug anywhere in the middleware source', () => {
        // The static half of the same point. A slug literal here would be the
        // if-chain creeping back in through a different door.
        const source = readFileSync(
            join(import.meta.dirname, '../../src/middlewares/entitlement.ts'),
            'utf-8'
        );
        expect(source).not.toContain("'owner-trial'");
        expect(source).not.toContain("'gastronomy-trial'");
        expect(source).not.toContain("'experience-trial'");
    });

    it('leaves an ORDINARY plan completely alone — no composition, no extra reads', async () => {
        mockBilling.plans.get.mockResolvedValue({
            id: 'plan-owner-premium',
            name: 'owner-premium',
            entitlements: [EntitlementKey.PUBLISH_ACCOMMODATIONS, EntitlementKey.CUSTOM_BRANDING],
            limits: { [LimitKey.MAX_ACCOMMODATIONS]: 10 },
            metadata: { slug: 'owner-premium', category: 'owner' }
        });

        const data = await run('customer-ordinary-plan');

        expect(data.entitlements).toContain(EntitlementKey.CUSTOM_BRANDING);
        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(10);
        // The two extra plan reads are paid ONLY inside the trial branch.
        expect(getBySlugSpy).not.toHaveBeenCalledWith('owner-pro');
    });

    it('degrades to the SNAPSHOT, never to an empty grant set, when a source is missing', async () => {
        // An empty `limits` map reads as UNLIMITED downstream, so falling back
        // to nothing would be strictly worse than falling back to a stale
        // snapshot. This is the one case where the snapshot does gate — as a
        // floor under a misconfiguration, not as the design.
        getBySlugSpy.mockImplementation(
            // biome-ignore lint/suspicious/noExplicitAny: mock stands in for BillingPlanResponse
            (async (slug: string): Promise<any> => {
                if (slug === 'owner-basico') return { success: true, data: LIVE_OWNER_BASICO };
                return { success: false, error: { code: 'NOT_FOUND', message: slug } };
            }) as never
        );
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());

        const data = await run('customer-missing-source');

        expect(data.entitlements).toEqual([EntitlementKey.PUBLISH_ACCOMMODATIONS]);
        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(99);
    });

    it('does NOT cache a degraded composition — the next request retries', async () => {
        // A degraded result is stale by construction. Caching it would serve the
        // wrong grants for the full 5-minute TTL after a transient blip, which
        // for a trial plan means the host silently loses the pro features they
        // were just promised. Same rule the customer-level degradation already
        // follows in this module.
        getBySlugSpy.mockImplementation(
            // biome-ignore lint/suspicious/noExplicitAny: mock stands in for BillingPlanResponse
            (async (slug: string): Promise<any> => {
                if (slug === 'owner-basico') return { success: true, data: LIVE_OWNER_BASICO };
                return { success: false, error: { code: 'NOT_FOUND', message: slug } };
            }) as never
        );
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());
        mount('customer-degraded-then-healthy');

        const degraded = (await (await app.request('/test')).json()) as {
            readonly limits: Record<string, number>;
        };
        expect(degraded.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(99);

        // The source comes back. Nothing cleared the cache in between.
        getBySlugSpy.mockImplementation(
            // biome-ignore lint/suspicious/noExplicitAny: mock stands in for BillingPlanResponse
            (async (slug: string): Promise<any> => {
                if (slug === 'owner-pro') return { success: true, data: LIVE_OWNER_PRO };
                if (slug === 'owner-basico') return { success: true, data: LIVE_OWNER_BASICO };
                return { success: false, error: { code: 'NOT_FOUND', message: slug } };
            }) as never
        );

        const healed = (await (await app.request('/test')).json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Record<string, number>;
        };
        expect(healed.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(1);
        expect(healed.entitlements).toContain(EntitlementKey.FEATURED_LISTING);
    });

    it('degrades to the snapshot when the source lookup THROWS', async () => {
        getBySlugSpy.mockRejectedValue(new Error('DB connection reset'));
        mockBilling.plans.get.mockResolvedValue(trialPlanRow());

        const data = await run('customer-source-throws');

        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(99);
    });

    it('ignores a MALFORMED composition rather than resolving a garbage slug', async () => {
        mockBilling.plans.get.mockResolvedValue(
            trialPlanRow({
                metadata: {
                    slug: 'owner-trial',
                    category: 'owner',
                    trialComposition: { entitlementsFrom: 'owner-pro' }
                }
            })
        );

        const data = await run('customer-malformed-composition');

        // Falls back to the snapshot, and never asks for a half-composition.
        expect(data.limits[LimitKey.MAX_ACCOMMODATIONS]).toBe(99);
        expect(getBySlugSpy).not.toHaveBeenCalledWith('owner-pro');
    });
});
