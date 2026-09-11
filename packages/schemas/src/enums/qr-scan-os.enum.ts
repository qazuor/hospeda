/**
 * Which operating system scanned a printed QR code (HOS-1141).
 *
 * Derived from the `User-Agent` header by `deriveQrScanOs`
 * (`apps/api/src/utils/qr-scan-context.ts`).
 *
 * ## Three values, and why `OTHER` is one of them while "unknown" is not
 *
 * The owner asked for "iOS / Android / otro", and that third bucket is a real
 * observation rather than a gap: it means a User-Agent WAS presented and it
 * named neither platform (a desktop browser, a crawler, a scanner app with its
 * own string). "No User-Agent at all, or one nothing could be read out of" is a
 * different fact and is stored as `NULL` on the column.
 *
 * Keeping those two apart is what lets the metrics panel (HOS-1044) distinguish
 * "the long tail of other platforms" from "how often we learn nothing" — and it
 * is the only way to notice a derivation that has quietly stopped working,
 * which as an `OTHER` bucket would look like a perfectly plausible long tail.
 *
 * ## Only two platforms are named
 *
 * Because only two of them answer a product question. A printed code is scanned
 * with a phone camera, and iOS versus Android is the split that decides which
 * app-store link, which wallet pass and which scanning quirks matter. Splitting
 * `OTHER` into Windows/macOS/Linux would add columns to a chart nobody would act
 * on. `ALTER TYPE ... ADD VALUE` is available the day that changes.
 */
export enum QrScanOsEnum {
    /** iPhone, iPad or iPod. */
    IOS = 'IOS',
    /** Any Android device. */
    ANDROID = 'ANDROID',
    /** A User-Agent was presented and named neither of the above. */
    OTHER = 'OTHER'
}
