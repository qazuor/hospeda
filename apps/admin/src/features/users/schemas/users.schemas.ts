import {
    AdminActivityExtensionSchema,
    AdminStatusExtensionSchema,
    AdminTagsExtensionSchema
} from '@/shared/schemas';
import { UserListItemWithCountsSchema, UserSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Extended user list item schema for admin compatibility
 *
 * Extensions:
 * - Admin status fields: Uses AdminStatusExtensionSchema
 * - Admin activity fields: Uses AdminActivityExtensionSchema
 * - Admin tags: Uses AdminTagsExtensionSchema
 */
export const UserListItemSchema = UserListItemWithCountsSchema.extend(
    AdminStatusExtensionSchema.shape
)
    .extend(AdminActivityExtensionSchema.shape)
    .extend(AdminTagsExtensionSchema.shape);

// Admin-specific schema with computed fields for handling nested data
export const UserListItemWithComputedFieldsSchema = UserListItemSchema.extend({
    primaryEmail: z.string().optional(),
    locationCity: z.string().optional(),
    accommodationsCount: z.number().optional(),
    eventsCount: z.number().optional(),
    postsCount: z.number().optional()
}).transform((data) => ({
    ...data,
    primaryEmail: data.contactInfo?.personalEmail || data.contactInfo?.workEmail || undefined,
    locationCity: data.location?.city || undefined,
    accommodationsCount: data.accommodationsCount || 0,
    eventsCount: data.eventsCount || 0,
    postsCount: data.postsCount || 0
}));

// Re-export main schema
export { UserSchema };

/**
 * Type for user list items with admin extensions and computed fields
 */
export type User = z.infer<typeof UserListItemWithComputedFieldsSchema>;
