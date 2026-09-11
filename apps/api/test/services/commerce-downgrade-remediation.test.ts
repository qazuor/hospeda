/**
 * Unit tests for the commerce downgrade remediation (HOS-1122).
 *
 * ## What has to be true, and why each is easy to get silently wrong
 *
 * 1. **The cap is READ from the target tier, and a missing one is an ERROR.**
 *    Every layer beneath resolves an unknown limit key as `-1` — unlimited —
 *    without raising (HOS-1078 / HOS-973 R-2). A remediation that inherited
 *    that would compute an excess of zero, restrict nothing, and log a
 *    successful run. So the cap resolution is asserted per tier against the
 *    REAL catalogue (HOS-975's 1/3/5 and 1/5/10 ladders), not against a
 *    hand-made plan object that would only prove the arithmetic.
 * 2. **The excess is measured over the listings LINKED TO THIS SUBSCRIPTION**,
 *    and only the ones not already restricted. Counting the restricted ones
 *    again would cut a second batch on every re-run.
 * 3. **The owner's keep selection wins over the default order**, and a
 *    selection that names ids this subscription does not own is dropped rather
 *    than obeyed.
 * 4. **The restriction is durable.** The flag is what makes it stick; the
 *    visibility flip alone would be undone by the next renewal webhook, which
 *    sees an `active` subscription. Both are asserted.
 *
 * @module test/services/commerce-downgrade-remediation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// The revalidation service is a side effect on a page cache; stubbing it to
// absent keeps these tests about the database state they are named for.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, getRevalidationService: () => undefined };
});

/**
 * A pass-through over `findCommercePlanForVertical` that the "missing cap"
 * cases can point at a deliberately malformed tier.
 *
 * The catalogue is a frozen constant, so a tier with no listing limit is not
 * reachable through it — and the branch that refuses one is the single most
 * load-bearing line in this module. Every other test in this file goes through
 * the pass-through and reads the REAL catalogue, so nothing here is asserting
 * that one mock agrees with another.
 */
const { planOverride } = vi.hoisted(() => ({
    planOverride: { value: undefined as unknown }
}));
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        findCommercePlanForVertical: (input: {
            vertical: 'gastronomy' | 'experience';
            slug: string;
        }) =>
            planOverride.value === undefined
                ? actual.findCommercePlanForVertical(input)
                : planOverride.value
    };
});

import {
    EXPERIENCE_PREMIUM_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    GASTRONOMY_PRO_PLAN
} from '@repo/billing';
import {
    applyCommerceDowngradeRestrictions,
    applyCommerceUpgradeRestorations,
    type CommerceDowngradeDeps,
    CommerceListingCapMissingError,
    computeCommerceDowngradeExcess,
    resolveCommerceListingCap
} from '../../src/services/commerce-downgrade-remediation.service';

const SUB_ID = 'sub-gastro-1';

/** Deterministic uuid-ish ids; the module never parses them. */
function listingId(n: number): string {
    return `00000000-0000-4000-8000-00000000000${n}`;
}

/**
 * An in-memory stand-in for the two `entity_subscriptions` reads and the one
 * write, so the whole flow runs without a database and the assertions are about
 * the STATE it leaves behind rather than about which SQL it emitted.
 */
