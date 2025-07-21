import { z } from 'zod';
import { AdminInfoSchema } from '../../common/admin.schema.js';
import { IdSchema, UserIdSchema } from '../../common/id.schema.js';
import { AmenitiesTypeEnumSchema, LifecycleStatusEnumSchema } from '../../enums/index.js';

/**
 * Note: The AmenitySchema is defined by explicitly listing all properties instead of merging
 * helper schemas (e.g., WithIdSchema, WithAuditSchema). This approach is a deliberate
 * architectural choice to prevent circular dependency issues that can arise in testing
 * frameworks like Vitest. By flattening the structure, we ensure stable and
 * predictable module resolution during tests.
 */
export const AmenitySchema = z.object({
    // From WithIdSchema
    id: IdSchema,

    // From WithAuditSchema
    createdAt: z.coerce.date({
        required_error: 'zodError.common.createdAt.required',
        invalid_type_error: 'zodError.common.createdAt.invalidType'
    }),
    updatedAt: z.coerce.date({
        required_error: 'zodError.common.updatedAt.required',
        invalid_type_error: 'zodError.common.updatedAt.invalidType'
    }),
    createdById: UserIdSchema,
    updatedById: UserIdSchema,
    deletedAt: z.coerce
        .date({
            required_error: 'zodError.common.deletedAt.required',
            invalid_type_error: 'zodError.common.deletedAt.invalidType'
        })
        .optional(),
    deletedById: UserIdSchema.optional(),

    // From WithLifecycleStateSchema
    lifecycleState: LifecycleStatusEnumSchema,

    // From WithAdminInfoSchema
    adminInfo: AdminInfoSchema.optional(),

    // Own Properties
    slug: z
        .string()
        .min(3, { message: 'zodError.amenity.slug.min' })
        .max(100, { message: 'zodError.amenity.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'zodError.amenity.slug.format' })
        .optional(),
    name: z
        .string()
        .min(2, { message: 'zodError.amenity.name.min' })
        .max(100, { message: 'zodError.amenity.name.max' }),
    description: z
        .string()
        .min(10, { message: 'zodError.amenity.description.min' })
        .max(300, { message: 'zodError.amenity.description.max' })
        .optional(),
    icon: z
        .string()
        .min(2, { message: 'zodError.amenity.icon.min' })
        .max(100, { message: 'zodError.amenity.icon.max' })
        .optional(),
    isBuiltin: z.boolean({ required_error: 'zodError.amenity.isBuiltin.required' }),
    isFeatured: z.boolean().optional().default(false),
    type: AmenitiesTypeEnumSchema
});
