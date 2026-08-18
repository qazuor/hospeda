import { z } from 'zod';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { ExperienceSchema } from './experience.schema.js';

/**
 * Experience CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for experience listings:
 * - Admin create (full identity control)
 * - Owner update (operational fields only — no identity manipulation)
 * - Patch / partial update (alias of admin update for clarity)
 * - Delete (soft by default, optional hard delete)
 * - Restore
 */

// ============================================================================
// CROSS-FIELD RULES
// ============================================================================

/**
 * `priceUnit` is REQUIRED unless the price is on request (H-156).
 *
 * `experiences.price_unit` became nullable so that an experience with no price
 * is not forced to declare the unit of a price that does not exist. But a
 * listing that DOES carry a price still needs to say how it is charged — "$8000"
 * with no unit is not publishable information. Nullability alone cannot express
 * that; it is a relationship between two fields, so it lives here.
 *
 * Applied to the CREATE schemas only. Update schemas are `.partial()`, where an
 * absent key means "no change" rather than "cleared", so the same rule there
 * would reject every partial edit that happens not to mention pricing.
 *
 * ## Why this is exported as a separate `*Checked` schema
 *
 * Zod 4 does NOT silently drop refinements when a schema is sliced — it THROWS
 * at runtime: `.pick() cannot be used on object schemas containing refinements`.
 * TypeScript does not catch it (`.superRefine()` returns `this`, so `.pick()`
 * still type-checks), so attaching this rule directly to
 * {@link ExperienceOwnerCreateInputSchema} compiles cleanly and then blows up on
 * module load in `CommerceCreateForm.client.tsx`, which picks a subset of it.
 *
 * So the plain create schemas stay slice-able and the rule lives in the
 * `*CheckedSchema` variants, which the API routes validate against. Do NOT move
 * the `superRefine` onto the plain schemas — verify with an actual `.pick()`
 * before assuming otherwise; the compiler will not tell you.
 *
 * @param value - The parsed create input.
 * @param ctx - Zod refinement context; the issue is attached to `priceUnit` so
 *   the form highlights the field the operator has to fill in.
 */
export function requirePriceUnitUnlessOnRequest(
    value: { readonly priceUnit?: string | null; readonly isPriceOnRequest?: boolean },
    ctx: z.RefinementCtx
): void {
    if (value.isPriceOnRequest === true) {
        return;
    }
    if (value.priceUnit === null || value.priceUnit === undefined) {
        ctx.addIssue({
            code: 'custom',
            path: ['priceUnit'],
            message: 'zodError.experience.priceUnit.requiredUnlessOnRequest'
        });
    }
}

// ============================================================================
// ADMIN CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new experience listing (admin path).
 *
 * Admins control identity fields (name, slug, type, priceFrom, priceUnit,
 * destinationId) and can optionally assign an owner on creation.
 *
 * ### Junction sync fields (write-only)
 *
 * - `amenityIds` — Optional list of amenity UUIDs to associate with the new
 *   listing. When provided, the service inserts rows in the junction table
 *   transactionally. Omitting is a no-op.
 * - `featureIds` — Same contract for the feature junction table.
 *
 * These are **write-only inputs** and do not appear in read responses.
 */
export const ExperienceAdminCreateInputSchema = ExperienceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    /** Optional slug override; auto-generated from name when absent. */
    slug: z
        .string()
        .min(2, { message: 'zodError.commerce.slug.min' })
        .max(100, { message: 'zodError.commerce.slug.max' })
        .optional(),
    /**
     * Owning user UUID. REQUIRED (H-88): `experiences.owner_id` is NOT NULL with
     * no default, so a create without it cannot produce a row — the insert fails
     * with a 23502 and the caller gets an opaque 500 "A database error occurred"
     * that names nothing. Declaring it required rejects the payload at the
     * boundary with a 400 that names the field instead.
     *
     * Deliberately NOT defaulted to the acting admin: the documented flow is
     * "admins create the listing and provision the owner", so the owner is a
     * real merchant account rather than whoever filled in the form. The owner
     * self-create route (`routes/commerce/protected/create.ts`) already supplies
     * `ownerId: actor.id` explicitly and is unaffected.
     */
    ownerId: UserIdSchema,
    /**
     * Destination UUID for the listing. REQUIRED for the same reason as
     * {@link ownerId} — `experiences.destination_id` is NOT NULL with no
     * default (H-88).
     */
    destinationId: DestinationIdSchema,
    /**
     * Optional list of amenity UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the experience row.
     * Undefined → no junction rows written.
     */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
        .optional(),
    /**
     * Optional list of feature UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the experience row.
     * Undefined → no junction rows written.
     */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
        .optional()
});

