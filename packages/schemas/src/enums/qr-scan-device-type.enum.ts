/**
 * What KIND of thing scanned a printed QR code (HOS-1141).
 *
 * Derived from the `User-Agent` header by `deriveQrScanDeviceType`
 * (`apps/api/src/utils/qr-scan-context.ts`) — never sent by a client, never
 * written by an operator. One function produces every value this column holds.
 *
 * ## There is no `UNKNOWN` member, on purpose
 *
 * "We could not tell" is `NULL` on the column, not a value in this enum, and
 * the distinction is the whole reason the derivation can be honest. A UA that
 * is absent, blank or unrecognisable yields `null`; a UA that positively names
 * a platform yields one of the three below. Folding the two together into an
 * `UNKNOWN` bucket would make "no data" and "data we read" indistinguishable in
 * a `GROUP BY`, which is exactly the question the future metrics panel
 * (HOS-1044) exists to answer.
 *
 * `DESKTOP` in particular is a POSITIVE match (`Windows NT`, `Macintosh`, `X11`,
 * `CrOS`), never a fallthrough. A garbage UA must not be counted as somebody at
 * a desk.
 *
 * ## An enum rather than a varchar
 *
 * The same argument `QrCodePurposeEnum` carries, one notch weaker: this value is
 * not a lookup key, so a drift between `'mobile'` and `'MOBILE'` costs a split
 * row in a chart rather than a duplicate printed sticker. It is still a closed
 * set written by exactly one function and read by a `GROUP BY`, and extending a
 * PostgreSQL enum is `ALTER TYPE ... ADD VALUE` — no table rewrite — so the
 * usual "an enum is expensive to grow" objection does not apply here.
 */
export enum QrScanDeviceTypeEnum {
    /** A phone. */
    MOBILE = 'MOBILE',
    /** A tablet. Separated from `MOBILE` because a menu read on a tablet is a
     * different situation from one read on a phone at a table. */
    TABLET = 'TABLET',
    /** A desktop or laptop browser — someone who typed the URL, or followed a
     * link, rather than pointing a camera at a sign. */
    DESKTOP = 'DESKTOP'
}
