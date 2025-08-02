import { z } from 'zod';
import {
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '../enums/index.js';
import { AdminInfoSchema } from './admin.schema.js';
import { IdSchema, UserIdSchema } from './id.schema.js';

declare const TagSchema: z.ZodTypeAny;

export const WithIdSchema = z.object({
    id: IdSchema
});

export const WithAuditSchema = z.object({
    createdAt: z.coerce.date({
        message: 'zodError.common.createdAt.required'
    }),
    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    }),
    createdById: UserIdSchema,
    updatedById: UserIdSchema,
    deletedAt: z.coerce
        .date({
            message: 'zodError.common.deletedAt.required'
        })
        .optional(),
    deletedById: UserIdSchema.optional()
});

export const WithLifecycleStateSchema = z.object({
    lifecycleState: LifecycleStatusEnumSchema
});

export const WithReviewStateSchema = z.object({
    reviewsCount: z
        .number({
            message: 'zodError.common.reviewsCount.required'
        })
        .optional(),
    averageRating: z
        .number({
            message: 'zodError.common.averageRating.required'
        })
        .optional()
});

export const WithSeoSchema = z.object({
    seo: z
        .object({
            title: z
                .string({
                    message: 'zodError.common.seo.title.required'
                })
                .min(30, { message: 'zodError.common.seo.title.min' })
                .max(60, { message: 'zodError.common.seo.title.max' })
                .optional(),
            description: z
                .string({
                    message: 'zodError.common.seo.description.required'
                })
                .min(70, { message: 'zodError.common.seo.description.min' })
                .max(160, { message: 'zodError.common.seo.description.max' })
                .optional(),
            keywords: z
                .array(
                    z.string({
                        message: 'zodError.common.seo.keywords.required'
                    })
                )
                .optional()
        })
        .optional()
});

export const WithTagsSchema = z.object({
    tags: z
        .array(
            z.lazy(() => TagSchema),
            {
                message: 'zodError.common.tags.required'
            }
        )
        .optional()
});

export const WithVisibilitySchema = z.object({
    visibility: VisibilityEnumSchema
});

export const WithAdminInfoSchema = z.object({
    adminInfo: AdminInfoSchema.optional()
});

export const WithModerationStatusSchema = z.object({
    moderationState: ModerationStatusEnumSchema
});
