import { z } from 'zod';

/**
 * Generic success response schema
 * Use for endpoints that return only a success boolean.
 */
export const SuccessSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.result.success.invalidType'
        })
        .default(true)
});

export type Success = z.infer<typeof SuccessSchema>;
