/**
 * QR Code Error Correction Level Enum (HOS-981)
 *
 * The four levels the QR standard defines, ordered by how much of a damaged
 * symbol can still be recovered. More correction means more modules, which
 * means a denser (or physically larger) code — the trade is print area against
 * tolerance to scuffing, folding and bad light.
 */
export enum QrCodeErrorCorrectionLevelEnum {
    /** ~7% recoverable. Screen-only codes that never get printed. */
    L = 'L',
    /** ~15% recoverable. The sensible default for anything that goes on paper. */
    M = 'M',
    /** ~25% recoverable. Stickers on surfaces that get handled. */
    Q = 'Q',
    /** ~30% recoverable. Codes that carry a centre logo, or live outdoors. */
    H = 'H'
}