/**
 * {@link ExperienceAdminCreateInputSchema} plus the cross-field pricing rule
 * (see {@link requirePriceUnitUnlessOnRequest}). Routes validate against THIS
 * one; the plain schema above stays free of refinements so it remains
 * slice-able.
 */
export const ExperienceAdminCreateInputCheckedSchema = ExperienceAdminCreateInputSchema.superRefine(
    requirePriceUnitUnlessOnRequest
);

/** TypeScript type for {@link ExperienceAdminCreateInputSchema}. */
export type ExperienceAdminCreateInput = z.infer<typeof ExperienceAdminCreateInputSchema>;

/**
 * Schema for the admin create response.
 * Returns the complete experience object.
 */
export const ExperienceAdminCreateOutputSchema = ExperienceSchema;

/** TypeScript type for {@link ExperienceAdminCreateOutputSchema}. */
export type ExperienceAdminCreateOutput = z.infer<typeof ExperienceAdminCreateOutputSchema>;

// ============================================================================
// OWNER UPDATE SCHEMAS (operational only)
// ============================================================================

/**
 * Schema for owner-managed updates to an experience listing.
 *
 * **HOS-166 D-1 — SPEC-239 decision #5 is deliberately REVERSED here.** That
 * decision was coherent only under SPEC-239's decision #1 (admin creates every
 * listing) — once the admin's only action is approving a lead, somebody has to
 * type the identity in, and the only remaining candidate is the owner. So the
 * owner now loads their own identity: `name`, `description`, `destinationId`
 * are owner-editable, on top of the operational sections. Do NOT "restore" the
 * old admin-only identity-strip — that would silently re-weld the admin into
 * every listing's core content, which is the exact regression this reversal
 * exists to prevent. Mirrors {@link GastronomyOwnerUpdateInputSchema}.
 *
 * **`slug` stays out of this schema on purpose (HOS-166 OQ-3).** It is
 * owner-*visible* but not owner-*editable* post-create: it is derived
 * server-side from `name` at creation time and a public URL, so a free rename
 * vector would enable slug-squatting and break indexed links. Post-publish
 * renames are staff-only. Any `slug` key in an owner PATCH body is silently
 * stripped (Zod's default unknown-key behaviour).
 *
 * **Control fields stay admin-only (HOS-166 §6.2 / AC-19):** `lifecycleState`,
 * `visibility`, `moderationState`, `isFeatured`, `ownerId` are **intentionally
 * absent** from this schema — the reversal above is scoped to identity only.
 * Any of these keys in an owner PATCH body is silently stripped.
 *
 * Per SPEC-253 §3, the following fields are also owner-editable:
 * - `type`             — experience sub-category (SPEC-253 D1: YES; removed from
 *                        identity-strip guard, AC-5)
 * - `summary`          — short marketing summary
 * - `priceFrom`        — starting price in integer centavos (experience-only;
 *                        0 when `isPriceOnRequest` is true)
 * - `priceUnit`        — billing unit (per_day/per_hour/per_person/per_group)
 * - `nameI18n`         — localized name translations (SPEC-212 pattern)
 * - `summaryI18n`      — localized summary translations
 * - `descriptionI18n`  — localized description translations
 * - `richDescriptionI18n` — localized rich-text translations
 *
 * Previously-permitted operational sections (unchanged):
 * - `openingHours`    — schedule (gated by `COMMERCE_EDIT_OWN`)
 * - `contactInfo`     — contact details (gated by `COMMERCE_EDIT_OWN`)
 * - `socialNetworks`  — social links (gated by `COMMERCE_EDIT_OWN`)
 * - `media`           — featured image, gallery, videos (gated by `COMMERCE_EDIT_OWN`)
 * - `isPriceOnRequest`— price-on-request toggle (gated by `COMMERCE_EDIT_OWN`)
 * - `richDescription` — rich-text description (gated by `COMMERCE_EDIT_OWN`)
 * - `amenityIds`      — junction sync (gated by `COMMERCE_EDIT_OWN`)
 * - `featureIds`      — junction sync (gated by `COMMERCE_EDIT_OWN`)
 *
 * NOT permitted for owner (admin-only — control fields + immutable identity):
 * - `slug` (immutable post-create — HOS-166 OQ-3)
 * - `lifecycleState`, `visibility`, `moderationState`, `isFeatured`, `ownerId`
 *   (control fields — HOS-166 §6.2)
 * - `hasActiveSubscription` (subscription lifecycle, admin-only toggle)
 */
