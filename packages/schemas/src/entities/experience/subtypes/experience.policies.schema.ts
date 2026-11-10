import { z } from 'zod';
import { ListingPoliciesBaseSchema } from '../../../common/listing-policies.schema.js';

/**
 * Free-text "what happens if it does not run" policy (HOS-1047), at most 1500
 * characters, stored as `policies.cancellation` since HOS-2060. Descriptive
 * only (NG-1): nothing computes a refund from it.
 */
export const ExperienceCancellationPolicySchema = z
    .string()
    .max(1500, { message: 'zodError.experience.cancellationPolicy.max' });

/**
 * The experience `policies` JSONB (HOS-2060): the shared base plus the
 * experience's own rules.
 *
 * `privateGroups` (HOS-1056) and `cancellation` (HOS-1047) replaced the
 * `accepts_private_groups` and `cancellation_policy` columns.
 */
export const ExperiencePoliciesSchema = ListingPoliciesBaseSchema.extend({
    /** Whether the provider offers a special arrangement for private groups. */
    privateGroups: z.boolean().nullish(),
    /** Descriptive cancellation policy. */
    cancellation: ExperienceCancellationPolicySchema.nullish()
});

/** TypeScript type for {@link ExperiencePoliciesSchema}. */
export type ExperiencePolicies = z.infer<typeof ExperiencePoliciesSchema>;
