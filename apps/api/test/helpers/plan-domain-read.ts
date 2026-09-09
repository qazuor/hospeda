/**
 * Arms the `billing_plans.product_domain` lookup that `createPaidSubscription`
 * issues before creating a preapproval (HOS-1233 T-032).
 *
 * WHY EVERY SUITE THAT EXERCISES A PAID CHECKOUT NEEDS THIS
 *
 * qzpay-core 6.0.0 made `productDomain` REQUIRED on subscription creation, and
 * `createPaidSubscription` resolves it from the plan being purchased rather
 * than taking it from its caller — deliberately, because every paid checkout of
 * every vertical funnels through that one call, distinguished only by `planId`.
 * A caller-supplied value is one somebody can hardcode wrong, which is the bug
 * this replaces: before 6.0.0 the parameter did not exist, so every row was
 * born on the column's `'accommodation'` default and every tourist plan
 * reported `accommodation` in prod and staging alike (spec F-4b/F-4c).
 *
 * The lookup fails CLOSED: a plan the read cannot find throws
 * `PLAN_NOT_FOUND` rather than defaulting. `test/setup.ts` mocks `@repo/db`
 * wholesale, so an unarmed suite hits that throw — which is the intended
 * behaviour, not a bug in the helper.
 *
 * The domain is a PARAMETER on purpose. The spec's §9 requires the tourist
 * checkout and the accommodation checkout to be asserted SEPARATELY, "since a
 * hardcoded forward would satisfy one and not the other" — a helper that only
 * ever armed `'accommodation'` would make that impossible to write.
 *
 * @module test/helpers/plan-domain-read
 */

import { getDb } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { vi } from 'vitest';

/**
 * Points the mocked `getDb()` at a chain that answers the plan-domain SELECT
 * with a single row carrying `domain`.
 *
 * @param domain - The product domain the plan row reports. Defaults to
 *   accommodation, which is what most existing fixtures mean.
 * @returns The `where` spy, so a caller can assert the lookup ran at all.
 *
 * @example
 * ```ts
 * beforeEach(() => {
 *     mockPlanDomainRead();
 * });
 *
 * it('states tourist for a tourist plan', async () => {
 *     mockPlanDomainRead(ProductDomainEnum.TOURIST);
 *     await createPaidSubscription({ ... });
 *     expect(billing.subscriptions.create).toHaveBeenCalledWith(
 *         expect.objectContaining({ productDomain: 'tourist' })
 *     );
 * });
 * ```
 */
export function mockPlanDomainRead(
    domain: ProductDomainValue = ProductDomainEnum.ACCOMMODATION
): ReturnType<typeof vi.fn> {
    // HOS-1272: `.orderBy(...).limit(...)` chained onto the SAME `limit` the
    // direct `.limit(...)` call uses — `loadAccommodationBridge`
    // (`checkout-idempotency.ts`) is the one query in the accommodation
    // checkout path that orders before limiting, and this generic stub
    // answers every `select().from().where()` call regardless of table, so it
    // must expose both shapes or that query throws `orderBy is not a
    // function`. The row it hands back (`{ productDomain: domain, createdAt }`,
    // missing every other column the bridge/own-preapproval queries project)
    // safely fails the reuse decision's identity checks on `customerId` — this
    // helper was never meant to arm reuse, only the plan-domain lookup.
    // `createdAt` MUST be a real `Date`: `decideOwnPreapprovalReuse` computes
    // `row.createdAt.getTime()` unconditionally, BEFORE its own identity
    // guards run, so an `undefined` here throws instead of cleanly refusing.
    const limit = vi.fn(() => Promise.resolve([{ productDomain: domain, createdAt: new Date() }]));
    const where = vi.fn(() => ({
        limit,
        orderBy: vi.fn(() => ({ limit }))
    }));

    // MERGED onto whatever the client already exposes, never substituted for it.
    // A helper that returned a select-only stub silently removed `.update()`,
    // `.insert()` and `.transaction()` from every suite that armed it — the
    // own-preapproval flow then died on `client.update is not a function`,
    // which reads like a broken service rather than a blunt test helper.
    const existing = (vi.mocked(getDb).getMockImplementation()?.() ?? {}) as Record<
        string,
        unknown
    >;

    vi.mocked(getDb).mockReturnValue({
        ...existing,
        select: vi.fn(() => ({
            from: vi.fn(() => ({ where }))
        }))
    } as never);

    return where;
}

/**
 * Arms the same lookup to find NO plan, so the fail-closed `PLAN_NOT_FOUND`
 * path can be asserted deliberately rather than reached by an unarmed suite.
 */
export function mockPlanDomainReadMissing(): void {
    const existing = (vi.mocked(getDb).getMockImplementation()?.() ?? {}) as Record<
        string,
        unknown
    >;

    // HOS-1272: same `.orderBy(...).limit(...)` shape as `mockPlanDomainRead`
    // above, for the identical reason — this stub answers every table's
    // select, including `loadAccommodationBridge`'s ordered query.
    const limit = vi.fn(() => Promise.resolve([]));
    vi.mocked(getDb).mockReturnValue({
        ...existing,
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({ limit, orderBy: vi.fn(() => ({ limit })) }))
            }))
        }))
    } as never);
}