export const ExperienceOwnerUpdateInputSchema = z
    .object(
        stripShapeDefaults(
            ExperienceSchema.pick({
                // HOS-166 D-1: identity fields the owner now controls.
                name: true,
                description: true,
                destinationId: true,
                // Previously owner-editable (SPEC-253 §3 / operational sections).
                type: true,
                summary: true,
                openingHours: true,
                contactInfo: true,
                socialNetworks: true,
                // HOS-372: `media` is not writable — the `media` JSONB column was dropped.
                // Photos are written through the relational `experience_media` endpoints and
                // videos through this top-level column.
                videos: true,
                isPriceOnRequest: true,
                priceFrom: true,
                priceUnit: true,
                richDescription: true,
                nameI18n: true,
                summaryI18n: true,
                descriptionI18n: true,
                richDescriptionI18n: true
            }).shape
        )
    )
    .partial()
    .extend({
        /**
         * Optional amenity UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        amenityIds: z
            .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
            .optional()
    });

/** TypeScript type for {@link ExperienceOwnerUpdateInputSchema}. */
export type ExperienceOwnerUpdateInput = z.infer<typeof ExperienceOwnerUpdateInputSchema>;

// ============================================================================
// OWNER CREATE SCHEMA (HOS-166 §7.2)
// ============================================================================

/**
 * Schema for a `COMMERCE_OWNER` self-service listing create
 * (`POST /api/v1/protected/commerce/listings/:entityType`, HOS-166 §7.2).
 * Mirrors {@link GastronomyOwnerCreateInputSchema} — see that schema's JSDoc
 * for the full rationale on why each field is omitted.
 *
 * - `ownerId` — never accepted; the route forces `actor.id`.
 * - `slug` — never accepted; derived server-side from `name` (HOS-166 OQ-3).
 * - `lifecycleState`, `visibility`, `isFeatured`, `moderationState` — control
 *   fields; the route forces `visibility: PRIVATE` + `lifecycleState: DRAFT`.
 * - `hasActiveSubscription` — subscription-lifecycle only, never client input.
 * - `reviewsCount`, `averageRating`, `rating` — server-computed aggregates.
 *
 * `destinationId` stays `.optional()` (mirrors the admin create schema) —
 * publish-readiness is a separate gate (`resolveListingCompleteness`, §6.6).
 */
export const ExperienceOwnerCreateInputSchema = ExperienceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    // Server-forced — never accepted from the owner's request body.
    ownerId: true,
    slug: true,
    lifecycleState: true,
    visibility: true,
    isFeatured: true,
    moderationState: true,
    hasActiveSubscription: true,
    // Server-computed aggregates — nonsensical on create.
    reviewsCount: true,
    averageRating: true,
    rating: true
}).extend({
    /** Optional at create — publish-readiness is checked separately (§6.6). */
    destinationId: DestinationIdSchema.optional(),
    /**
     * Optional list of amenity UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the experience row.
     */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
        .optional(),
    /**
     * Optional list of feature UUIDs to associate on create (write-only).
     * Syncs the junction table transactionally alongside the experience row.
     */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
        .optional()
});

/**
 * {@link ExperienceOwnerCreateInputSchema} plus the cross-field pricing rule
 * (see {@link requirePriceUnitUnlessOnRequest}). The owner create route
 * validates against THIS one.
 *
 * The plain schema above must stay refinement-free: `CommerceCreateForm`
 * `.pick()`s a subset of it, and Zod 4 throws on `.pick()` over a refined
 * object schema.
 */
export const ExperienceOwnerCreateInputCheckedSchema = ExperienceOwnerCreateInputSchema.superRefine(
    requirePriceUnitUnlessOnRequest
);

/** TypeScript type for {@link ExperienceOwnerCreateInputSchema}. */
export type ExperienceOwnerCreateInput = z.infer<typeof ExperienceOwnerCreateInputSchema>;

// ============================================================================
// GENERAL UPDATE SCHEMAS (admin path)
// ============================================================================

