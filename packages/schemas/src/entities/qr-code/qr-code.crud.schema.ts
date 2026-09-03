import { z } from 'zod';
import { BaseSearchSchema } from '../../common/base.schema.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { QrCodeRenderOptionsSchema, QrCodeSchema, QrCodeSlugSchema } from './qr-code.schema.js';

/**
 * QrCode CRUD Schemas (HOS-981)
 *
 * Create / update / search inputs consumed by `QrCodeService`.
 */

// ============================================================================
// CREATE
// ============================================================================

/**
 * Schema for creating a QR code.
 *
 * `slug` is optional on the way in: when it is absent the service mints one with
 * `generateShortId`. Allowing an explicit value is what lets an operator reserve
 * a memorable code, and what lets a migration re-create a code that is already
 * printed on paper.
 */
export const QrCodeCreateInputSchema = QrCodeSchema.omit({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    renderOptions: true
})
    .extend({
        slug: QrCodeSlugSchema.optional(),
        /** Absent means "all defaults" — every field of the object has one. */
        renderOptions: QrCodeRenderOptionsSchema.optional()
    })
    .strict();

export type QrCodeCreateInput = z.infer<typeof QrCodeCreateInputSchema>;

export const QrCodeCreateOutputSchema = z.object({
    item: QrCodeSchema
});

export type QrCodeCreateOutput = z.infer<typeof QrCodeCreateOutputSchema>;

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Schema for updating a QR code.
 *
 * `slug` is NOT updatable, and that is the load-bearing constraint of the whole
 * feature: the slug is the part that is already printed on a sticker somewhere.
 * `targetUrl` is exactly what an update is for.
 */
export const QrCodeUpdateInputSchema = z
    .object(stripShapeDefaults(QrCodeCreateInputSchema.omit({ slug: true }).shape))
    .partial()
    .strict();

export type QrCodeUpdateInput = z.infer<typeof QrCodeUpdateInputSchema>;

export const QrCodeUpdateOutputSchema = z.object({
    item: QrCodeSchema
});

export type QrCodeUpdateOutput = z.infer<typeof QrCodeUpdateOutputSchema>;

// ============================================================================
// SEARCH
// ============================================================================

export const QrCodeSearchInputSchema = BaseSearchSchema.extend({
    source: QrCodeSourceEnumSchema.optional(),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
    isActive: z.boolean().optional()
}).strict();

export type QrCodeSearchInput = z.infer<typeof QrCodeSearchInputSchema>;

export const QrCodeListOutputSchema = z.object({
    items: z.array(QrCodeSchema),
    total: z.number().int().nonnegative()
});

export type QrCodeListOutput = z.infer<typeof QrCodeListOutputSchema>;
