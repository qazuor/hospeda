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

/**
 * Generic delete response schema
 * Use for endpoints that return delete operation results.
 */
export const DeleteResultSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.result.success.invalidType'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.result.deletedAt.invalidType'
        })
        .optional()
});

export type DeleteResult = z.infer<typeof DeleteResultSchema>;

/**
 * Generic restore response schema
 * Use for endpoints that return restore operation results.
 */
export const RestoreResultSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.result.success.invalidType'
        })
        .default(true),
    restoredAt: z
        .date({
            message: 'zodError.result.restoredAt.invalidType'
        })
        .optional()
});

export type RestoreResult = z.infer<typeof RestoreResultSchema>;

/**
 * Generic assignment response schema
 * Use for endpoints that return assignment operation results.
 */
export const AssignmentResultSchema = z.object({
    assigned: z
        .boolean({
            message: 'zodError.result.assigned.invalidType'
        })
        .default(true)
});

export type AssignmentResult = z.infer<typeof AssignmentResultSchema>;

/**
 * Generic removal response schema
 * Use for endpoints that return removal operation results.
 */
export const RemovalResultSchema = z.object({
    removed: z
        .boolean({
            message: 'zodError.result.removed.invalidType'
        })
        .default(true)
});

export type RemovalResult = z.infer<typeof RemovalResultSchema>;
