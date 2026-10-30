import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/** HOS-1638 AC:B13a:23 Coord-7: validated admin effective-set query. */
export const AdminEffectiveSetQuerySchema = z.object({ vertical: VerticalEnumSchema });
/** HOS-1638 AC:B13a:23 Coord-7: a JSON-safe resolved key value. */
export const EffectiveSetValueSchema = z.union([
    z.number().finite().nonnegative(),
    z.literal('Infinity')
]);
/** HOS-1638 AC:B13a:23 Coord-7: resolved values for one user and vertical. */
export const AdminEffectiveSetResponseSchema = z.object({
    userId: z.string().uuid(),
    vertical: VerticalEnumSchema,
    hasLiveNonTrialTitle: z.boolean(),
    entitlements: z.record(z.string(), EffectiveSetValueSchema),
    limits: z.record(z.string(), EffectiveSetValueSchema)
});

/** HOS-1638 AC:B13a:23 Coord-7: admin effective-set query type. */
export type AdminEffectiveSetQuery = z.infer<typeof AdminEffectiveSetQuerySchema>;
/** HOS-1638 AC:B13a:23 Coord-7: JSON-safe value type. */
export type EffectiveSetValue = z.infer<typeof EffectiveSetValueSchema>;
/** HOS-1638 AC:B13a:23 Coord-7: admin effective-set response type. */
export type AdminEffectiveSetResponse = z.infer<typeof AdminEffectiveSetResponseSchema>;
