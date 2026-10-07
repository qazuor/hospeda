/**
 * Vertical enum — the closed set of business verticals of the platform.
 *
 * This is the code-side mirror of the `vertical` table (HOS-1430, program
 * HOS-1352). It is deliberately a SEPARATE vocabulary from `ProductDomainEnum`:
 * that enum also carries `addon`, a billing mechanism that is not a vertical, and
 * it is left untouched until its own retirement.
 *
 * - accommodation: lodging listings.
 * - gastronomy: gastronomy listings.
 * - experience: experience listings.
 * - tourist: the consumer side. Owns no listings.
 * - partner: the partner directory.
 *
 * Adding a member means adding the same row to the `vertical` table in a
 * structural migration; the migration test fails until both sides agree.
 */
export enum VerticalEnum {
    ACCOMMODATION = 'accommodation',
    GASTRONOMY = 'gastronomy',
    EXPERIENCE = 'experience',
    TOURIST = 'tourist',
    PARTNER = 'partner'
}
