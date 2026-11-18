import { z } from 'zod';
import {
    HostTradeCategoryGroupIdSchema,
    HostTradeCategoryIdSchema
} from '../../common/id.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import {
    HostTradeCategoryGroupSchema,
    HostTradeCategorySchema
} from './host-trade-category.schema.js';

/** Fields the server owns on every catalog row. */
const SERVER_OWNED = {
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
} as const;

/** Input for creating a category group. */
export const HostTradeCategoryGroupCreateInputSchema =
    HostTradeCategoryGroupSchema.omit(SERVER_OWNED);

/**
 * Input for updating a category group. Partial, with defaults stripped so an
 * absent key means "no change". `slug` is not accepted (spec D8): the object
 * is strict, so sending it is a validation error.
 */
export const HostTradeCategoryGroupUpdateInputSchema = z
    .object(stripShapeDefaults(HostTradeCategoryGroupCreateInputSchema.omit({ slug: true }).shape))
    .partial()
    .strict();

/** Input for creating a category. */
export const HostTradeCategoryCreateInputSchema = HostTradeCategorySchema.omit(SERVER_OWNED);

/**
 * Input for updating a category. Same rules as the group update: partial, no
 * injected defaults, and `slug` rejected (spec D8).
 */
export const HostTradeCategoryUpdateInputSchema = z
    .object(stripShapeDefaults(HostTradeCategoryCreateInputSchema.omit({ slug: true }).shape))
    .partial()
    .strict();

/** Id-only inputs for soft delete and restore. */
export const HostTradeCategoryGroupIdInputSchema = z.object({ id: HostTradeCategoryGroupIdSchema });
export const HostTradeCategoryIdInputSchema = z.object({ id: HostTradeCategoryIdSchema });

export type HostTradeCategoryGroupCreateInput = z.infer<
    typeof HostTradeCategoryGroupCreateInputSchema
>;
export type HostTradeCategoryGroupUpdateInput = z.infer<
    typeof HostTradeCategoryGroupUpdateInputSchema
>;
export type HostTradeCategoryCreateInput = z.infer<typeof HostTradeCategoryCreateInputSchema>;
export type HostTradeCategoryUpdateInput = z.infer<typeof HostTradeCategoryUpdateInputSchema>;
export type HostTradeCategoryGroupIdInput = z.infer<typeof HostTradeCategoryGroupIdInputSchema>;
export type HostTradeCategoryIdInput = z.infer<typeof HostTradeCategoryIdInputSchema>;
