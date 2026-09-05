import { z } from 'zod';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { QrCodeFormatEnumSchema } from '../../enums/qr-code-format.schema.js';
import { QrCodePurposeEnumSchema } from '../../enums/qr-code-purpose.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import {
    QrCodeRenderOptionsOverrideSchema,
    QrCodeRenderOptionsPatchSchema,
    QrCodeRenderOptionsSchema,
    QrCodeSchema,
    QrCodeSlugSchema
} from './qr-code.schema.js';

/**
 * QrCode HTTP schemas (HOS-981).
 *
 * The admin surface that consumes most of these arrives with the admin panel
 * (PR 3); they are declared here so the entity ships complete and the routes
 * that follow have nothing left to invent.
 */

// ============================================================================
// ADMIN
// ============================================================================

export const QrCodeAdminSchema = QrCodeSchema;

export type QrCodeAdmin = z.infer<typeof QrCodeAdminSchema>;

export const QrCodeAdminResponseSchema = z.object({
    qrCode: QrCodeAdminSchema
});

export type QrCodeAdminResponse = z.infer<typeof QrCodeAdminResponseSchema>;

export const QrCodeAdminListResponseSchema = z.object({
    items: z.array(QrCodeAdminSchema),
    total: z.number().int().nonnegative()
});

export type QrCodeAdminListResponse = z.infer<typeof QrCodeAdminListResponseSchema>;

export const QrCodeCreateHttpSchema = z
    .object({
        slug: QrCodeSlugSchema.optional(),
        targetUrl: z.string().url(),
        label: z.string().min(1),
        description: z.string().nullable().optional(),
        source: QrCodeSourceEnumSchema,
        entityType: EntityTypeEnumSchema.nullable().optional(),
        entityId: z.string().uuid().nullable().optional(),
        /**
         * Settable on creation, immutable afterwards — the same treatment
         * `slug` gets, for a related reason: it is part of the
         * `(entityType, entityId, purpose)` uniqueness key. Accepting it here
         * is what lets an operator re-create a code that is ALREADY printed (a
         * certificate, a brochure) carrying the purpose it really has, rather
         * than a null that would sit outside the constraint.
         */
        purpose: QrCodePurposeEnumSchema.nullable().optional(),
        renderOptions: QrCodeRenderOptionsSchema.optional(),
        /**
         * A real boolean, NOT `z.coerce.boolean()`: coercion reads the string
         * `'false'` as `true`, so a form-encoded body would silently create a
         * code marked live that the operator asked to be retired. Rejecting the
         * string outright fails closed instead of inverting the value.
         *
         * The `.default()` stays the OUTERMOST wrapper on purpose — a
         * `z.preprocess()` around it would hide it from `stripShapeDefaults`
         * (which traverses only `ZodDefault`/`ZodOptional`/`ZodNullable`), and
         * the update schema below would then let an empty PATCH revive a
         * retired code.
         */
        isActive: z.boolean().default(true)
    })
    .strict();

export type QrCodeCreateHttp = z.infer<typeof QrCodeCreateHttpSchema>;

/**
 * `slug` is absent by construction: a printed code cannot be renamed.
 *
 * `purpose`, `entityType` and `entityId` are absent TOGETHER, because they are
 * one uniqueness key and freezing a third of it protects nothing (HOS-981
 * PR 4). `PATCH {entityId: <provider B>}` on provider A's code would re-point
 * the row at B while A's sticker is already on a van: A's panel mints a fresh
 * code, and the printed one starts sending A's customers to B's page with B
 * collecting the scans. See `QrCodeUpdateInputSchema` for the full argument.
 *
 * `source` is absent too. It records how the row came into existence rather
 * than how it is configured, and with the entity reference frozen every flip of
 * it now contradicts `extras/039` — so accepting it could only ever turn a
 * nonsense request into a 500 carrying a constraint name. Converting a code
 * between MANUAL and GENERATED is retire-and-reissue, not an edit.
 *
 * `renderOptions` is re-declared for the same reason the domain update schema
 * does it — see the long note on `QrCodeUpdateInputSchema`. In short:
 * `stripShapeDefaults` strips TOP-LEVEL defaults only, so without this line a
 * `PATCH {renderOptions: {margin: 8}}` reaches the service carrying five
 * defaulted siblings and silently repaints a red code black.
 */
