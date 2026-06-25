import type { z } from 'zod';
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
