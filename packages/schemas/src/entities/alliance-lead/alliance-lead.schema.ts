import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';

// ---------------------------------------------------------------------------
// Alliance Lead Schema
// ---------------------------------------------------------------------------

/**
 * Kind of alliance a lead is applying for.
 *
 * Closed set (unlike commerce leads' open `domain` string): the four alliance
 * programs are fully known and acotados, so a Zod enum is used instead of an
 * open string field (HOS-277 §7.1).
 *
 * - `partner` — tourism agencies / commerce partnerships.
 * - `sponsor` — brand sponsorship program.
 * - `editor` — content editor / collaborator program.
 * - `service_provider` — a prospective HostTrade directory entry.
 */
export const AllianceLeadKindEnum = z.enum(['partner', 'sponsor', 'editor', 'service_provider'], {
    message: 'zodError.allianceLead.kind.invalid'
});
export type AllianceLeadKind = z.infer<typeof AllianceLeadKindEnum>;

/**
 * Status enum for an alliance lead.
 * Mirrors the same workflow vocabulary as `CommerceLeadStatusEnum`:
 * submitted → reviewed → approved (admin provisions manually) or rejected.
 */
export const AllianceLeadStatusEnum = z.enum(['pending', 'reviewing', 'approved', 'rejected'], {
    message: 'zodError.allianceLead.status.invalid'
});
export type AllianceLeadStatus = z.infer<typeof AllianceLeadStatusEnum>;

/**
 * Alliance Lead Schema.
 *
 * A qualified lead submitted through one of the four "aliados" landing pages
 * (`partner`, `sponsor`, `editor`, `service_provider`). Unlike `CommerceLeadSchema`,
 * this entity has no `businessName`/`destinationId` fields — kind-specific details
 * are serialized with labels into `message` by the submitting form (HOS-277 §7.3),
 * so the persisted contract stays generic across all four kinds.
 *
 * The admin evaluates the lead by hand and never auto-provisions any
 * role/entity on approval (HOS-277 NG-1) — `status` and `adminNote` are the
 * only fields an admin can change via the mark-handled action.
 *
 * @example
 * ```ts
 * const lead = AllianceLeadSchema.parse({
 *   id: 'some-uuid',
 *   kind: 'partner',
 *   contactName: 'Juan Pérez',
 *   email: 'juan@example.com',
 *   phone: '+54911234567',
 *   message: 'Nombre del negocio: Acme SA\n...',
 *   status: 'pending',
 *   adminNote: null,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   createdById: null,
 *   updatedById: null,
 *   deletedAt: null,
 *   deletedById: null,
 * });
 * ```
 */
export const AllianceLeadSchema = z.object({
    /** Lead entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /**
     * Which alliance program this lead is applying for.
     * Closed enum — see {@link AllianceLeadKindEnum}.
     */
    kind: AllianceLeadKindEnum,

    /**
     * Name of the person to contact about this lead.
     */
    contactName: z
        .string()
        .min(2, { message: 'zodError.allianceLead.contactName.min' })
        .max(255, { message: 'zodError.allianceLead.contactName.max' }),

    /**
     * Contact email address for the lead applicant.
     */
    email: z
        .string()
        .email({ message: 'zodError.allianceLead.email.invalid' })
        .max(320, { message: 'zodError.allianceLead.email.max' }),

    /**
     * Contact phone number (optional; free-form to allow regional formats).
     */
    phone: z.string().max(50, { message: 'zodError.allianceLead.phone.max' }).nullish(),

    /**
     * Free-text message from the applicant. Includes both any free-form text
     * the applicant wrote and any kind-specific fields the form serialized
     * with labels (see HOS-277 §7.3, e.g. business name / website / portfolio
     * links) — there are no dedicated typed columns for those in V1 (NG-3).
     */
    message: z
        .string()
        .min(10, { message: 'zodError.allianceLead.message.min' })
        .max(2000, { message: 'zodError.allianceLead.message.max' }),

    /**
     * Current workflow status of the lead.
     * Defaults to `pending` on submission.
     */
    status: AllianceLeadStatusEnum.default('pending'),

    /**
     * Optional admin note attached when the lead is reviewed via mark-handled.
     */
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).nullish(),

    // Audit fields (createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById)
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link AllianceLeadSchema}. */
export type AllianceLead = z.infer<typeof AllianceLeadSchema>;
