import { z } from 'zod';
import { BaseAdminFields } from './admin.schema.js';
import { BaseAuditFields } from './audit.schema.js';
import { BaseLifecycleFields } from './lifecycle.schema.js';

/**
 * Base IA Data Schema - Common structure for IA data entries
 *
 * This schema can be extended by specific entities (accommodation, destination, etc.)
 * to create their own IA data schemas with the appropriate ID field.
 */
export const BaseIaDataSchema = z.object({
    // Base fields
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // IA Data-specific fields
    title: z
        .string({
            message: 'zodError.common.iaData.title.required'
        })
        .min(3, { message: 'zodError.common.iaData.title.min' })
        .max(200, { message: 'zodError.common.iaData.title.max' }),

    content: z
        .string({
            message: 'zodError.common.iaData.content.required'
        })
        .min(10, { message: 'zodError.common.iaData.content.min' })
        .max(2000, { message: 'zodError.common.iaData.content.max' }),

    category: z
        .string({
            message: 'zodError.common.iaData.category.required'
        })
        .min(2, { message: 'zodError.common.iaData.category.min' })
        .max(100, { message: 'zodError.common.iaData.category.max' })
        .optional()
});

/**
 * Type exports for the base IA Data schema
 */
export type BaseIaData = z.infer<typeof BaseIaDataSchema>;

// ----------------------------------------------------------------------------
// Reusable IA payload schemas (for command inputs)
// ----------------------------------------------------------------------------

/**
 * IA data creation payload schema: only the core IA data fields without audit/lifecycle/admin fields
 */
export const IaDataCreatePayloadSchema = BaseIaDataSchema.pick({
    title: true,
    content: true,
    category: true
});

/**
 * IA data update payload schema: partial of the create payload
 */
export const IaDataUpdatePayloadSchema = IaDataCreatePayloadSchema.partial();

export type IaDataCreatePayload = z.infer<typeof IaDataCreatePayloadSchema>;
export type IaDataUpdatePayload = z.infer<typeof IaDataUpdatePayloadSchema>;
