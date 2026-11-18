/**
 * Alliance lead provisioning outcome schemas (HOS-2339).
 *
 * Approving a `service_provider` lead tries to create its directory listing.
 * It can legitimately decline, so the admin API reports what happened instead
 * of dropping it.
 */
import { z } from 'zod';
import { AllianceLeadSchema } from './alliance-lead.schema.js';

/**
 * Closed set of reasons provisioning did not produce a new listing.
 * Pinned against the service-core `ProvisionSkipReason` type by a test.
 */
export const ALLIANCE_LEAD_PROVISION_SKIP_REASONS = [
    'not-a-service-provider',
    'already-provisioned',
    'legacy-lead-without-typed-fields',
    'no-active-category'
] as const;

/** Reason provisioning was skipped. */
export const AllianceLeadProvisionSkipReasonSchema = z.enum(ALLIANCE_LEAD_PROVISION_SKIP_REASONS);

/** Reason provisioning was skipped. */
export type AllianceLeadProvisionSkipReason = z.infer<typeof AllianceLeadProvisionSkipReasonSchema>;

/**
 * What a provisioning attempt did. `provisioned: true` requires `hostTradeId`
 * and forbids `reason`.
 */
export const AllianceLeadProvisioningOutcomeSchema = z
    .object({
        provisioned: z.boolean(),
        reason: AllianceLeadProvisionSkipReasonSchema.optional(),
        hostTradeId: z.string().uuid().optional()
    })
    .refine((o) => !o.provisioned || (o.hostTradeId !== undefined && o.reason === undefined), {
        message: 'A provisioned outcome requires hostTradeId and forbids reason'
    });

/** What a provisioning attempt did. */
export type AllianceLeadProvisioningOutcome = z.infer<typeof AllianceLeadProvisioningOutcomeSchema>;

/**
 * Response of `mark-handled` and `provision`: the lead plus an optional
 * additive `provisioning` outcome (absent for rejections and other kinds).
 */
export const AllianceLeadWithProvisioningSchema = AllianceLeadSchema.extend({
    provisioning: AllianceLeadProvisioningOutcomeSchema.optional()
});

/** Lead with the optional provisioning outcome. */
export type AllianceLeadWithProvisioning = z.infer<typeof AllianceLeadWithProvisioningSchema>;
