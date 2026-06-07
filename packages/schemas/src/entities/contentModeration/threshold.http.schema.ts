import { z } from 'zod';
import { updateContentModerationThresholdSchema } from './threshold.crud.schema.js';

/**
 * HTTP request schema for updating a moderation threshold (SPEC-195).
 */
export const updateThresholdRequestSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: updateContentModerationThresholdSchema
});

/**
 * Path parameter schema for threshold endpoints that take an `:id`.
 */
export const thresholdIdParamSchema = z.object({
    id: z.string().uuid()
});

export type UpdateThresholdRequest = z.infer<typeof updateThresholdRequestSchema>;
export type ThresholdIdParam = z.infer<typeof thresholdIdParamSchema>;
