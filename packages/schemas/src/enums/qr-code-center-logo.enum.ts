/**
 * QR Code Centre Logo Enum (HOS-981 PR 5)
 *
 * WHICH mark, if any, is painted over the middle of a symbol.
 *
 * ## Why an enum and not a boolean
 *
 * The value lands in `qr_codes.render_options`, a `jsonb` document that is
 * written once and read for as long as the code is on paper. A boolean
 * `centerLogo: true` answers "is there a mark" and nothing else, so the day a
 * second mark exists — a co-branded partner plate, a seasonal variant — it has
 * to be joined by a `centerLogoVariant` sibling, and the pair immediately
 * admits `{centerLogo: false, centerLogoVariant: 'PARTNER'}`: a stored,
 * permanent, meaningless document that every reader has to decide how to
 * interpret. One field whose values are the alternatives cannot be put into
 * that state.
 *
 * `NONE` is spelled out rather than left to `null`/absence for the same reason
 * every other render option carries an explicit default: an empty `{}` must
 * parse into a complete, fully-specified drawing configuration.
 *
 * ## The mark is the platform's, and only the platform's
 *
 * There is deliberately no member that means "the entity's own logo", and no
 * URL or upload anywhere near this field. A per-entity mark would mean
 * accepting, storing, validating and re-serving somebody else's image into the
 * middle of a symbol we guarantee is scannable — a whole feature, with a whole
 * attack surface, hiding inside a render option. See `QrCodeRenderOptions`.
 */
export enum QrCodeCenterLogoEnum {
    /** No mark. The symbol is drawn exactly as it always was. */
    NONE = 'NONE',
    /** The Hospeda mark, served from this repo. */
    HOSPEDA = 'HOSPEDA'
}
