// biome-ignore lint/style/useImportType: z is used in z.infer() for type inference
import { z } from 'zod';
// biome-ignore lint/style/useImportType: partnerSchema is used as runtime value in .omit()
import { partnerSchema } from './partner.schema.js';

/**
 * Create partner schema
 * Excludes auto-generated fields: id, timestamps, audit fields
 */
export const createPartnerSchema = partnerSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    analytics: true // Will default to {}
});

export type CreatePartner = z.infer<typeof createPartnerSchema>;
