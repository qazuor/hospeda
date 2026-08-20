/**
 * Product domain enum — the billing vertical a subscription or plan belongs to.
 *
 * - accommodation: Traditional lodging listings (hotels, cabins, etc.).
 * - gastronomy: Gastronomy listings, independently subscribable and capped.
 * - experience: Experience listings, independently subscribable and capped.
 * - commerce: **Transitional.** The single pre-HOS-685 value covering both
 *   gastronomy and experience. Retired in release C (HOS-695).
 * - partner: Partner directory subscriptions.
 *
 * **Why `commerce` is still here** (HOS-685, release A): every commerce row in
 * the database says `'commerce'` today, and the predicates that read it fail
 * closed on the exact string. Removing the value before the rows are rewritten
 * (HOS-692, release B) would make every commerce subscription stop matching —
 * the reconciler would stop seeing them and every commerce listing would go
 * dark. The old and new vocabularies overlap on purpose, so that B stays
 * undoable: its undo migration maps the verticals back to `commerce`, which
 * only works while the code still understands `commerce`.
 *
 * **Nothing in the type system defends this enum.** There is no
 * `Record<ProductDomainEnum, …>`, no exhaustive `switch` and no `satisfies`
 * over it, so adding or removing a member compiles clean and every failure is a
 * string comparison that silently stops matching. Two checks stand in for the
 * compiler: the frozen member count in `test/enums/product-domain.enum.test.ts`
 * and `scripts/check-product-domain-vocabulary.sh` in CI's Guards job.
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
    COMMERCE = 'commerce',
    GASTRONOMY = 'gastronomy',
    EXPERIENCE = 'experience',
    PARTNER = 'partner'
}
