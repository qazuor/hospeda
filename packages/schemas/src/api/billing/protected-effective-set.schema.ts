import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';
import {
    AdminEffectiveSetResponseSchema,
    EffectiveSetValueSchema
} from './admin-effective-set.schema.js';

export const ProtectedEffectiveSetQuerySchema = z.object({ vertical: VerticalEnumSchema });
/**
 * The own effective set. `preTrialDraftLimits` is present only for a pre-trial
 * owner (HOS-1721): the photo caps their DRAFT listings accept, i.e. what the
 * trial will grant at first publish. It never widens `limits`, which stay the
 * effective set's own values.
 */
export const ProtectedEffectiveSetResponseSchema = AdminEffectiveSetResponseSchema.extend({
    preTrialDraftLimits: z.record(z.string(), EffectiveSetValueSchema).optional()
});
export type ProtectedEffectiveSetQuery = z.infer<typeof ProtectedEffectiveSetQuerySchema>;
export type ProtectedEffectiveSetResponse = z.infer<typeof ProtectedEffectiveSetResponseSchema>;
