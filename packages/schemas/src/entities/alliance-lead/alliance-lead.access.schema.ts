import { z } from 'zod';

// ============================================================================
// ALLIANCE LEAD ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC CREATE RESPONSE SCHEMA — AllianceLead
 *
 * Defines the minimal payload returned to unauthenticated callers after a
 * successful `POST /api/v1/public/alliance/leads` submission.
 *
 * Only the newly-created lead's UUID is disclosed. All applicant PII (email,
 * phone, contactName, message), workflow fields (status, adminNote), and audit
 * timestamps are withheld from public consumers — mirrors
 * `CommerceLeadCreateResponseSchema` (HOS-277 §6.3).
 */
export const AllianceLeadCreateResponseSchema = z.object({
    /** UUID of the newly-created AllianceLead record. */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type inferred from {@link AllianceLeadCreateResponseSchema}. */
export type AllianceLeadCreateResponse = z.infer<typeof AllianceLeadCreateResponseSchema>;
