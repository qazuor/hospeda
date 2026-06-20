import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { UserIdSchema } from '../../common/id.schema.js';
import { DestinationIdSchema } from '../../common/id.schema.js';

// ---------------------------------------------------------------------------
// Commerce Lead Schema
// ---------------------------------------------------------------------------

/**
 * Status enum for a commerce lead / pre-onboarding application.
 * Mirrors the workflow: submitted → reviewed → approved (onboarding begins)
 * or rejected (admin closes the lead).
 */
export const CommerceLeadStatusEnum = z.enum(['pending', 'reviewing', 'approved', 'rejected'], {
    message: 'zodError.commerceLead.status.invalid'
});
export type CommerceLeadStatus = z.infer<typeof CommerceLeadStatusEnum>;

/**
 * Commerce Lead Schema.
 *
 * A pre-onboarding lead submitted by a prospective commerce owner (or by an admin
 * on their behalf).  The lead collects the minimum data needed to evaluate and
 * approve the business for listing on the platform.
 *
 * Fields mirror those collected by the public "Sumar mi negocio" contact form:
 * business name, contact details, destination city, and a free-text message.
 * Once approved, an admin links the lead to the new {@link Gastronomy} record by
 * recording `handledAt` / `handledById`.
 *
 * @example
 * ```ts
 * const lead = CommerceLeadSchema.parse({
 *   id: 'some-uuid',
 *   domain: 'gastronomy',
 *   businessName: 'La Parrilla de Juan',
 *   contactName: 'Juan Pérez',
 *   email: 'juan@example.com',
 *   phone: '+54911234567',
 *   destinationId: 'dest-uuid',
 *   message: 'Quiero listar mi parrilla...',
 *   status: 'pending',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   createdById: null,
 *   updatedById: null,
 * });
 * ```
 */
export const CommerceLeadSchema = z.object({
    /** Lead entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /**
     * Commerce domain this lead is applying for.
     * Currently only `gastronomy` is supported; the field is typed as an
     * open string to allow future commerce verticals without a schema migration.
     */
    domain: z
        .string()
        .min(1, { message: 'zodError.commerceLead.domain.required' })
        .max(50, { message: 'zodError.commerceLead.domain.max' }),

    /**
     * Name of the business as it should appear on the platform.
     */
    businessName: z
        .string()
        .min(2, { message: 'zodError.commerceLead.businessName.min' })
        .max(255, { message: 'zodError.commerceLead.businessName.max' }),

    /**
     * Name of the person to contact about this lead.
     */
    contactName: z
        .string()
        .min(2, { message: 'zodError.commerceLead.contactName.min' })
        .max(255, { message: 'zodError.commerceLead.contactName.max' }),

    /**
     * Contact email address for the lead applicant.
     */
    email: z
        .string()
        .email({ message: 'zodError.commerceLead.email.invalid' })
        .max(320, { message: 'zodError.commerceLead.email.max' }),

    /**
     * Contact phone number (optional; free-form to allow regional formats).
     */
    phone: z.string().max(50, { message: 'zodError.commerceLead.phone.max' }).nullish(),

    /**
     * The destination where the commerce is located.
     * Optional: the applicant may not know the exact destination ID from the public form.
     */
    destinationId: DestinationIdSchema.nullish(),

    /**
     * Free-text message from the applicant describing their business or any
     * additional context the admin should know.
     */
    message: z
        .string()
        .min(10, { message: 'zodError.commerceLead.message.min' })
        .max(2000, { message: 'zodError.commerceLead.message.max' })
        .nullish(),

    /**
     * Current workflow status of the lead.
     * Defaults to `pending` on submission.
     */
    status: CommerceLeadStatusEnum.default('pending'),

    /**
     * Timestamp when an admin handled (approved or rejected) this lead.
     * Null until the lead is acted upon.
     */
    handledAt: z.date().nullish(),

    /**
     * ID of the admin user who handled this lead.
     * Null until the lead is acted upon.
     */
    handledById: UserIdSchema.nullish(),

    /**
     * Optional admin note attached when the lead is reviewed.
     */
    adminNote: z.string().max(1000, { message: 'zodError.commerceLead.adminNote.max' }).nullish(),

    /**
     * ID of the COMMERCE_OWNER user provisioned from this lead (SPEC-249 Part D).
     * Set once the "approve & provision" action creates the owner account; acts
     * as the idempotency guard so re-approving never double-provisions. Null
     * until the lead has been provisioned.
     */
    provisionedUserId: UserIdSchema.nullish(),

    // Audit fields (createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById)
    ...BaseAuditFields,

    // The `commerce_leads` table intentionally omits the per-user / soft-delete audit
    // columns (no `created_by_id` / `updated_by_id` / `deleted_at` / `deleted_by_id`):
    // leads are administrative records that are never user-owned. `BaseAuditFields`
    // declares createdById/updatedById as required-nullable, which would reject the
    // persisted row (the keys are simply absent) and 500 the admin list endpoint.
    // Relax them to nullish so the schema matches the real table shape.
    createdById: UserIdSchema.nullish(),
    updatedById: UserIdSchema.nullish()
});

/** TypeScript type inferred from {@link CommerceLeadSchema}. */
export type CommerceLead = z.infer<typeof CommerceLeadSchema>;
