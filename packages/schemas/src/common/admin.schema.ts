import { z } from 'zod';

export const AdminInfoSchema = z.object({
    notes: z
        .string({
            required_error: 'zodError.common.adminInfo.notes.required',
            invalid_type_error: 'zodError.common.adminInfo.notes.invalidType'
        })
        .min(5, { message: 'zodError.common.adminInfo.notes.min' })
        .max(300, { message: 'zodError.common.adminInfo.notes.max' })
        .optional(),
    favorite: z.boolean({
        required_error: 'zodError.common.adminInfo.favorite.required',
        invalid_type_error: 'zodError.common.adminInfo.favorite.invalidType'
    })
});
