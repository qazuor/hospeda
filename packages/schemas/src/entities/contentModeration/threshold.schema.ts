import { z } from 'zod';

/**
 * Base schema for a content moderation threshold entity (SPEC-195).
 * Matches the Drizzle `contentModerationThresholds` table shape.
 */
export const contentModerationThresholdSchema = z
    .object({
        id: z.string().uuid(),
        context: z.string().min(1),
        pending: z.number().min(0).max(1).default(0.5),
        reject: z.number().min(0).max(1).default(0.85),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
        deletedAt: z.coerce.date().nullable(),
        createdById: z.string().uuid().nullable(),
        updatedById: z.string().uuid().nullable()
    })
    .superRefine((data, ctx) => {
        if (data.pending >= data.reject) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['pending'],
                message: 'pending must be less than reject'
            });
        }
    });

export type ContentModerationThreshold = z.infer<typeof contentModerationThresholdSchema>;
