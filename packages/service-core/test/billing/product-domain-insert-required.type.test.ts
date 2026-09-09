/**
 * @fileoverview
 * Type-level tests freezing HOS-1312 / HOS-1233 AC-15i: `productDomain` is a
 * REQUIRED key of the Drizzle insert type of BOTH domain-carrying billing
 * tables — `billing_plans` and `billing_subscriptions`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Migration `0121_smart_mulholland_black.sql` drops `DEFAULT 'accommodation'`
 * from both `product_domain` columns. Its declared risk (HOS-1233 R-8) is that
 * dropping the default while any create still omits the column breaks every
 * paid checkout, of every vertical, at the first insert. It merged with the
 * `.sql` file and no test at all.
 *
 * What makes the risk cheap to retire is that `@qazuor/qzpay-drizzle` 4.0.0
 * already declares both columns `.notNull()` with NO `.default()`. A
 * `.notNull()` column without a default is MANDATORY in Drizzle's
 * `$inferInsert`, so a create that omits it no longer compiles — the compiler
 * enforces, ahead of any database, exactly what the migration will enforce at
 * runtime. Measured 2026-09-09: with the column deleted from the payload,
 * `apps/api` and `@repo/seed` both fail `tsc` with
 * `Property 'productDomain' is missing ... but required`.
 *
 * These assertions are what stops that guarantee from being lost silently. The
 * day someone re-adds a `.default()` upstream, or the day a schema change makes
 * the key optional again, this file stops compiling — which is a louder signal
 * than the guarantee quietly evaporating and the next `db:migrate` taking the
 * checkouts down with it.
 *
 * ---------------------------------------------------------------------------
 * WHY IT LIVES IN `@repo/service-core` AND NOT IN `@repo/db`
 * ---------------------------------------------------------------------------
 * `expectTypeOf` and `@ts-expect-error` are erased at runtime: they assert
 * nothing unless a TYPE CHECKER reads the file. `packages/db/tsconfig.json`
 * EXCLUDES its whole `test` tree, and no package in this repo runs vitest in
 * `--typecheck` mode, so the same file placed under `packages/db/test/` would
 * pass vitest while asserting literally nothing.
 * `packages/service-core/tsconfig.json` INCLUDES its `test` tree, so
 * `pnpm --filter @repo/service-core typecheck` really
 * does evaluate every line below — the same arrangement the repo's two existing
 * type-level tests rely on (`packages/schemas/test/common/entity-filters.type.test.ts`,
 * `packages/service-core/test/base/crud/adminSearchExecuteParams.type.test.ts`).
 *
 * Running this file under vitest is therefore a no-op by construction. `tsc` is
 * the gate; a green vitest run means nothing here.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES NOT COVER
 * ---------------------------------------------------------------------------
 * Raw-SQL inserts are invisible to the compiler: `INSERT INTO billing_plans`
 * inside a template literal type-checks no matter which columns it names. That
 * surface is guarded separately by `scripts/check-product-domain-raw-sql.sh`.
 */
import type { billingPlans, billingSubscriptions } from '@repo/db';
import { describe, expectTypeOf, it } from 'vitest';

type PlanInsert = typeof billingPlans.$inferInsert;
type SubscriptionInsert = typeof billingSubscriptions.$inferInsert;

/**
 * Every key of `T` that carries a `?`.
 *
 * The projection MUST happen inside a mapped type over `keyof T`. Two shorter
 * spellings were tried first and both measured VACUOUS — each answered
 * `'REQUIRED'` for `{ productDomain?: string }`, a type whose key is explicitly
 * optional, because `Pick<TGeneric, 'productDomain'>` stays deferred when the
 * object is still a bare type parameter:
 *
 *   - `Record<never, never> extends Pick<TInsert, 'productDomain'>`
 *   - `Pick<TInsert, 'k'> extends Required<Pick<TInsert, 'k'>>`
 *
 * Mapping over `[K in keyof T]-?` forces `K` to a literal key before `Pick`
 * runs, which is what makes the comparison actually evaluate.
 */
type OptionalKeysOf<T> = {
    [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Resolves to `'REQUIRED'` while `productDomain` is a mandatory key of
 * `TInsert`, and to `'OPTIONAL'` the moment it stops being one.
 */
type ProductDomainRequiredness<TInsert> =
    'productDomain' extends OptionalKeysOf<TInsert> ? 'OPTIONAL' : 'REQUIRED';

/**
 * Never invoked. It exists so `tsc` evaluates the two assignments below.
 *
 * Each `@ts-expect-error` is a two-way assertion, which is the whole point: the
 * row type is the full insert payload MINUS the domain, so every other required
 * key is present and the ONLY reason the assignment can fail is the missing
 * `productDomain`. If the key ever becomes optional again the assignment starts
 * succeeding and `tsc` reports the directive as unused — so this fails whether
 * the guarantee is broken in one direction or the other.
 */
function _domainOmissionMustNotCompile(
    planRow: Omit<PlanInsert, 'productDomain'>,
    subscriptionRow: Omit<SubscriptionInsert, 'productDomain'>
): void {
    // @ts-expect-error HOS-1312: a billing_plans create that omits the product
    // domain must not compile once the column has no DEFAULT to answer for it.
    const _plan: PlanInsert = planRow;
    // @ts-expect-error HOS-1312: same for billing_subscriptions — this is the
    // create that migration 0121 would otherwise break at the first checkout.
    const _subscription: SubscriptionInsert = subscriptionRow;
}

describe('product_domain is required in the Drizzle insert type (HOS-1312)', () => {
    // Positive control. Without it, a helper that answered 'REQUIRED' for every
    // input — which two earlier spellings of it did — would keep this whole file
    // green while asserting nothing. This pair is what makes the two assertions
    // below load-bearing rather than decorative.
    describe('the optionality helper itself', () => {
        it('should call an OPTIONAL key optional', () => {
            expectTypeOf<
                ProductDomainRequiredness<{ productDomain?: string }>
            >().toEqualTypeOf<'OPTIONAL'>();
        });

        it('should call a REQUIRED key required', () => {
            expectTypeOf<
                ProductDomainRequiredness<{ productDomain: string }>
            >().toEqualTypeOf<'REQUIRED'>();
        });
    });

    describe('billing_plans', () => {
        it('should expose productDomain on the insert type', () => {
            expectTypeOf<PlanInsert>().toHaveProperty('productDomain');
        });

        it('should require productDomain — the column carries no DEFAULT', () => {
            expectTypeOf<ProductDomainRequiredness<PlanInsert>>().toEqualTypeOf<'REQUIRED'>();
        });
    });

    describe('billing_subscriptions', () => {
        it('should expose productDomain on the insert type', () => {
            expectTypeOf<SubscriptionInsert>().toHaveProperty('productDomain');
        });

        it('should require productDomain — the column carries no DEFAULT', () => {
            expectTypeOf<
                ProductDomainRequiredness<SubscriptionInsert>
            >().toEqualTypeOf<'REQUIRED'>();
        });
    });
});
