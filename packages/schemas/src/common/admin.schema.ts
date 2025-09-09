import { z } from 'zod';

export const AdminInfoSchema = z.object({
    notes: z
        .string({
            message: 'zodError.common.adminInfo.notes.required'
        })
        .min(5, { message: 'zodError.common.adminInfo.notes.min' })
        .max(300, { message: 'zodError.common.adminInfo.notes.max' })
        .optional(),
    favorite: z
        .boolean({
            message: 'zodError.common.adminInfo.favorite.required'
        })
        .default(false)
});

/**
 * Base admin info fields (basic version as agreed - only notes and favorite)
 */
export const BaseAdminFields = {
    adminInfo: AdminInfoSchema.optional()
} as const;

/**
 * Type exports for admin schemas
 */
export type BaseAdminFieldsType = typeof BaseAdminFields;
export type AdminInfo = z.infer<typeof AdminInfoSchema>;
