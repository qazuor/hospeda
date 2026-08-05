import type { z } from 'zod';
import { partnerSchema } from './partner.schema.js';

/**
 * Create partner schema
 * Excludes auto-generated fields: id, timestamps, audit fields
 *
 * `ownerUserId` is omitted for the same reason it is omitted from the update
 * schema (HOS-278 D1): the only writer of ownership is the provisioning path,
 * which builds its insert from the approved lead and goes through the model
 * directly. A partner created by hand in the admin has no owner, by design.
 */
export const createPartnerSchema = partnerSchema.omit({
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
