import { z } from 'zod';
import { TagIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { TagColorEnumSchema } from '../../enums/tag-color.schema.js';

/**
 * Tag Schema - Main Entity Schema (Completely Flat)
 *
 * This schema defines the complete structure of a Tag entity
 * with all fields declared inline for zero dependencies.
 */
export const TagSchema = z.object({
    // ID field
    id: TagIdSchema,

    // Audit fields
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

    // Lifecycle fields
    lifecycleState: LifecycleStatusEnumSchema,

    // Tag-specific fields
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
export type Tag = z.infer<typeof TagSchema>;

/**
 * Tag array schema
 */
export const TagsArraySchema = z.array(TagSchema, {
    message: 'zodError.tags.required'
});
export type TagsArray = z.infer<typeof TagsArraySchema>;
