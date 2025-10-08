import type { User as UserFromSchema } from '@repo/schemas';
import { UserListItemWithCountsSchema, UserSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * MIGRATION NOTE: Previously contained 45+ lines of duplicated UserListItemSchema.
 * Now using @repo/schemas as single source of truth.
 */

// Use UserListItemWithCountsSchema as it includes admin-specific count fields
export const UserListItemSchema = UserListItemWithCountsSchema.extend({
    // Add any legacy fields for backward compatibility if needed
    email: z.string().email().optional(), // Extract email from contactInfo
    username: z.string().optional(), // Username as alias
    avatar: z.string().url().optional(), // Extract avatar from profile

    // Legacy count fields with different names (for compatibility)
    accommodationCount: z.number().optional(),
    likesCount: z.number().optional(),
    followersCount: z.number().optional(),
    followingCount: z.number().optional(),
    postsCount: z.number().optional(),

    // Additional admin fields
    isEmailVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
    lastLoginAt: z.string().optional(),
    tags: z.array(z.string()).optional()
});

// Re-export main schema
export { UserSchema };

/**
 * User type - using explicit type for compatibility
 */
export type User = UserFromSchema & {
    // Admin-specific extensions
    email?: string;
    username?: string;
    avatar?: string;
    accommodationCount?: number;
    likesCount?: number;
    followersCount?: number;
    followingCount?: number;
    postsCount?: number;
    isEmailVerified?: boolean;
    isActive?: boolean;
    lastLoginAt?: string;
    tags?: string[];
};
