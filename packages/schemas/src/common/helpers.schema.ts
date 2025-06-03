import { z } from 'zod';
import {
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '../enums/index.js';
import { AdminInfoSchema } from './admin.schema.js';
import { IdSchema } from './id.schema.js';
import { TagSchema } from './tag.schema.js';

export const WithIdSchema = z.object({
    id: IdSchema
});

export const WithAuditSchema = z.object({
    createdAt: z.string({
        required_error: 'zodError.common.createdAt.required',
        invalid_type_error: 'zodError.common.createdAt.invalidType'
    }),
    updatedAt: z.string({
        required_error: 'zodError.common.updatedAt.required',
        invalid_type_error: 'zodError.common.updatedAt.invalidType'
    }),
    createdById: z.string({
        required_error: 'zodError.common.createdById.required',
        invalid_type_error: 'zodError.common.createdById.invalidType'
    }),
    updatedById: z.string({
        required_error: 'zodError.common.updatedById.required',
        invalid_type_error: 'zodError.common.updatedById.invalidType'
    }),
    deletedAt: z
        .string({
            required_error: 'zodError.common.deletedAt.required',
            invalid_type_error: 'zodError.common.deletedAt.invalidType'
        })
        .optional(),
    deletedById: z
        .string({
            required_error: 'zodError.common.deletedById.required',
            invalid_type_error: 'zodError.common.deletedById.invalidType'
        })
        .optional()
});

export const WithLifecycleStateSchema = z.object({
    lifecycleState: LifecycleStatusEnumSchema.refine(
        (val: string) => LifecycleStatusEnumSchema.options.includes(val),
        { message: 'zodError.common.lifecycleStatus.invalidEnum' }
    )
});

export const WithReviewStateSchema = z.object({
    reviewsCount: z
        .number({
            required_error: 'zodError.common.reviewsCount.required',
            invalid_type_error: 'zodError.common.reviewsCount.invalidType'
        })
        .optional(),
    averageRating: z
        .number({
            required_error: 'zodError.common.averageRating.required',
            invalid_type_error: 'zodError.common.averageRating.invalidType'
        })
        .optional()
});

export const WithSeoSchema = z.object({
    seo: z
        .object({
            title: z
                .string({
                    required_error: 'zodError.common.seo.title.required',
                    invalid_type_error: 'zodError.common.seo.title.invalidType'
                })
                .min(30, { message: 'zodError.common.seo.title.min' })
                .max(60, { message: 'zodError.common.seo.title.max' })
                .optional(),
            description: z
                .string({
                    required_error: 'zodError.common.seo.description.required',
                    invalid_type_error: 'zodError.common.seo.description.invalidType'
                })
                .min(70, { message: 'zodError.common.seo.description.min' })
                .max(160, { message: 'zodError.common.seo.description.max' })
                .optional(),
            keywords: z
                .array(
                    z.string({
                        required_error: 'zodError.common.seo.keywords.required',
                        invalid_type_error: 'zodError.common.seo.keywords.invalidType'
                    })
                )
                .optional()
        })
        .optional()
});

export const WithTagsSchema = z.object({
    tags: z
        .array(TagSchema, {
            required_error: 'zodError.common.tags.required',
            invalid_type_error: 'zodError.common.tags.invalidType'
        })
        .optional()
});

export const WithVisibilitySchema = z.object({
    visibility: VisibilityEnumSchema.refine(
        (val: string) => VisibilityEnumSchema.options.includes(val),
        { message: 'zodError.common.visibility.invalidEnum' }
    )
});

export const WithAdminInfoSchema = z.object({
    adminInfo: AdminInfoSchema.optional()
});

export const WithModerationStatusSchema = z.object({
    moderationState: ModerationStatusEnumSchema.refine(
        (val: string) => ModerationStatusEnumSchema.options.includes(val),
        {
            message: 'zodError.common.moderationStatus.invalidEnum'
        }
    )
});
