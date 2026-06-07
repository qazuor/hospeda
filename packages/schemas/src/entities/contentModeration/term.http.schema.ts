import { z } from 'zod';
import {
    createContentModerationTermSchema,
    updateContentModerationTermSchema
} from './term.crud.schema.js';

/**
 * HTTP request schema for creating a moderation term (SPEC-195).
 */
export const createTermRequestSchema = z.object({
    body: createContentModerationTermSchema
});

/**
 * HTTP request schema for updating a moderation term.
 */
export const updateTermRequestSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: updateContentModerationTermSchema
});

/**
 * Path parameter schema for term endpoints that take an `:id`.
 */
export const termIdParamSchema = z.object({
    id: z.string().uuid()
});

export type CreateTermRequest = z.infer<typeof createTermRequestSchema>;
export type UpdateTermRequest = z.infer<typeof updateTermRequestSchema>;
export type TermIdParam = z.infer<typeof termIdParamSchema>;
