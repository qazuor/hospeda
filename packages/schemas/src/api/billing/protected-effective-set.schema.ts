import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';
import { AdminEffectiveSetResponseSchema } from './admin-effective-set.schema.js';

export const ProtectedEffectiveSetQuerySchema = z.object({ vertical: VerticalEnumSchema });
export const ProtectedEffectiveSetResponseSchema = AdminEffectiveSetResponseSchema;
export type ProtectedEffectiveSetQuery = z.infer<typeof ProtectedEffectiveSetQuerySchema>;
export type ProtectedEffectiveSetResponse = z.infer<typeof ProtectedEffectiveSetResponseSchema>;
