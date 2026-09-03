import { z } from 'zod';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { QrCodeRenderOptionsSchema, QrCodeSchema, QrCodeSlugSchema } from './qr-code.schema.js';

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

/** `slug` is absent by construction: a printed code cannot be renamed. */
export const QrCodeUpdateHttpSchema = z
    .object(stripShapeDefaults(QrCodeCreateHttpSchema.omit({ slug: true }).shape))
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
