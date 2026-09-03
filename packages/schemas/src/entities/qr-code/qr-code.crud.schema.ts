import { z } from 'zod';
import { BaseSearchSchema } from '../../common/base.schema.js';
import { QrCodeSourceEnum } from '../../enums/qr-code-source.enum.js';
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
 * The create shape before the cross-field invariant is attached.
 *
 * Kept separate and unexported because Zod 4 refuses `.omit()` on an object
 * that carries refinements, and `QrCodeUpdateInputSchema` below is built by
 * omitting `slug` from this shape. A partial PATCH could not evaluate the
 * source/entity invariant anyway — it may legitimately carry neither field —
 * so the update schema wanting the unrefined shape is correct, not a workaround.
 */
const QrCodeCreateInputBaseSchema = QrCodeSchema.omit({
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

/**
 * Schema for creating a QR code.
 *
 * `slug` is optional on the way in: when it is absent the service mints one with
 * `generateShortId`. Allowing an explicit value is what lets an operator reserve
 * a memorable code, and what lets a migration re-create a code that is already
 * printed on paper.
 */
export const QrCodeCreateInputSchema = QrCodeCreateInputBaseSchema
    /**
     * `source` and the entity reference must agree.
     *
     * A `GENERATED` code is owned by the entity it was derived from, so it has
     * to name that entity; a `MANUAL` code was typed in by an operator and
     * belongs to nobody, so it must not. Until this existed the JSDoc asserted
     * the rule and nothing applied it: `{source: MANUAL, entityId: <uuid>}`
     * parsed and saved happily.
     *
     * Both columns move together on purpose. A `GENERATED` code carrying only
     * `entityType` is not half-identified, it is unidentified — the composite
     * index on `(entity_type, entity_id)` is what answers "does this subject
     * already have a code?", and a null id leaves that question unanswerable
     * while looking answered.
     *
     * The DB-side twin is
     * `extras/039-hos981-qr-code-source-entity.constraints.sql`, which is what
     * holds for writers that never pass through this schema. This refine exists
     * so the admin panel gets a field-level validation error instead of a 500
     * carrying a constraint name.
     */
    .superRefine((data, ctx) => {
        const hasEntityType = data.entityType !== undefined && data.entityType !== null;
        const hasEntityId = data.entityId !== undefined && data.entityId !== null;

        if (data.source === QrCodeSourceEnum.GENERATED) {
            if (!hasEntityType) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'zodError.qrCode.entityRef.requiredForGenerated',
                    path: ['entityType']
                });
            }
            if (!hasEntityId) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'zodError.qrCode.entityRef.requiredForGenerated',
                    path: ['entityId']
                });
            }
            return;
        }

        if (hasEntityType) {
            ctx.addIssue({
                code: 'custom',
                message: 'zodError.qrCode.entityRef.forbiddenForManual',
                path: ['entityType']
            });
        }
        if (hasEntityId) {
            ctx.addIssue({
                code: 'custom',
                message: 'zodError.qrCode.entityRef.forbiddenForManual',
                path: ['entityId']
            });
        }
    });

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
    .object(stripShapeDefaults(QrCodeCreateInputBaseSchema.omit({ slug: true }).shape))
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
