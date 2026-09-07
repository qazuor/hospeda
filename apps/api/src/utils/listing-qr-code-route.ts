/**
 * What the three listing-QR routes answer with, and how often (HOS-982 PR 2).
 *
 * The three verticals return the SAME shape from the SAME code family, so the
 * schema and the rate budget live once rather than three times. What stays in
 * each route file is everything that differs: the service, the staff permission,
 * and the `EntityTypeEnum` / `QrCodePurposeEnum` pair — see
 * `services/listing-qr-sheet/listing-qr-code.ts` for why those literals are
 * deliberately not hoisted.
 *
 * @module utils/listing-qr-code-route
 */

import { z } from 'zod';

/**
 * Response of `GET /protected/<vertical>/{id}/qr`.
 *
 * Three fields, and the two that are missing are missing on purpose:
 *
 * - `svg` — the symbol, rendered from `url`. The panel inlines it as a
 *   `data:image/svg+xml` image, which is what the web app's CSP permits.
 * - `url` — what the symbol actually encodes: the platform's own
 *   `{site}/qr/{qrSlug}/` redirect, never the final destination (HOS-981). It is
 *   the honest field to show an owner who wants to check the code by eye.
 * - `slug` — the LISTING's slug, for the panel's filenames and copy.
 *
 * There is no `targetUrl`: this route resolves the code through
 * `resolveEntityQrScanUrl`, which hands back the scan URL and not the row, so
 * the stored destination is not in hand. Recomputing it here would produce a
 * field that is right until an operator repoints the row and silently wrong
 * afterwards, and `menuQr.ts` can offer it only because it walks the service
 * directly. There is no `qrSlug` either — it is the last path segment of `url`,
 * and a second spelling of one value is a second thing that can disagree.
 */
export const ListingQrCodeResponseSchema = z.object({
    svg: z.string(),
    url: z.string().url(),
    slug: z.string()
});

/**
 * Rate budget for the three listing-QR routes.
 *
 * ## What this actually limits — read before tuning it
 *
 * `createPerRouteRateLimitMiddleware` builds its key as
 * `route:{METHOD}:{path}:{ip}` (`middlewares/rate-limit.ts`), where `path` is
 * `c.req.path` — the CONCRETE path, with the listing id already in it. So the
 * bucket is **per listing per IP**, not per user and not per route family: an
 * owner with twenty listings gets twenty independent buckets of 60/min, and two
 * owners behind one NAT share each of theirs.
 *
 * That is worth spelling out because the obvious reading of "60/min on a route
 * an index calls once per card" is that a big enough index exhausts it. It
 * cannot — not here and not on the sheet's 20 either. The number therefore
 * bounds repeated requests for ONE listing (a reload loop, a hot component, a
 * script), which is the thing worth bounding, since the first call MINTS a row.
 *
 * Higher than the sheet's 20 all the same, and the difference is the access
 * pattern: a sheet is one deliberate download, while this is read automatically
 * whenever the owner's card comes into view, so a few reloads of the same page
 * are ordinary rather than suspicious.
 */
export const LISTING_QR_CODE_RATE_LIMIT = { requests: 60, windowMs: 60_000 } as const;