/**
 * Schema for admin full / partial updates to an experience listing (PATCH).
 *
 * All entity fields are partial so the admin may update any subset.
 * Uses `stripShapeDefaults` (same as gastronomy) to prevent Zod 4's
 * `.partial()` from injecting defaults for absent keys.
 *
 * ### Why server-managed fields are explicitly omitted
 *
 * Even though `stripShapeDefaults` removes `.default()` wrappers, fields like
 * `ownerId`, `reviewsCount`, `averageRating`, and `hasActiveSubscription` must
 * never arrive at the service from a generic PATCH body:
 *
 * - `ownerId` — immutable after creation; ownership change requires a dedicated
 *   admin action, not a generic update payload.
 * - `reviewsCount` / `averageRating` — server-computed aggregates updated by
 *   the review subsystem, not by the admin CRUD path.
 * - `hasActiveSubscription` — driven by the subscription lifecycle hook; toggled
 *   via the dedicated `toggleSubscription` admin action, not a generic PATCH.
 */
export const ExperienceUpdateInputSchema = z
    .object(
        // Zod 4's `.partial()` does NOT strip `.default()` (unlike Zod 3): without
        // this, a PATCH like `{ lifecycleState: 'ACTIVE' }` would arrive at the
        // service carrying injected defaults, silently overwriting server state.
        // Stripping the top-level defaults restores correct "absent key = no change"
        // PATCH semantics. See `stripShapeDefaults`.
        stripShapeDefaults(
            ExperienceSchema.omit({
                id: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                updatedById: true,
                deletedAt: true,
                deletedById: true,
                // Server-managed: ownership change requires a dedicated admin action.
                ownerId: true,
                // Server-computed aggregates — updated by the review subsystem only.
                reviewsCount: true,
                averageRating: true,
                // Subscription lifecycle hook — use toggleSubscription route instead.
                hasActiveSubscription: true,
                // HOS-372: the `media` JSONB column was dropped. Photos live in
                // `experience_media` and are written through the relational media
                // endpoints; videos travel as the top-level `videos` column, which
                // stays writable here. `media` remains a RESPONSE field, composed
                // from the rows on the way out — it is only the write side that goes.
                media: true
            }).shape
        )
    )
    .partial()
    .extend({
        /**
         * Optional amenity UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        amenityIds: z
            .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
            .optional(),
        /**
         * Optional feature UUID list for junction sync on update (write-only).
         * undefined → no change | [] → clear all | [ids] → sync to exact set.
         */
        featureIds: z
            .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
            .optional()
    });

/** TypeScript type for {@link ExperienceUpdateInputSchema}. */
export type ExperienceUpdateInput = z.infer<typeof ExperienceUpdateInputSchema>;

/**
 * Alias of {@link ExperienceUpdateInputSchema} for explicit PATCH semantics.
 */
export const ExperiencePatchInputSchema = ExperienceUpdateInputSchema;

/** TypeScript type for {@link ExperiencePatchInputSchema}. */
export type ExperiencePatchInput = z.infer<typeof ExperiencePatchInputSchema>;

/**
 * Schema for experience update response.
 * Returns the complete updated experience object.
 */
export const ExperienceUpdateOutputSchema = ExperienceSchema;

/** TypeScript type for {@link ExperienceUpdateOutputSchema}. */
export type ExperienceUpdateOutput = z.infer<typeof ExperienceUpdateOutputSchema>;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for experience deletion input.
 * Requires ID and optional force flag for hard delete.
 */
export const ExperienceDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    // Use `.default(false)` only — `.optional().default(false)` is a dead chain:
    // `.default()` already supplies the value when the key is absent.
    force: z.boolean({ message: 'zodError.experience.delete.force.invalidType' }).default(false)
});

/** TypeScript type for {@link ExperienceDeleteInputSchema}. */
export type ExperienceDeleteInput = z.infer<typeof ExperienceDeleteInputSchema>;

/**
 * Schema for experience deletion response.
 * Returns success status and deletion timestamp.
 */
export const ExperienceDeleteOutputSchema = z.object({
    success: z.boolean({ message: 'zodError.experience.delete.success.required' }).default(true),
    deletedAt: z.date({ message: 'zodError.experience.delete.deletedAt.invalidType' }).optional()
});

/** TypeScript type for {@link ExperienceDeleteOutputSchema}. */
export type ExperienceDeleteOutput = z.infer<typeof ExperienceDeleteOutputSchema>;

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for experience restoration input.
 * Requires only the experience ID.
 */
export const ExperienceRestoreInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type for {@link ExperienceRestoreInputSchema}. */
export type ExperienceRestoreInput = z.infer<typeof ExperienceRestoreInputSchema>;

/**
 * Schema for experience restoration response.
 * Returns the complete restored experience object.
 */
export const ExperienceRestoreOutputSchema = ExperienceSchema;

/** TypeScript type for {@link ExperienceRestoreOutputSchema}. */
export type ExperienceRestoreOutput = z.infer<typeof ExperienceRestoreOutputSchema>;
