import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { ClientAccessRightIdSchema, ClientIdSchema } from '../../common/id.schema.js';
import { AccessRightScopeEnumSchema } from '../../enums/access-right-scope.schema.js';

/**
 * ClientAccessRight Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a ClientAccessRight entity
 * using base field objects for consistency and maintainability.
 *
 * ClientAccessRight represents the specific features and permissions
 * that a client has access to based on their subscription.
 */
export const ClientAccessRightSchema = z.object({
    // Base fields
    id: ClientAccessRightIdSchema,
    ...BaseAuditFields,

    // Entity fields - specific to client access right
    clientId: ClientIdSchema,
    subscriptionItemId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    feature: z
        .string()
        .min(1, { message: 'zodError.clientAccessRight.feature.required' })
        .max(100, { message: 'zodError.clientAccessRight.feature.max' }),
    scope: AccessRightScopeEnumSchema,

    // Polymorphic fields for scoped access (nullable for GLOBAL scope)
    scopeId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).nullable().optional(),
    scopeType: z
        .string()
        .min(1, { message: 'zodError.clientAccessRight.scopeType.required' })
        .max(50, { message: 'zodError.clientAccessRight.scopeType.max' })
        .nullable()
        .optional(),

    // Validity period
    validFrom: z.coerce.date({
        message: 'zodError.clientAccessRight.validFrom.required'
    }),
    validTo: z.coerce
        .date({
            message: 'zodError.clientAccessRight.validTo.invalid'
        })
        .optional(),

    // Base field groups
    ...BaseAdminFields
});

export type ClientAccessRight = z.infer<typeof ClientAccessRightSchema>;
