import {
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithSeoSchema
} from '@repo/schemas/common/helpers.schema.js';
import { z } from 'zod';

export const TagSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithModerationStatusSchema)
    .merge(WithSeoSchema)
    .extend({
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
        color: z
            .string({
                required_error: 'zodError.tag.color.required',
                invalid_type_error: 'zodError.tag.color.invalidType'
            })
            .min(3, { message: 'zodError.tag.color.min' })
            .max(20, { message: 'zodError.tag.color.max' }),
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
