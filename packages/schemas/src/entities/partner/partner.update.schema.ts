// biome-ignore lint/style/useImportType: z is used in z.infer() for type inference
import { z } from 'zod';
// biome-ignore lint/style/useImportType: partnerSchema is used as runtime value in .omit() and .partial()
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
