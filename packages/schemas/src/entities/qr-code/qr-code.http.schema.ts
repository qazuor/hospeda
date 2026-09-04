import { z } from 'zod';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { QrCodeFormatEnumSchema } from '../../enums/qr-code-format.schema.js';
import { QrCodePurposeEnumSchema } from '../../enums/qr-code-purpose.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import {
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
                entityId: true
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
 */
export const QrCodeRenderQuerySchema = QrCodeRenderOptionsSchema.partial();

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
