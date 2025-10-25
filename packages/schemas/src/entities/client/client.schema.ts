import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

/**
 * Client Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Client entity
 * using base field objects for consistency and maintainability.
 */
export const ClientSchema = z.object({
    // Base fields
    id: ClientIdSchema,
    ...BaseAuditFields,

    // Entity fields - specific to client
    userId: UserIdSchema.nullable(), // Nullable for organization support
    name: z
        .string()
        .min(3, { message: 'zodError.client.name.min' })
        .max(200, { message: 'zodError.client.name.max' }),
    billingEmail: z
        .string()
        .email({ message: 'zodError.client.billingEmail.invalid' })
        .max(255, { message: 'zodError.client.billingEmail.max' }),

    // Base field groups
    ...BaseLifecycleFields,
    ...BaseAdminFields
});

export type Client = z.infer<typeof ClientSchema>;
