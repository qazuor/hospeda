import type { z } from 'zod';

/**
 * Type for validated request data
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type ValidatedRequestData<T extends z.ZodType<any, any, any>> = z.infer<T>;

/**
 * Type for validation middleware options
 */
export interface ValidationOptions {
    /**
     * Whether to strip unknown properties
     */
    stripUnknown?: boolean;
}
