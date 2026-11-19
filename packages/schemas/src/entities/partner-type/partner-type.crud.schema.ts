import { z } from 'zod';
import { PartnerTypeIdSchema } from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { PartnerTypeSchema } from './partner-type.schema.js';

/** Fields the server owns on every partner type row. */
const SERVER_OWNED = {
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
} as const;

/** Input for creating a partner type (HOS-2336). */
export const PartnerTypeCreateInputSchema = PartnerTypeSchema.omit(SERVER_OWNED);

/**
 * Input for updating a partner type. Partial, with defaults stripped so an
 * absent key means "no change". `slug` is not accepted (AC-3.3): the object is
 * strict, so sending it is a validation error.
 */
export const PartnerTypeUpdateInputSchema = z
    .object(stripShapeDefaults(PartnerTypeCreateInputSchema.omit({ slug: true }).shape))
    .partial()
    .strict();

/** Id-only input for soft delete and restore. */
export const PartnerTypeIdInputSchema = z.object({ id: PartnerTypeIdSchema });

/** Inferred type of {@link PartnerTypeCreateInputSchema}. */
export type PartnerTypeCreateInput = z.infer<typeof PartnerTypeCreateInputSchema>;
/** Inferred type of {@link PartnerTypeUpdateInputSchema}. */
export type PartnerTypeUpdateInput = z.infer<typeof PartnerTypeUpdateInputSchema>;
/** Inferred type of {@link PartnerTypeIdInputSchema}. */
export type PartnerTypeIdInput = z.infer<typeof PartnerTypeIdInputSchema>;
