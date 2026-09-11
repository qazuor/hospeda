import { z } from 'zod';
import { BaseSearchSchema } from '../../common/base.schema.js';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { QrCodePurposeEnumSchema } from '../../enums/qr-code-purpose.schema.js';
import { QrCodeSourceEnum } from '../../enums/qr-code-source.enum.js';
import { QrCodeSourceEnumSchema } from '../../enums/qr-code-source.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import {
    QrCodeRenderOptionsPatchSchema,
    QrCodeRenderOptionsSchema,
    QrCodeSchema,
    QrCodeSlugSchema
} from './qr-code.schema.js';

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
 *
 * ## The whole uniqueness key is frozen, not a third of it (HOS-981 PR 4)
 *
 * `purpose`, `entityType` and `entityId` are ALL absent, and they have to move
 * together because they are one key: `(entityType, entityId, purpose)`. Moving
 * any single column makes the row invisible to the provisioner that owns it,
 * the next get-or-create finds nothing, mints a SECOND permanent slug for the
 * same subject, and leaves two live codes whose targets are free to diverge —
 * the failure the key exists to prevent, reintroduced through PATCH.
 *
 * Freezing only `purpose` (as this first did) left the worst version of that
 * reachable. `PATCH {entityId: <provider B>}` on provider A's GENERATED code
 * re-points the row at B while A's sticker is already on a van: A's panel mints
 * a fresh code, and the printed one now sends A's customers to B's page and
 * credits B with the scans. Nothing in the response says so.
 *
 * A second reason applies to `entityId` alone: moving it onto a subject that
 * already holds a live code for the same purpose raises a 23505 on an UPDATE,
 * and the recovery in `QrCodeService.getOrCreateForEntity` only wraps the
 * INSERT — so that path surfaces a raw constraint name as a 500.
 *
 * ## `source` is frozen too, and could not be anything else
 *
 * `source` records how the row came into existence — a historical fact, not a
 * setting. A MANUAL code an operator typed in did not later become GENERATED.
 *
 * It is also unchangeable in practice now that the entity reference is frozen,
 * which is what settles it. `extras/039` requires GENERATED to name an entity
 * and MANUAL not to; since a PATCH can no longer move `entityType`/`entityId`,
 * EVERY `source` flip lands on a row whose entity columns contradict the new
 * value. `PATCH {source:'MANUAL'}` on a generated code, and `{source:
 * 'GENERATED'}` on a manual one, both reach Postgres and come back as a 500
 * carrying a constraint name. Accepting the field converts a nonsense request
 * into a server error and buys nothing.
 *
 * A schema-level refine cannot rescue it either: the payload does not carry the
 * stored entity columns, so nothing in a `superRefine` can see what the new
 * `source` would contradict. (`.strict()` also runs BEFORE any refine, so once
 * `entityType`/`entityId` left the shape, a refine over the three fields
 * together became unreachable code.)
 *
 * ## Reassigning and converting are not edits
 *
 * Neither pointing a code at another entity nor converting it between MANUAL
 * and GENERATED is an edit, and for the same underlying reason: the old sticker
 * goes on existing whatever the row says. If either becomes a real requirement
 * it needs its own operation, with the retire-and-reissue semantics a printed
 * code demands.
 *
 * ## Why `renderOptions` is re-declared (HOS-981 PR 3)
 *
 * `stripShapeDefaults` removes TOP-LEVEL defaults only — by design, and it says
 * so. `renderOptions` is a nested object every one of whose fields carries a
 * default, so passing it through unchanged means `{renderOptions: {margin: 8}}`
 * PARSES INTO a fully-populated object: the five fields the caller never
 * mentioned arrive filled with the schema's defaults, indistinguishable from
 * fields the operator actually set. A bare `.partial()` does not fix that
 * either — in Zod 4 a `ZodDefault` still fires through an enclosing
 * `ZodOptional` — which is why {@link QrCodeRenderOptionsPatchSchema} strips the
 * defaults first.
 *
 * That is not a cosmetic difference. `render_options` is one `jsonb` column, so
 * whatever this schema produces is what gets written: a code stored with
 * `foregroundColor: '#ff0000'` that receives a margin-only PATCH would come back
 * black, with no error anywhere. The patch schema keeps the payload as small as
 * the caller wrote it, which is what lets `QrCodeModel.mergeableJsonbColumns`
 * merge it into the stored document instead of replacing it. Both halves are
 * required — a partial patch written with a plain `SET` still loses the
 * siblings, and a merge fed a defaults-completed object still overwrites them
 * with defaults.
 */
export const QrCodeUpdateInputSchema = z
    .object({
        ...stripShapeDefaults(
            QrCodeCreateInputBaseSchema.omit({
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
    entityType: EntityTypeEnumSchema.optional(),
    entityId: z.string().uuid().optional(),
    /**
     * Filterable because a subject can now hold several codes: without it,
     * "show me this restaurant's codes" answers with the door and the table
     * code and no way to say which row is which.
     */
    purpose: QrCodePurposeEnumSchema.optional(),
    isActive: z.boolean().optional()
}).strict();

export type QrCodeSearchInput = z.infer<typeof QrCodeSearchInputSchema>;

export const QrCodeListOutputSchema = z.object({
    items: z.array(QrCodeSchema),
    total: z.number().int().nonnegative()
});

export type QrCodeListOutput = z.infer<typeof QrCodeListOutputSchema>;
