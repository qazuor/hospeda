import { z } from 'zod';
import { UserIdSchema } from './id.schema.js';

/**
 * Base audit fields for tracking creation, updates, and soft deletion
 */
export const BaseAuditFields = {
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
    deletedById: UserIdSchema.optional()
} as const;
export type BaseAuditFieldsType = typeof BaseAuditFields;

/**
 * Audit Schema - Complete audit information
 * Can be used as a standalone schema when needed
 */
export const AuditSchema = z.object({
    ...BaseAuditFields
});
export type AuditType = z.infer<typeof AuditSchema>;
