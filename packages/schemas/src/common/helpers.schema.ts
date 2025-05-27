import { z } from 'zod';
import { LifecycleStateEnumSchema, StateEnumSchema, VisibilityEnumSchema } from '../enums';
import { AdminInfoSchema } from './admin.schema';
import { IdSchema } from './id.schema';
import { TagSchema } from './tag.schema';

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
    })
});

export const WithLifecycleStateSchema = z.object({
    lifecycleState: LifecycleStateEnumSchema.refine(
        (val: string) => LifecycleStateEnumSchema.options.includes(val),
        { message: 'zodError.common.lifecycleState.invalidEnum' }
    )
});

export const WithReviewStateSchema = z.object({
    reviewState: z.string({
        required_error: 'zodError.common.reviewState.required',
        invalid_type_error: 'zodError.common.reviewState.invalidType'
    })
});

export const WithSeoSchema = z.object({
    seo: z.object({
        title: z.string({
            required_error: 'zodError.common.seo.title.required',
            invalid_type_error: 'zodError.common.seo.title.invalidType'
        }),
        description: z.string({
            required_error: 'zodError.common.seo.description.required',
            invalid_type_error: 'zodError.common.seo.description.invalidType'
        })
    })
});

export const WithTagsSchema = z.object({
    tags: z.array(TagSchema, {
        required_error: 'zodError.common.tags.required',
        invalid_type_error: 'zodError.common.tags.invalidType'
    })
});

export const WithVisibilitySchema = z.object({
    visibility: VisibilityEnumSchema.refine(
        (val: string) => VisibilityEnumSchema.options.includes(val),
        { message: 'zodError.common.visibility.invalidEnum' }
    )
});

export const WithAdminInfoSchema = z.object({
    adminInfo: AdminInfoSchema
});

export const WithSoftDeleteSchema = z.object({
    deletedAt: z
        .string({
            required_error: 'zodError.common.deletedAt.required',
            invalid_type_error: 'zodError.common.deletedAt.invalidType'
        })
        .nullable()
});

export const WithActivityStateSchema = z.object({
    state: StateEnumSchema.refine((val: string) => StateEnumSchema.options.includes(val), {
        message: 'zodError.common.state.invalidEnum'
    })
});
