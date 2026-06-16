import { z } from 'zod';
import { CommerceLeadSchema, CommerceLeadStatusEnum } from './commerce-lead.schema.js';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Input schema for submitting a new commerce lead (public "Sumar mi negocio" form).
 *
 * Excludes system-managed fields: id, status, handledAt, handledById, adminNote,
 * and all audit fields.  Callers supply only the applicant-facing fields.
 */
export const CommerceLeadCreateInputSchema = CommerceLeadSchema.omit({
    id: true,
    status: true,
    handledAt: true,
    handledById: true,
    adminNote: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/** TypeScript type for {@link CommerceLeadCreateInputSchema}. */
export type CommerceLeadCreateInput = z.infer<typeof CommerceLeadCreateInputSchema>;

// ---------------------------------------------------------------------------
// Update (admin only — workflow transitions + annotation)
// ---------------------------------------------------------------------------

/**
 * Input schema for updating a commerce lead (admin workflow).
 *
 * Only the fields an admin can explicitly change are included:
 * - `status` — advance or retract the workflow state
 * - `handledAt` — timestamp the handling action
 * - `handledById` — record which admin acted
 * - `adminNote` — attach an internal note
 *
 * Applicant fields (businessName, email, etc.) are intentionally excluded —
 * the lead is an immutable record of the original submission.
 */
export const CommerceLeadAdminUpdateInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    status: CommerceLeadStatusEnum.optional(),
    handledAt: z.date().optional(),
    handledById: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).optional(),
    adminNote: z.string().max(1000, { message: 'zodError.commerceLead.adminNote.max' }).optional()
});

/** TypeScript type for {@link CommerceLeadAdminUpdateInputSchema}. */
export type CommerceLeadAdminUpdateInput = z.infer<typeof CommerceLeadAdminUpdateInputSchema>;

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Input schema for deleting a commerce lead (admin only).
 *
 * Soft-delete by default; `force: true` permanently removes the record.
 */
export const CommerceLeadDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    force: z.boolean().default(false)
});

/** TypeScript type for {@link CommerceLeadDeleteInputSchema}. */
export type CommerceLeadDeleteInput = z.infer<typeof CommerceLeadDeleteInputSchema>;
