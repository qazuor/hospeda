import type { z } from 'zod';
import { partnerSchema } from './partner.schema.js';

/**
 * Update partner schema
 * All fields optional except id, excludes createdAt/createdById
 */
export const updatePartnerSchema = partnerSchema
    .omit({
        id: true,
        createdAt: true,
        createdById: true
    })
    .partial();

export type UpdatePartner = z.infer<typeof updatePartnerSchema>;