export const QrCodeUpdateHttpSchema = z
    .object({
        ...stripShapeDefaults(
            QrCodeCreateHttpSchema.omit({
                slug: true,
                purpose: true,
                entityType: true,
                entityId: true,
                source: true
            }).shape
        ),
        renderOptions: QrCodeRenderOptionsPatchSchema
    })
    .partial()
    .strict();

export type QrCodeUpdateHttp = z.infer<typeof QrCodeUpdateHttpSchema>;

export const QrCodeDeleteResponseSchema = z.object({
    success: z.boolean()
});

export type QrCodeDeleteResponse = z.infer<typeof QrCodeDeleteResponseSchema>;

// ============================================================================
// PUBLIC RESOLUTION (consumed by the redirect route, PR 2)
// ============================================================================

/**
 * What the public redirect needs to know about a slug, and nothing more.
 *
 * Notably absent: `label`, `description`, `createdById` and every audit column.
 * A redirect answers with a `Location` header, so anything else in this shape
 * would be data leaking through an endpoint that requires no authentication.
 */
export const QrCodeResolutionSchema = z.object({
    id: z.string().uuid(),
    slug: QrCodeSlugSchema,
    targetUrl: z.string().url()
});

export type QrCodeResolution = z.infer<typeof QrCodeResolutionSchema>;

// ============================================================================
// RENDER
// ============================================================================

/**
 * Query parameters accepted by a render endpoint, overriding the code's stored
 * `renderOptions` for one request. All optional: omitting everything renders the
 * code exactly as it is configured.
 *
 * It IS {@link QrCodeRenderOptionsOverrideSchema}. Two corrections landed here
 * in HOS-981 PR 5, and the second undid an overreach in the first:
 *
 * 1. It used to read `QrCodeRenderOptionsSchema.partial()`, which Zod 4 refuses
 *    outright — `.partial() cannot be used on object schemas containing
 *    refinements`, thrown at module load — the moment the centre-logo gate was
 *    attached. It also needs the defaults stripped for the same reason the patch
 *    does: a `?margin=8` that silently carried six more "overrides" would
 *    repaint the code.
 * 2. It was then pointed at the PATCH schema, which dragged the pairing rule
 *    along — and that rule is bought by a fact an override does not have: a
 *    patch is MERGED into the stored document, an override is discarded after
 *    one response. `?errorCorrectionLevel=L` on a code stored without a mark is
 *    harmless and was answering 400. See the override schema's own note for
 *    what the split leaves to the caller.
 */
export const QrCodeRenderQuerySchema = QrCodeRenderOptionsOverrideSchema;

export type QrCodeRenderQuery = z.infer<typeof QrCodeRenderQuerySchema>;

/**
 * Query accepted by the admin download endpoint (HOS-981 PR 3).
 *
 * Only `format` — everything else is read from the code's stored
 * `renderOptions`, which is the thing the panel edits. A download that could
 * silently differ from the configured code in colour, size or error correction
 * would defeat the point of storing those options at all: the operator would be
 * printing something the panel never showed them.
 *
 * Declared separately from {@link QrCodeRenderQuerySchema} rather than reusing
 * it because that one's numeric fields (`margin`, `size`) are plain `z.number()`
 * and a query string is text — `?margin=8` would be refused, not coerced.
 */
export const QrCodeDownloadQuerySchema = z
    .object({
        format: QrCodeFormatEnumSchema.optional()
    })
    .strict();

export type QrCodeDownloadQuery = z.infer<typeof QrCodeDownloadQuerySchema>;

/**
 * What the admin download endpoint answers with.
 *
 * The image travels as JSON rather than as an `image/svg+xml` body because the
 * endpoint is AUTHENTICATED and the panel is a different origin: an
 * `<img src=".../download">` sends no credentials, so a raw image response would
 * render broken for every operator. A `data:` URL fetched by the app's own API
 * client carries the session. Secondarily, the panel shows a preview NEXT TO a
 * download button, so one response serves both instead of fetching the same
 * bytes twice.
 *
 * Not an injection argument: every `renderOptions` field is bounded by a regex,
 * an enum or an integer range, and the only string encoded into the symbol is
 * `/qr/{slug}/` over the QR alphabet. No operator text reaches the markup.
 *
 * `dataUrl` is what a download link's `href` gets; `svg` carries the raw markup
 * for inline preview and is `null` for a raster format.
 */
