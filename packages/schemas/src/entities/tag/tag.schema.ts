import type { TagId, UserId } from '@repo/types';
import { LifecycleStatusEnum, TagColorEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Tag Schema - Main Entity Schema (Completely Flat)
 *
 * This schema defines the complete structure of a Tag entity
 * with all fields declared inline for zero dependencies.
 */
export const TagSchema = z.object({
    // ID field
    id: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
        .transform((val) => val as TagId),

    // Audit fields
    createdAt: z.coerce.date({
        message: 'zodError.common.createdAt.required'
    }),
    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    }),
    createdById: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
        .transform((val) => val as UserId),
    updatedById: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
        .transform((val) => val as UserId),
    deletedAt: z.coerce
        .date({
            message: 'zodError.common.deletedAt.required'
        })
        .optional(),
    deletedById: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
        .transform((val) => val as UserId)
        .optional(),

    // Lifecycle fields
    lifecycleState: z.nativeEnum(LifecycleStatusEnum, {
        error: () => ({ message: 'zodError.enums.lifecycleStatus.invalid' })
    }),

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

    color: z.nativeEnum(TagColorEnum, {
        error: () => ({ message: 'zodError.enums.tagColor.invalid' })
    }),

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

/**
 * Tag array schema
 */
export const TagsArraySchema = z.array(TagSchema, {
    message: 'zodError.tags.required'
});

/**
 * Type exports for the main Tag entity
 */
export type Tag = z.infer<typeof TagSchema>;
export type TagsArray = z.infer<typeof TagsArraySchema>;
