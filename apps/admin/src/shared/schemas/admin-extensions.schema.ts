import { z } from 'zod';

/**
 * Admin Management Extensions Schema
 *
 * Common admin-specific fields used across different entity types.
 * These fields are specific to admin operations and not part of the core entity.
 */

/**
 * Admin Status Extension Schema
 *
 * Fields for tracking admin-specific status and verification states.
 */
export const AdminStatusExtensionSchema = z.object({
    isEmailVerified: z.boolean().optional(),
    isPhoneVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isPromoted: z.boolean().optional()
});

/**
 * Admin Activity Extension Schema
 *
 * Fields for tracking admin-relevant activity and timestamps.
 */
export const AdminActivityExtensionSchema = z.object({
    lastLoginAt: z.string().optional(),
    lastActivityAt: z.string().optional(),
    lastUpdatedByAdmin: z.string().optional(),
    adminNotes: z.string().optional()
});

/**
 * Admin Tags Extension Schema
 *
 * Flexible tagging system for admin organization.
 */
export const AdminTagsExtensionSchema = z.object({
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    flags: z.array(z.string()).optional()
});

/**
 * Combined Admin Extensions Schema
 *
 * Combines all admin extensions for entities that need full admin capabilities.
 */
export const FullAdminExtensionSchema = AdminStatusExtensionSchema.merge(
    AdminActivityExtensionSchema
).merge(AdminTagsExtensionSchema);

// Type exports
export type AdminStatusExtension = z.infer<typeof AdminStatusExtensionSchema>;
export type AdminActivityExtension = z.infer<typeof AdminActivityExtensionSchema>;
export type AdminTagsExtension = z.infer<typeof AdminTagsExtensionSchema>;
export type FullAdminExtension = z.infer<typeof FullAdminExtensionSchema>;
