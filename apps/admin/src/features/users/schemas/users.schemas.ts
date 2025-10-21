import {
    AdminActivityExtensionSchema,
    AdminStatusExtensionSchema,
    AdminTagsExtensionSchema
} from '@/shared/schemas';
import { UserListItemWithCountsSchema, UserSchema } from '@repo/schemas';
import type { z } from 'zod';

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

// Re-export main schema
export { UserSchema };

/**
 * Type for user list items with admin extensions
 */
export type User = z.infer<typeof UserListItemSchema>;
