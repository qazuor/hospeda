/**
 * Product domain enum — the billing vertical a subscription or plan belongs to.
 *
 * - accommodation: Traditional lodging listings (hotels, cabins, etc.).
 * - gastronomy: Gastronomy listings, independently subscribable and capped.
 * - experience: Experience listings, independently subscribable and capped.
 * - partner: Partner directory subscriptions.
 * - addon: A recurring add-on's own MercadoPago preapproval (HOS-847). A
 *   MercadoPago preapproval carries exactly one `auto_recurring.transaction_amount`
 *   and no line items, so a recurring add-on gets its OWN `billing_subscriptions`
 *   row and its OWN preapproval, separate from the customer's real plan
 *   subscription. Explicit, never omitted: `subscriptionMatchesDomain` fails
 *   OPEN for `accommodation` (a missing/`null`/`undefined` value counts as
 *   accommodation, see that function's doc), so an add-on row with no explicit
 *   domain would silently be counted as the owner's accommodation subscription
 *   — the exact contamination this member exists to prevent.
 *
 * **`commerce` is retired (HOS-695, release C).** It used to be the single
 * pre-HOS-685 transitional value covering both gastronomy and experience,
 * kept alive through releases A (HOS-685, widened the vocabulary) and B
 * (HOS-692, rewrote every commerce row to its own vertical) so the old and
 * new vocabularies could overlap while the data migration was still
 * reversible. Release C removes the member itself: nothing may compare or
 * assign `product_domain = 'commerce'` anywhere in production source,
 * including raw SQL and seed files (AC-33). This is the last of the three
 * releases and, unlike A and B, it is NOT reversible past B — see
 * `subscription-product-domain.ts` for the narrowed predicates.
 *
 * **Nothing in the type system defends this enum.** There is no
 * `Record<ProductDomainEnum, …>`, no exhaustive `switch` and no `satisfies`
 * over it, so adding or removing a member compiles clean and every failure is a
 * string comparison that silently stops matching. Two checks stand in for the
 * compiler: the frozen member count in `test/enums/product-domain.enum.test.ts`
 * and `scripts/check-product-domain-vocabulary.sh` in CI's Guards job (plus
 * `scripts/check-product-domain-raw-sql.sh` for raw-string / seed-file
 * comparisons the symbol-based guard cannot see).
 *
 * The `gastronomy` / `experience` values collide by name with
 * `CommerceEntityTypeEnum`, which uses the same two strings for
 * `entity_subscriptions.entity_type`. That is deliberate: it makes a
 * link row's `product_domain` a pure function of its own `entity_type`. The
 * hazard is querying the wrong column and getting plausible results, so any
 * hand-written SQL touching either column names it explicitly.
 */
export enum ProductDomainEnum {
    ACCOMMODATION = 'accommodation',
    GASTRONOMY = 'gastronomy',
    EXPERIENCE = 'experience',
    PARTNER = 'partner',
    ADDON = 'addon'
}

/**
 * The subset of {@link ProductDomainEnum} members that represent an actual
 * subscribable BUSINESS VERTICAL — a product with its own catalogue,
 * listings and entitlements — as opposed to a domain that exists purely as a
 * BILLING MECHANISM.
 *
 * `ADDON` (HOS-847) is the first non-vertical member: it tags a recurring
 * add-on's OWN MercadoPago preapproval row, never a customer's real plan
 * subscription (see `subscriptionMatchesDomain`'s doc in
 * `@repo/service-core`). Any call site that asks "how many distinct
 * verticals does this customer hold an active subscription in" — e.g. the
 * `/mi-cuenta/` plan-summary widget (`resolveUserPlanSummary` in
 * `apps/api/src/routes/user/protected/stats.ts`, HOS-1066) — MUST iterate
 * this list, never `Object.values(ProductDomainEnum)` directly. Object.values
 * silently absorbs every future member as "one more vertical", which is
 * exactly how `ADDON` almost turned "one active plan + one active add-on"
 * into a 2-domain summary with no plan name at all (found in review before
 * merge, HOS-847 PR 2).
 *
 * A caller that genuinely wants EVERY domain value — e.g. an admin filter
 * dropdown that must let staff filter subscriptions by `'addon'` too
 * (`apps/admin/src/features/billing-subscriptions/SubscriptionFilters.tsx`)
 * — should keep using `Object.values(ProductDomainEnum)` directly; this
 * constant is not a blanket replacement for it, only for "count distinct
 * verticals" call sites.
 */
export const BUSINESS_VERTICAL_PRODUCT_DOMAINS = [
    ProductDomainEnum.ACCOMMODATION,
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE,
    ProductDomainEnum.PARTNER
] as const;
