import { TagIdSchema, UserIdSchema } from '@repo/schemas/common/id.schema.js';
import {
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema
} from '@repo/schemas/enums/index.js';
import { TagColorEnumSchema } from '@repo/schemas/enums/tag-color.enum.schema.js';
import { z } from 'zod';

/**
 * Note: The TagSchema is defined by explicitly listing all properties instead of merging
 * helper schemas (e.g., WithIdSchema, WithAuditSchema). This approach is a deliberate
 * architectural choice to prevent circular dependency issues that can arise in testing
 * frameworks like Vitest, especially when schemas are interconnected (e.g., a helper
 * schema importing this one). By flattening the structure, we ensure stable and
 * predictable module resolution during tests.
 */
export const TagSchema = z.object({
    // From WithIdSchema
    id: TagIdSchema,

    // From WithAuditSchema
    createdAt: z.coerce.date({
        required_error: 'zodError.common.createdAt.required',
        invalid_type_error: 'zodError.common.createdAt.invalidType'
    }),
    updatedAt: z.coerce.date({
        required_error: 'zodError.common.updatedAt.required',
        invalid_type_error: 'zodError.common.updatedAt.invalidType'
    }),
    createdById: UserIdSchema,
    updatedById: UserIdSchema,
    deletedAt: z.coerce
        .date({
            required_error: 'zodError.common.deletedAt.required',
            invalid_type_error: 'zodError.common.deletedAt.invalidType'
        })
        .optional(),
    deletedById: UserIdSchema.optional(),

    // From WithLifecycleStateSchema
    lifecycleState: LifecycleStatusEnumSchema,

    // From WithModerationStatusSchema
    moderationState: ModerationStatusEnumSchema,

    // From WithSeoSchema
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
        .optional(),

    // Own properties
    name: z
        .string({
            required_error: 'zodError.tag.name.required',
            invalid_type_error: 'zodError.tag.name.invalidType'
        })
        .min(2, { message: 'zodError.tag.name.min' })
        .max(50, { message: 'zodError.tag.name.max' }),
    slug: z
        .string({
            required_error: 'zodError.tag.slug.required',
            invalid_type_error: 'zodError.tag.slug.invalidType'
        })
        .min(1, { message: 'zodError.tag.slug.min' }),
    color: TagColorEnumSchema,
    icon: z
        .string({
            required_error: 'zodError.tag.icon.required',
            invalid_type_error: 'zodError.tag.icon.invalidType'
        })
        .min(2, { message: 'zodError.tag.icon.min' })
        .max(100, { message: 'zodError.tag.icon.max' })
        .optional(),
    notes: z
        .string({
            required_error: 'zodError.tag.notes.required',
            invalid_type_error: 'zodError.tag.notes.invalidType'
        })
        .min(5, { message: 'zodError.tag.notes.min' })
        .max(300, { message: 'zodError.tag.notes.max' })
        .optional()
});

export const TagsArraySchema = z.array(TagSchema, {
    required_error: 'zodError.tags.required',
    invalid_type_error: 'zodError.tags.invalidType'
});