function makeDeps(input: {
    covered: number[];
    restricted?: number[];
    /** `updatedAt` day per listing index; higher = more recent = kept first. */
    recency?: Record<number, number>;
}): CommerceDowngradeDeps & {
    state: { covered: Set<number>; restricted: Set<number> };
    reconciled: Array<{ entityId: string; planRestricted: boolean }>;
} {
    const state = {
        covered: new Set(input.covered),
        restricted: new Set(input.restricted ?? [])
    };
    const reconciled: Array<{ entityId: string; planRestricted: boolean }> = [];

    return {
        state,
        reconciled,
        getLinkedListings: vi.fn(async ({ planRestricted }) =>
            [...(planRestricted ? state.restricted : state.covered)].map((n) => ({
                entityId: listingId(n)
            }))
        ),
        getListings: vi.fn(async ({ ids }) =>
            ids.map((id: string) => {
                const n = Number(id.slice(-1));
                return {
                    id,
                    name: `Listing ${n}`,
                    updatedAt: new Date(2026, 0, input.recency?.[n] ?? n + 1)
                };
            })
        ),
        setPlanRestricted: vi.fn(async ({ entityIds, planRestricted }) => {
            for (const id of entityIds) {
                const n = Number(id.slice(-1));
                if (planRestricted) {
                    state.covered.delete(n);
                    state.restricted.add(n);
                } else {
                    state.restricted.delete(n);
                    state.covered.add(n);
                }
            }
        }),
        reconcileListing: vi.fn(async ({ entityId, planRestricted }) => {
            reconciled.push({ entityId, planRestricted });
        })
    };
}

// Reset at the TOP level, not inside the one describe that sets it:
// `clearAllMocks` does not touch a hoisted object, and an override left
// standing would make every later assertion about the "real catalogue" read a
// stub instead — green, and measuring nothing.
beforeEach(() => {
    planOverride.value = undefined;
    vi.clearAllMocks();
});

describe('resolveCommerceListingCap (HOS-1122)', () => {
    it('reads the REAL ladder each vertical declares — 1/3/5 and 1/5/10', () => {
        // Against the catalogue, not a fixture. The original issue assumed the
        // cap never changed between tiers; HOS-975 made it the whole substance
        // of a commerce downgrade, and this is what notices if it moves back.
        expect(resolveCommerceListingCap('gastronomy', GASTRONOMY_BASICO_PLAN.slug)).toBe(1);
        expect(resolveCommerceListingCap('gastronomy', GASTRONOMY_PRO_PLAN.slug)).toBe(3);
        expect(resolveCommerceListingCap('gastronomy', GASTRONOMY_PREMIUM_PLAN.slug)).toBe(5);
        expect(resolveCommerceListingCap('experience', EXPERIENCE_PRO_PLAN.slug)).toBe(5);
        expect(resolveCommerceListingCap('experience', EXPERIENCE_PREMIUM_PLAN.slug)).toBe(10);
    });

    it('refuses the OTHER vertical’s tier rather than reading its cap', () => {
        expect(() =>
            resolveCommerceListingCap('gastronomy', EXPERIENCE_PRO_PLAN.slug)
        ).toThrowError(/not a tier of the 'gastronomy' vertical/);
    });

    it('throws instead of treating a MISSING cap as unlimited', () => {
        // The failure this whole module is arranged to avoid. A tier whose
        // limit key fell out would otherwise measure an excess of zero and
        // report a successful, empty restriction pass.
        planOverride.value = { ...GASTRONOMY_PRO_PLAN, limits: [] };

        expect(() =>
            resolveCommerceListingCap('gastronomy', GASTRONOMY_PRO_PLAN.slug)
        ).toThrowError(CommerceListingCapMissingError);
        expect(() =>
            resolveCommerceListingCap('gastronomy', GASTRONOMY_PRO_PLAN.slug)
        ).toThrowError(/max_gastronomies/);
    });

    it('throws for a cap of -1 too — nothing in commerce is uncapped', () => {
        // `-1` is the sentinel every layer beneath produces for a key it could
        // not resolve. Accepting it here would let that sentinel travel one
        // level further and be read as a real, generous cap.
        planOverride.value = {
            ...GASTRONOMY_PRO_PLAN,
            limits: [{ key: 'max_gastronomies', value: -1 }]
        };

        expect(() =>
            resolveCommerceListingCap('gastronomy', GASTRONOMY_PRO_PLAN.slug)
        ).toThrowError(CommerceListingCapMissingError);
    });

    it('accepts a cap of 0 — that is a decision, not a sentinel', () => {
        planOverride.value = {
            ...GASTRONOMY_PRO_PLAN,
            limits: [{ key: 'max_gastronomies', value: 0 }]
        };

        expect(resolveCommerceListingCap('gastronomy', GASTRONOMY_PRO_PLAN.slug)).toBe(0);
    });

    it('throws when the slug names no tier of the vertical at all', () => {
        planOverride.value = null;

        expect(() =>
            resolveCommerceListingCap('gastronomy', GASTRONOMY_PRO_PLAN.slug)
        ).toThrowError(/not a tier of the 'gastronomy' vertical/);
    });
});

