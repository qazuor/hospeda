import { z } from 'zod';
import { WithAuditSchema, WithIdSchema, WithLifecycleStateSchema } from './helpers.schema.js';

export const TagSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .extend({
        name: z
            .string({
                required_error: 'zodError.common.tag.name.required',
                invalid_type_error: 'zodError.common.tag.name.invalidType'
            })
            .min(2, { message: 'zodError.common.tag.name.min' })
            .max(50, { message: 'zodError.common.tag.name.max' }),
        color: z
            .string({
                required_error: 'zodError.common.tag.color.required',
                invalid_type_error: 'zodError.common.tag.color.invalidType'
            })
            .min(3, { message: 'zodError.common.tag.color.min' })
            .max(20, { message: 'zodError.common.tag.color.max' }),
        icon: z
            .string({
                required_error: 'zodError.common.tag.icon.required',
                invalid_type_error: 'zodError.common.tag.icon.invalidType'
            })
            .min(2, { message: 'zodError.common.tag.icon.min' })
            .max(100, { message: 'zodError.common.tag.icon.max' })
            .optional(),
        notes: z
            .string({
                required_error: 'zodError.common.tag.notes.required',
                invalid_type_error: 'zodError.common.tag.notes.invalidType'
            })
            .min(5, { message: 'zodError.common.tag.notes.min' })
            .max(300, { message: 'zodError.common.tag.notes.max' })
            .optional()
    });

export const TagsArraySchema = z.array(TagSchema, {
    required_error: 'zodError.common.tags.required',
    invalid_type_error: 'zodError.common.tags.invalidType'
});
