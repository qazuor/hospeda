import { UserListItemWithCountsSchema, UserSchema } from '@repo/schemas';
import { z } from 'zod';
import {
    AdminActivityExtensionSchema,
    AdminStatusExtensionSchema,
    AdminTagsExtensionSchema
} from '@/shared/schemas';

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
    locationCity: z.string().optional(),
    accommodationsCount: z.number().optional(),
    gastronomiesCount: z.number().optional(),
    experiencesCount: z.number().optional(),
    eventsCount: z.number().optional(),
    postsCount: z.number().optional(),
    currentPlanSlug: z.string().nullable().optional()
}).transform((data) => ({
    ...data,
    locationCity: data.location?.city || undefined,
    accommodationsCount: data.accommodationsCount || 0,
    gastronomiesCount: data.gastronomiesCount || 0,
    experiencesCount: data.experiencesCount || 0,
    eventsCount: data.eventsCount || 0,
    postsCount: data.postsCount || 0,
    currentPlanSlug: data.currentPlanSlug ?? null
}));

// Re-export main schema
export { UserSchema };

/**
 * Type for user list items with admin extensions and computed fields
 */
export type User = z.infer<typeof UserListItemWithComputedFieldsSchema>;
