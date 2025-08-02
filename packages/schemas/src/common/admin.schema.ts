import { z } from 'zod';

export const AdminInfoSchema = z.object({
    notes: z
        .string({
            message: 'zodError.common.adminInfo.notes.required'
        })
        .min(5, { message: 'zodError.common.adminInfo.notes.min' })
        .max(300, { message: 'zodError.common.adminInfo.notes.max' })
        .optional(),
    favorite: z.boolean({
        message: 'zodError.common.adminInfo.favorite.required'
    })
});
