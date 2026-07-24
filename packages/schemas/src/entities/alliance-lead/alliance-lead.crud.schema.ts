import { z } from 'zod';
import { AllianceLeadSchema, AllianceLeadStatusEnum } from './alliance-lead.schema.js';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Input schema for submitting a new alliance lead (public "aliados" forms).
 *
 * Excludes system-managed fields: id, status, adminNote, and all audit fields.
 * Callers supply only the applicant-facing fields (`kind`, `contactName`,
 * `email`, `phone`, `message`).
 */
export const AllianceLeadCreateInputSchema = AllianceLeadSchema.omit({
    id: true,
    status: true,
    adminNote: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/** TypeScript type for {@link AllianceLeadCreateInputSchema}. */
export type AllianceLeadCreateInput = z.infer<typeof AllianceLeadCreateInputSchema>;

// ---------------------------------------------------------------------------
// Mark handled (admin only — approve/reject + note)
// ---------------------------------------------------------------------------

/**
 * Input schema for the admin "mark-handled" workflow action.
 *
 * An admin resolves a `pending`/`reviewing` lead by approving or rejecting it,
 * optionally attaching an internal note. Approving never auto-provisions any
 * role/entity (HOS-277 NG-1) — this schema only records the workflow decision.
 */
export const AllianceLeadMarkHandledSchema = z.object({
    /** Terminal status the admin is transitioning the lead to. */
    status: AllianceLeadStatusEnum.refine(
        (status) => status === 'approved' || status === 'rejected',
        {
            message: 'zodError.allianceLead.markHandled.status.invalid'
        }
    ),
    /** Optional internal note explaining the decision. */
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).optional()
});

/** TypeScript type for {@link AllianceLeadMarkHandledSchema}. */
export type AllianceLeadMarkHandled = z.infer<typeof AllianceLeadMarkHandledSchema>;

// ---------------------------------------------------------------------------
// Admin update (generic — status transitions + annotation)
// ---------------------------------------------------------------------------

/**
 * Input schema for updating an alliance lead (admin workflow).
 *
 * Only the fields an admin can explicitly change are included: `status` and
 * `adminNote`. Applicant fields (contactName, email, etc.) are intentionally
 * excluded — the lead is an immutable record of the original submission.
 */
export const AllianceLeadAdminUpdateInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    status: AllianceLeadStatusEnum.optional(),
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).optional()
});

/** TypeScript type for {@link AllianceLeadAdminUpdateInputSchema}. */
export type AllianceLeadAdminUpdateInput = z.infer<typeof AllianceLeadAdminUpdateInputSchema>;

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Input schema for deleting an alliance lead (admin only).
 *
 * Soft-delete by default; `force: true` permanently removes the record.
 */
export const AllianceLeadDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    force: z.boolean().default(false)
});

/** TypeScript type for {@link AllianceLeadDeleteInputSchema}. */
export type AllianceLeadDeleteInput = z.infer<typeof AllianceLeadDeleteInputSchema>;
