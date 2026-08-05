import type { z } from 'zod';
import { partnerSchema } from './partner.schema.js';

/**
 * Update partner schema
 * All fields optional except id, excludes createdAt/createdById
 *
 * `ownerUserId` is omitted deliberately (HOS-278 D1). Ownership is written by
 * exactly two paths — provisioning an approved lead, and the claim that
 * backfills an anonymous applicant — and neither goes through this schema. An
 * admin editing a partner must not be able to hand the listing to a different
 * account as an unremarkable field edit; `host_trades` forbids the same field
 * for the same reason (`HOST_TRADE_OWNER_FORBIDDEN_FIELDS`).
 */
export const updatePartnerSchema = partnerSchema
    .omit({
        id: true,
        createdAt: true,
        createdById: true,
        ownerUserId: true
    })
    .partial();

export type UpdatePartner = z.infer<typeof updatePartnerSchema>;
