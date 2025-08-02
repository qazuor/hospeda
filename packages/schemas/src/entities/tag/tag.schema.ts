import { TagIdSchema, UserIdSchema } from '@repo/schemas/common/id.schema.js';
import { LifecycleStatusEnumSchema } from '@repo/schemas/enums/index.js';
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
    deletedById: UserIdSchema.optional(),

    // From WithLifecycleStateSchema
    lifecycleState: LifecycleStatusEnumSchema,

    // Own properties
    name: z
        .string({
            message: 'zodError.tag.name.required'
        })
        .min(2, { message: 'zodError.tag.name.min' })
        .max(50, { message: 'zodError.tag.name.max' }),
    slug: z
        .string({
            message: 'zodError.tag.slug.required'
        })
        .min(1, { message: 'zodError.tag.slug.min' }),
    color: TagColorEnumSchema,
    icon: z
        .string({
            message: 'zodError.tag.icon.required'
        })
        .min(2, { message: 'zodError.tag.icon.min' })
        .max(100, { message: 'zodError.tag.icon.max' })
        .optional(),
    notes: z
        .string({
            message: 'zodError.tag.notes.required'
        })
        .min(5, { message: 'zodError.tag.notes.min' })
        .max(300, { message: 'zodError.tag.notes.max' })
        .optional()
});

export const TagsArraySchema = z.array(TagSchema, {
    message: 'zodError.tags.required'
});
