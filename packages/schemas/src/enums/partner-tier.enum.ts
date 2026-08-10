/**
 * Partner tier enum
 *
 * The two COMMERCIAL tiers the owner defined (HOS-278 D4). The tier is what
 * separates the two paid partner plans: gold gets its own public page, silver
 * gets carousel presence only.
 *
 * `BRONZE` was removed by HOS-294. It predated the commercial model, had no
 * plan and no price in `ALL_PARTNER_PLANS`, and every tier comparison in the
 * codebase had to keep answering a question the product no longer asks. Live
 * rows were moved to `silver` by data-migration `0047-hos-294-retire-bronze-tier`
 * — the tier that grants LESS, so nobody was handed a public page they never
 * paid for.
 *
 * NOTE: this no longer mirrors `SponsorshipTierEnum`, which keeps its own three
 * values. The two were never the same vocabulary; they only looked alike.
 */
export enum PartnerTierEnum {
    /** Silver tier partner — carousel presence on the home page. */
    SILVER = 'silver',
    /** Gold tier partner — carousel presence plus its own `/partners/<slug>/` page. */
    GOLD = 'gold'
}
