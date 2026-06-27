import { z } from 'zod';

// ============================================================================
// COMMERCE LEAD ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC CREATE RESPONSE SCHEMA — CommerceLead
 *
 * Defines the minimal payload returned to unauthenticated callers after a
 * successful `POST /api/v1/public/commerce/leads` submission.
 *
 * Only the newly-created lead's UUID is disclosed.  All applicant PII
 * (email, phone, contactName, businessName), workflow fields (status,
 * adminNote, handledAt, handledById), and audit timestamps are withheld
 * from public consumers.
 *
 * This schema is intentionally small by design — the public form only needs
 * to confirm that the lead was recorded (via `id`); no other field is
 * consumed by any web component today (YAGNI).
 */
export const CommerceLeadCreateResponseSchema = z.object({
    /** UUID of the newly-created CommerceLead record. */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** TypeScript type inferred from {@link CommerceLeadCreateResponseSchema}. */
export type CommerceLeadCreateResponse = z.infer<typeof CommerceLeadCreateResponseSchema>;
