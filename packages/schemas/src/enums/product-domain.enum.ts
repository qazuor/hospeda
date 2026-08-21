/**
 * Product domain enum — the billing vertical a subscription or plan belongs to.
 *
 * - accommodation: Traditional lodging listings (hotels, cabins, etc.).
 * - gastronomy: Gastronomy listings, independently subscribable and capped.
 * - experience: Experience listings, independently subscribable and capped.
 * - partner: Partner directory subscriptions.
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
 * `commerce_listing_subscriptions.entity_type`. That is deliberate: it makes a
 * link row's `product_domain` a pure function of its own `entity_type`. The
 * hazard is querying the wrong column and getting plausible results, so any
 * hand-written SQL touching either column names it explicitly.
 */
export enum ProductDomainEnum {
    ACCOMMODATION = 'accommodation',
    GASTRONOMY = 'gastronomy',
    EXPERIENCE = 'experience',
    PARTNER = 'partner'
}
