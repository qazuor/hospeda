import { z } from 'zod';

/**
 * Schema for updating a content moderation threshold (SPEC-195).
 * All fields are optional (partial update). v1 is update-only — no create.
 * Validates `pending < reject` when both values are provided.
 */
export const updateContentModerationThresholdSchema = z
    .object({
        context: z.string().min(1).optional(),
        pending: z.number().min(0).max(1).optional(),
        reject: z.number().min(0).max(1).optional()
    })
    .superRefine((data, ctx) => {
        if (
            data.pending !== undefined &&
            data.reject !== undefined &&
            data.pending >= data.reject
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['pending'],
                message: 'pending must be less than reject'
            });
        }
    });

export type UpdateContentModerationThreshold = z.infer<
    typeof updateContentModerationThresholdSchema
>;
