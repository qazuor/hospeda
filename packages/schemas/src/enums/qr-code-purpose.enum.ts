/**
 * QR Code Purpose Enum (HOS-981 PR 4)
 *
 * WHICH code this is, for a subject that has more than one.
 *
 * ## Why an entity needs more than one code
 *
 * `entityType` + `entityId` name the SUBJECT a code was derived from, and that
 * was assumed to identify a code until it did not. A restaurant carries two
 * physical codes that coexist: one on the door that opens its public listing,
 * and one on the table that opens the menu. An experience carries its listing
 * code and the one printed on its certificate — and those two resolve to the
 * SAME destination today (`certificate-render.ts` draws `content.publicUrl`,
 * built by `buildExperiencePublicUrl`), so nothing about the target tells them
 * apart either. What distinguishes them is where they are printed, and knowing
 * which one brings people in is the product.
 *
 * So `purpose` is the third part of the identity, not a label: the uniqueness
 * rule is `(entity_type, entity_id, purpose)`, and two codes on one subject are
 * not duplicates when their purposes differ.
 *
 * ## Why an enum and not a `varchar`
 *
 * The same argument the `entityType` column already carries, and it binds
 * harder here because `purpose` is now part of the LOOKUP KEY. A generator that
 * writes `'menu'` while a consumer looks up `'MENU'` finds nothing, mints a
 * second slug for a subject that already had one, and — since a slug is UNIQUE
 * forever and by then printed — leaves two live codes whose destinations are
 * free to diverge with nothing to notice it.
 *
 * ## Why all five values ship at once
 *
 * `HOST_TRADE_USAGE` is the only value this PR writes. `CERTIFICATE` and
 * `BROCHURE` are already printed into production PDFs today and HOS-1129
 * migrates them onto this table; `LISTING` (HOS-982) and `MENU` (HOS-1044) have
 * issues with owners assigned. Adding a value to a PG enum later is a migration
 * over a table that by then holds rows — four migrations avoided by a
 * declaration that builds nothing.
 */
export enum QrCodePurposeEnum {
    /** The provider's usage-registration sticker (HOS-376 §6.2a). */
    HOST_TRADE_USAGE = 'HOST_TRADE_USAGE',
    /** The entity's public listing page — all three commerce verticals (HOS-982). */
    LISTING = 'LISTING',
    /** A gastronomy listing's menu, printed on the table (HOS-1044). */
    MENU = 'MENU',
    /** The code printed on an experience's certificate (already live; HOS-1129). */
    CERTIFICATE = 'CERTIFICATE',
    /** The code printed on a commerce brochure (already live; HOS-1129). */
    BROCHURE = 'BROCHURE'
}
