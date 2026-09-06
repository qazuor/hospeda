/**
 * Where a click on a partner's carousel logo actually took the visitor (HOS-1063).
 *
 * `resolvePartnerLogoLink` (`apps/web/src/lib/partner-logo-link.ts`) resolves a
 * partner's logo to one of three outcomes: an internal link to the partner's own
 * page, an outbound link to their website, or no link at all. The first two are
 * the two values here; the third produces no click and therefore no row.
 *
 * ## Why the destination is stored even though both values count the same
 *
 * The commercial page promises "cuántos entraron desde tu logo" and draws no
 * distinction between the two, so the partner-facing number is the sum. The tag
 * is stored anyway because HOS-1159 is about to make a silver logo stop being
 * clickable, and a distinction that becomes necessary later cannot be
 * backfilled — the rows that would need it will already have been written. One
 * column now buys that option; a migration later does not buy back the history.
 *
 * Deliberately a CLOSED list rather than free text, for the same reason
 * {@link PartnerMentionChannelEnum} is: a counter grouped by a free-text column
 * is a counter that stops grouping the first time someone writes `own-page`.
 *
 * @module partner-logo-click-destination.enum
 */

/**
 * Every destination a partner logo click can be attributed to.
 *
 * @example
 * ```ts
 * import { PartnerLogoClickDestinationEnum } from '@repo/schemas';
 *
 * const destination = PartnerLogoClickDestinationEnum.OWN_PAGE;
 * ```
 */
export enum PartnerLogoClickDestinationEnum {
    /**
     * The visitor was taken to the partner's own Hospeda page at
     * `/{lang}/partners/<slug>/`. Only a gold partner with a slug resolves here.
     */
    OWN_PAGE = 'OWN_PAGE',

    /**
     * The visitor was taken off-site to the partner's own `websiteUrl`, via a
     * link carrying `rel="sponsored nofollow noopener"` and `target="_blank"`.
     */
    EXTERNAL = 'EXTERNAL'
}
