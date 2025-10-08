/**
 * API Information Schemas
 *
 * Schemas for API metadata and information endpoints.
 */
import { z } from 'zod';

/**
 * API Information Schema
 * Defines the structure for API metadata responses
 */
export const ApiInfoSchema = z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    status: z.string(),
    timestamp: z.string(),
    documentation: z.string()
});

export type ApiInfo = z.infer<typeof ApiInfoSchema>;
