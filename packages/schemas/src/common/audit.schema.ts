import { z } from 'zod';
import { UserIdSchema } from './id.schema.js';

/**
 * Base audit fields for tracking creation, updates, and soft deletion
 * Note: createdById and updatedById are nullable because some records may be
 * created/updated by system processes without a specific user.
 */
export const BaseAuditFields = {
    createdAt: z.coerce.date({
        message: 'zodError.common.createdAt.required'
    }),
    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    }),
    createdById: UserIdSchema.nullable(),
    updatedById: UserIdSchema.nullable(),
    deletedAt: z.coerce
        .date({
            message: 'zodError.common.deletedAt.required'
        })
        .nullable(),
    deletedById: UserIdSchema.nullable()
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