export const QrCodeDownloadResponseSchema = z.object({
    /** The format actually rendered — the query override, or the stored one. */
    format: QrCodeFormatEnumSchema,
    /** Suggested file name, slug-derived, extension matching `format`. */
    filename: z.string().min(1),
    /** The URL the symbol encodes: the platform's own `/qr/{slug}/` indirection. */
    scanUrl: z.string().url(),
    /** Ready-to-embed `data:` URL — an `<img src>` and a download `href` both. */
    dataUrl: z.string().min(1),
    /** Raw SVG markup for inline rendering; `null` when the format is raster. */
    svg: z.string().nullable()
});

export type QrCodeDownloadResponse = z.infer<typeof QrCodeDownloadResponseSchema>;

// ============================================================================
// SCAN AGGREGATE (HOS-1044 §6.4)
// ============================================================================

/**
 * Rolling window accepted by the scan-aggregate read.
 *
 * Deliberately the same two values `hostAnalyticsApi`/`commerceAnalyticsApi`
 * already expose for view stats (`apps/web/.../endpoints-protected.ts`,
 * `AnalyticsWindow`), per HOS-1044 §11 OQ-1 — a third window here would be a
 * UI convention this panel invented alone. Declared as its own schema rather
 * than importing `EntityViewWindowSchema` because that one's Zod error message
 * (`zodError.entityView.window.invalid`) belongs to a different domain; the
 * VALUE SET is what is mirrored, not the schema object.
 */
export const QrCodeScanWindowSchema = z.enum(['7d', '30d'], {
    message: 'zodError.qrCode.scan.window.invalid'
});

export type QrCodeScanWindow = z.infer<typeof QrCodeScanWindowSchema>;

/** One day of the gap-filled daily series. */
export const QrCodeScanDailySeriesItemSchema = z.object({
    /** Calendar date in `YYYY-MM-DD`, UTC. */
    date: z.string(),
    total: z.number().int().nonnegative()
});

export type QrCodeScanDailySeriesItem = z.infer<typeof QrCodeScanDailySeriesItemSchema>;

/**
 * A breakdown keyed by an observed value, plus the `'unknown'` bucket.
 *
 * `qr_code_scans.deviceType` / `.os` / `.browserLanguage` are all nullable —
 * the redirect records a scan best-effort, so a missing derivation is the
 * NORMAL case, not an exception (HOS-1044 §6.4). A row whose column is `NULL`
 * is grouped under the literal key `'unknown'` rather than dropped, so the
 * total of every breakdown's values always equals `total`.
 */
export const QrCodeScanBreakdownSchema = z.record(z.string(), z.number().int().nonnegative());

export type QrCodeScanBreakdown = z.infer<typeof QrCodeScanBreakdownSchema>;

/**
 * Aggregate read of `qr_code_scans` for ONE `qrCodeId` over a rolling window
 * (HOS-1044 §6.4). Generic by code id — not gastronomy-specific — so the same
 * shape serves the ficha QR (HOS-982) and any future `purpose` (§11 OQ-4).
 *
 * Counting is by `qrCodeId`, never by the entity behind it: a code can be
 * repointed at a new target (a slug rename) and the scan history must survive
 * that, which counting by entity would not.
 */
export const QrCodeScanStatsSchema = z.object({
    window: QrCodeScanWindowSchema,
    total: z.number().int().nonnegative(),
    /** Exactly `windowDays` entries, oldest first, gap-filled with `total: 0`. */
    dailySeries: z.array(QrCodeScanDailySeriesItemSchema),
    byDeviceType: QrCodeScanBreakdownSchema,
    byOs: QrCodeScanBreakdownSchema,
    byBrowserLanguage: QrCodeScanBreakdownSchema
});

export type QrCodeScanStats = z.infer<typeof QrCodeScanStatsSchema>;
