import { IdSchema } from '@repo/schemas/common/id.schema.js';
import { LifecycleStatusEnumSchema } from '@repo/schemas/enums/lifecycle-state.enum.schema.js';
import { z } from 'zod';

export const TagSchema = z.object({
    id: IdSchema,
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
        .optional(),
    lifecycleState: LifecycleStatusEnumSchema.refine(
        (val: string) => LifecycleStatusEnumSchema.options.includes(val),
        { message: 'zodError.common.lifecycleStatus.invalidEnum' }
    ),
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
