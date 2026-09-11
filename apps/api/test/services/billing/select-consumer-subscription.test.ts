/**
 * Unit tests for `selectAccommodationSubscription` (HOS-1213), and for the
 * tourist reclassification that changes what it must select (HOS-1233 F-4g #2).
 *
 * ## Why this function needed its own file
 *
 * It had no direct test at all. Its single caller,
 * `POST /protected/billing/subscriptions/change-plan`
 * (`routes/billing/plan-change.ts:246`), answers `undefined` with **HTTP 404
 * `No active subscription found`** — so every defect here surfaces as a
 * plausible "you have no subscription", which is exactly what a customer who
 * genuinely has none also sees. Nothing distinguishes the two from outside.
 *
 * ## What the reclassification broke
 *
 * Tourist plans used to be filed as `accommodation`, so a `tourist-vip` row
 * satisfied `subscriptionMatchesDomain(sub, 'accommodation')` by accident.
 * Reclassified to their own `tourist` domain, the selection returns `undefined`
 * and a paying tourist VIP **cannot change their plan**. This is the user-side
 * twin of the admin gate D-8 named; only the admin half was fixed (T-039).
 *
 * ## The fixtures never inject `productDomain`
 *
 * `getByCustomerId()` never populates it (HOS-934), and the real call site
 * hands this function exactly those objects. A fixture that set the column by
 * hand would test a shape production never produces — the precise mistake that
 * kept `addon-limit-recalculation.service.ts` broken for 13 days with a green
 * suite. Here the column is recovered through a mocked
 * `hydrateSubscriptionProductDomains`, which is what the function really calls.
 *
 * `subscriptionMatchesDomain` is deliberately NOT mocked: it is the predicate
 * under test. Mocking the comparator would leave an assertion that can only
 * ever confirm the mock.
 *
 * @module test/services/billing/select-consumer-subscription
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHydrate } = vi.hoisted(() => ({ mockHydrate: vi.fn() }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, hydrateSubscriptionProductDomains: mockHydrate };
});

import { selectAccommodationSubscription } from '../../../src/services/billing/plan-domain-guard';

/** A `getByCustomerId()`-shaped row: no `productDomain` key at all (HOS-934). */
function buildSubscription(id: string) {
    return { id, status: 'active' as const };
}

/**
 * Wires the hydration to stamp each row with the domain the column really
 * holds, keyed by id — mirroring the batched recovery SELECT.
 */
function hydrateAs(domains: Record<string, string | null>) {
    mockHydrate.mockImplementation(async (subs: readonly { id: string }[]) =>
        subs.map((sub) => ({ ...sub, productDomain: domains[sub.id] ?? null }))
    );
}

describe('selectAccommodationSubscription — tourist reclassification (HOS-1233 F-4g)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('selects a reclassified tourist subscription', async () => {
        hydrateAs({ 'sub-tourist': 'tourist' });

        const selected = await selectAccommodationSubscription([buildSubscription('sub-tourist')]);

        // Before the fix this is `undefined`, and plan-change.ts answers
        // HTTP 404 "No active subscription found" to a paying tourist VIP.
        expect(selected?.id).toBe('sub-tourist');
    });

    it('still selects the same subscription while it is filed as accommodation', async () => {
        hydrateAs({ 'sub-tourist-legacy': 'accommodation' });

        const selected = await selectAccommodationSubscription([
            buildSubscription('sub-tourist-legacy')
        ]);

        expect(selected?.id).toBe('sub-tourist-legacy');
    });

    it('does NOT select a gastronomy subscription — widening to tourist is not widening to every domain', async () => {
        hydrateAs({ 'sub-gastronomy': 'gastronomy' });

        const selected = await selectAccommodationSubscription([
            buildSubscription('sub-gastronomy')
        ]);

        expect(selected).toBeUndefined();
    });

    it('does NOT select a partner subscription', async () => {
        hydrateAs({ 'sub-partner': 'partner' });

        const selected = await selectAccommodationSubscription([buildSubscription('sub-partner')]);

        expect(selected).toBeUndefined();
    });

    it('prefers the accommodation subscription over a tourist one held by the same customer', async () => {
        // A host who also pays for a tourist tier holds both. This route governs
        // the owner plan, so the tourist row must never displace it — and the
        // storage adapter's ordering must not decide which one is mutated.
        hydrateAs({ 'sub-tourist': 'tourist', 'sub-accommodation': 'accommodation' });

        const selected = await selectAccommodationSubscription([
            buildSubscription('sub-tourist'),
            buildSubscription('sub-accommodation')
        ]);

        expect(selected?.id).toBe('sub-accommodation');
    });

    it('treats a legacy NULL productDomain as accommodation (the fail-open this function documents)', async () => {
        hydrateAs({ 'sub-legacy': null });

        const selected = await selectAccommodationSubscription([buildSubscription('sub-legacy')]);

        expect(selected?.id).toBe('sub-legacy');
    });

    it('returns undefined for an empty list without hydrating', async () => {
        hydrateAs({});

        expect(await selectAccommodationSubscription([])).toBeUndefined();
        expect(mockHydrate).not.toHaveBeenCalled();
    });
});
