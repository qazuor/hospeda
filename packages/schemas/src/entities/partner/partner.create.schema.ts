import { z } from 'zod';
import {
    PARTNER_REVIEW_MANAGED_FIELDS,
    PARTNER_REVOKE_MANAGED_FIELDS,
    PARTNER_SAFE_WRITE_URL_FIELDS,
    partnerSchema
} from './partner.schema.js';

/**
 * Create partner schema
 * Excludes auto-generated fields: id, timestamps, audit fields
 *
 * `ownerUserId` is omitted for the same reason it is omitted from the update
 * schema (HOS-278 D1): the only writer of ownership is the provisioning path,
 * which builds its insert from the approved lead and goes through the model
 * directly. A partner created by hand in the admin has no owner, by design.
 *
 * The content-review columns are omitted for their own reason — see
 * {@link PARTNER_REVIEW_MANAGED_FIELDS}. A hand-created partner still ends up
 * payable: `PartnerService._beforeCreate` stamps `contentApprovedAt` itself,
 * because content an admin typed has already been through the only review
 * AC-11 asks for.
 */
export const createPartnerSchema = partnerSchema
    .omit({
        ...PARTNER_REVIEW_MANAGED_FIELDS,
        ...PARTNER_REVOKE_MANAGED_FIELDS,
        id: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdById: true,
        updatedById: true,
        deletedById: true,
        ownerUserId: true,
        analytics: true, // Will default to {}
        presenceModerated: true,
        claimSecretHash: true
    })
    .extend(PARTNER_SAFE_WRITE_URL_FIELDS);

export type CreatePartner = z.infer<typeof createPartnerSchema>;

/**
 * Admin direct creation requires a claim-notice address (AC:V7:11, D-4).
 * The address only addresses the claim notice; it is never stored.
 */
export const adminCreatePartnerSchema = createPartnerSchema.extend({
    claimEmail: z
        .string()
        .trim()
        .email('zodError.partnerApplication.email.invalid')
        .max(320, 'zodError.partnerApplication.email.max')
});

/** Input accepted by the admin direct partner creation endpoint. */
export type AdminCreatePartner = z.infer<typeof adminCreatePartnerSchema>;