describe('computeCommerceDowngradeExcess (HOS-1122)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('counts only the listings this subscription still covers', async () => {
        // Listing 9 is already restricted from an earlier pass. Counting it
        // again would cut a second batch on every re-run.
        const deps = makeDeps({ covered: [0, 1, 2], restricted: [9] });

        const preview = await computeCommerceDowngradeExcess(
            {
                subscriptionId: SUB_ID,
                vertical: 'gastronomy',
                targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug
            },
            deps
        );

        expect(preview.cap).toBe(1);
        expect(preview.activeCount).toBe(3);
        expect(preview.excessCount).toBe(2);
        expect(deps.getLinkedListings).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionId: SUB_ID, planRestricted: false })
        );
    });

    it('marks the most-recently-updated listings keepByDefault, up to the cap', async () => {
        const deps = makeDeps({ covered: [0, 1, 2], recency: { 0: 1, 1: 5, 2: 3 } });

        const preview = await computeCommerceDowngradeExcess(
            {
                subscriptionId: SUB_ID,
                vertical: 'gastronomy',
                targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug
            },
            deps
        );

        expect(preview.items.map((item) => item.id)).toEqual([
            listingId(1),
            listingId(2),
            listingId(0)
        ]);
        expect(preview.items.filter((item) => item.keepByDefault).map((item) => item.id)).toEqual([
            listingId(1)
        ]);
    });

    it('reports no excess when the tier still covers everything', async () => {
        const deps = makeDeps({ covered: [0, 1, 2] });

        const preview = await computeCommerceDowngradeExcess(
            {
                subscriptionId: SUB_ID,
                vertical: 'gastronomy',
                targetPlanSlug: GASTRONOMY_PRO_PLAN.slug // cap 3
            },
            deps
        );

        expect(preview.hasExcess).toBe(false);
        expect(preview.items).toEqual([]);
    });
});

