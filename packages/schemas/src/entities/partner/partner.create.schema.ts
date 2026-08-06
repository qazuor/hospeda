import type { z } from 'zod';
import {
    PARTNER_REVIEW_MANAGED_FIELDS,
    PARTNER_REVOKE_MANAGED_FIELDS,
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
export const createPartnerSchema = partnerSchema.omit({
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
    analytics: true // Will default to {}
});

export type CreatePartner = z.infer<typeof createPartnerSchema>;
