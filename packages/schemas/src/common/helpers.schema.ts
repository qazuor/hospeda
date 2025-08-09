import { createRequire } from 'node:module';
import { z } from 'zod';
import {
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '../enums/index.js';
import { AdminInfoSchema } from './admin.schema.js';
import { IdSchema, UserIdSchema } from './id.schema.js';

/**
 * Lazy reference to resolve circular dependency between TagSchema and helper schemas.
 *
 * Problem: TagSchema may import helper schemas (like WithIdSchema, WithAuditSchema),
 * and WithTagsSchema needs TagSchema for the tags array. This creates a circular dependency.
 *
 * Solution: Use z.lazy() to defer TagSchema resolution until runtime, breaking the
 * circular import chain at module load time. The function will be called only when
 * the schema is actually used for validation.
 */
let tagSchemaCache: z.ZodTypeAny | undefined;
const getTagSchema = (): z.ZodTypeAny => {
    if (tagSchemaCache === undefined) {
        // Use dynamic import at runtime to break circular dependency
        // Support both CJS and ESM environments
        // biome-ignore lint/suspicious/noExplicitAny: compatibility layer for require in ESM
        const req: any = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
        const tagModule = req('../entities/tag/tag.schema.js');
        tagSchemaCache = (tagModule.TagSchema ?? tagModule.default?.TagSchema) as z.ZodTypeAny;
    }
    return tagSchemaCache as z.ZodTypeAny;
};

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
            z.lazy(() => getTagSchema()),
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