describe('applyCommerceDowngradeRestrictions (HOS-1122)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('restricts the over-cap listings and leaves the default keep band alone', async () => {
        const deps = makeDeps({ covered: [0, 1, 2], recency: { 0: 1, 1: 5, 2: 3 } });

        const summary = await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });

        expect(summary.cap).toBe(1);
        expect([...summary.restricted].sort()).toEqual([listingId(0), listingId(2)]);
        expect([...deps.state.covered]).toEqual([1]);
    });

    it('writes the FLAG as well as flipping visibility — the flag is what makes it stick', async () => {
        // The visibility write alone is undone by the next renewal webhook: it
        // sees `active` and republishes. `entity_subscriptions.plan_restricted`
        // is the term the reconciler reads to refuse.
        const deps = makeDeps({ covered: [0, 1], recency: { 0: 1, 1: 5 } });

        await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });

        expect(deps.setPlanRestricted).toHaveBeenCalledWith(
            expect.objectContaining({ entityIds: [listingId(0)], planRestricted: true })
        );
        expect(deps.reconciled).toEqual([{ entityId: listingId(0), planRestricted: true }]);
    });

    it('forwards the subscription status it was given, never a hardcoded "active"', async () => {
        // A downgrade that applies on a lapsed subscription must not republish
        // the kept listings as a side effect of the reconcile.
        const deps = makeDeps({ covered: [0, 1], recency: { 0: 1, 1: 5 } });

        await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'past_due',
            deps
        });

        expect(deps.reconcileListing).toHaveBeenCalledWith(
            expect.objectContaining({ subscriptionStatus: 'past_due' })
        );
    });

    it('honours the owner’s keep selection over the default order', async () => {
        // Listing 1 is the most recent, so the default would keep it. The owner
        // asked for listing 0 instead.
        const deps = makeDeps({ covered: [0, 1], recency: { 0: 1, 1: 5 } });

        const summary = await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'active',
            keepSelections: { listingIds: [listingId(0)] },
            deps
        });

        expect(summary.restricted).toEqual([listingId(1)]);
        expect(summary.keptBySelection).toEqual([listingId(0)]);
    });

    it('drops selected ids this subscription does not cover and falls back to the default', async () => {
        // A stale id, or one from the owner's OTHER vertical. Obeying it would
        // keep nothing and restrict everything.
        const deps = makeDeps({ covered: [0, 1], recency: { 0: 1, 1: 5 } });

        const summary = await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'active',
            keepSelections: { listingIds: ['11111111-1111-4111-8111-111111111111'] },
            deps
        });

        expect(summary.restricted).toEqual([listingId(0)]);
        expect(summary.keptBySelection).toEqual([]);
        expect([...deps.state.covered]).toEqual([1]);
    });

    it('is idempotent: a second pass over the same subscription restricts nothing', async () => {
        const deps = makeDeps({ covered: [0, 1, 2] });

        await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });
        const second = await applyCommerceDowngradeRestrictions({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            targetPlanSlug: GASTRONOMY_BASICO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });

        expect(second.restricted).toEqual([]);
        expect(deps.state.restricted.size).toBe(2);
    });
});

describe('applyCommerceUpgradeRestorations (HOS-1122)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('brings listings back up to the new tier’s headroom', async () => {
        // básico (1) → pro (3): one covered, two restricted, two slots free.
        const deps = makeDeps({ covered: [0], restricted: [1, 2] });

        const result = await applyCommerceUpgradeRestorations({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            newPlanSlug: GASTRONOMY_PRO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });

        expect([...result.restored].sort()).toEqual([listingId(1), listingId(2)]);
        expect(result.stillRestricted).toEqual([]);
        expect(deps.state.restricted.size).toBe(0);
    });

    it('restores only as far as the headroom reaches, most recent first', async () => {
        // básico (1) → pro (3) with two already covered: exactly one slot.
        const deps = makeDeps({
            covered: [0, 1],
            restricted: [2, 3],
            recency: { 2: 2, 3: 9 }
        });

        const result = await applyCommerceUpgradeRestorations({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            newPlanSlug: GASTRONOMY_PRO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });

        expect(result.restored).toEqual([listingId(3)]);
        expect(result.stillRestricted).toEqual([listingId(2)]);
    });

    it('restores nothing when the new tier has no headroom left', async () => {
        const deps = makeDeps({ covered: [0], restricted: [1] });

        const result = await applyCommerceUpgradeRestorations({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            newPlanSlug: GASTRONOMY_BASICO_PLAN.slug, // cap 1, already used
            subscriptionStatus: 'active',
            deps
        });

        expect(result.restored).toEqual([]);
        expect(result.stillRestricted).toEqual([listingId(1)]);
        expect(deps.setPlanRestricted).not.toHaveBeenCalled();
    });

    it('clears the flag AND reconciles, so the listing actually becomes public again', async () => {
        const deps = makeDeps({ covered: [], restricted: [1] });

        await applyCommerceUpgradeRestorations({
            subscriptionId: SUB_ID,
            vertical: 'gastronomy',
            newPlanSlug: GASTRONOMY_PRO_PLAN.slug,
            subscriptionStatus: 'active',
            deps
        });

        expect(deps.setPlanRestricted).toHaveBeenCalledWith(
            expect.objectContaining({ entityIds: [listingId(1)], planRestricted: false })
        );
        expect(deps.reconciled).toEqual([{ entityId: listingId(1), planRestricted: false }]);
    });
});
