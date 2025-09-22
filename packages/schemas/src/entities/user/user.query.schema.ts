import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { RoleEnumSchema } from '../../enums/index.js';
import { UserSchema } from './user.schema.js';

/**
 * User Query Schemas - Standardized Implementation
 *
 * This file contains all schemas related to querying users following the unified standard:
 * - Pagination: page/pageSize pattern
 * - Sorting: sortBy/sortOrder with 'asc'/'desc' values
 * - Search: 'q' field for text search
 * - Filters: entity-specific filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for user-specific filters
 */
export const UserFiltersSchema = z.object({
    // Basic filters
    role: RoleEnumSchema.optional(),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    lastLoginAfter: z.date().optional(),
    lastLoginBefore: z.date().optional(),

    // Location filters
    country: z.string().length(2).optional(),

    // Age range filters
    minAge: z.number().int().min(13).max(120).optional(),
    maxAge: z.number().int().min(13).max(120).optional(),

    // Tags filter
    tags: z.array(z.string().uuid()).optional(),

    // Subscription status
    hasActiveSubscription: z.boolean().optional(),

    // Accommodation ownership
    hasAccommodations: z.boolean().optional()
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Standard user search schema
 */
export const UserSearchSchema = BaseSearchSchema.extend({
    // Entity-specific filters
    role: RoleEnumSchema.optional(),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    lastLoginAfter: z.date().optional(),
    lastLoginBefore: z.date().optional(),
    country: z.string().length(2).optional(),
    minAge: z.number().int().min(13).max(120).optional(),
    maxAge: z.number().int().min(13).max(120).optional(),
    tags: z.array(z.string().uuid()).optional(),
    hasActiveSubscription: z.boolean().optional(),
    hasAccommodations: z.boolean().optional()
});

/**
 * Standard user search result schema
 */
export const UserSearchResultSchema = PaginationResultSchema(UserSchema);

// ============================================================================
// LIST ITEM SCHEMA
// ============================================================================

/**
 * Schema for user list items (public-safe fields)
 */
export const UserListItemSchema = UserSchema.pick({
    id: true,
    displayName: true,
    firstName: true,
    lastName: true,
    role: true,
    lifecycleState: true,
    contactInfo: true,
    profile: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for user summary (essential fields only)
 */
export const UserSummarySchema = UserSchema.pick({
    id: true,
    displayName: true,
    firstName: true,
    lastName: true,
    profile: true,
    role: true,
    lifecycleState: true,
    createdAt: true
});

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export type UserFilters = z.infer<typeof UserFiltersSchema>;
export type UserSearch = z.infer<typeof UserSearchSchema>;
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
export type UserListItem = z.infer<typeof UserListItemSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Legacy schema aliases for backward compatibility with .type.ts files
export const UserListInputSchema = UserSearchSchema;
export const UserListOutputSchema = UserSearchResultSchema;
export const UserSearchInputSchema = UserSearchSchema;
export const UserSearchOutputSchema = UserSearchResultSchema;

// Additional missing legacy exports
export const UserListItemWithCountsSchema = UserListItemSchema.extend({
    accommodationsCount: z.number().int().min(0).default(0),
    reviewsCount: z.number().int().min(0).default(0),
    bookingsCount: z.number().int().min(0).default(0),
    eventsCount: z.number().int().min(0).default(0)
});

export const UserListWithCountsOutputSchema = PaginationResultSchema(UserListItemWithCountsSchema);

export const UserStatsSchema = z.object({
    totalUsers: z.number().int().min(0).default(0),
    activeUsers: z.number().int().min(0).default(0),
    verifiedUsers: z.number().int().min(0).default(0),
    hostUsers: z.number().int().min(0).default(0),
    guestUsers: z.number().int().min(0).default(0),
    usersByRole: z.record(z.string(), z.number().int().min(0)).optional(),
    newUsersThisMonth: z.number().int().min(0).default(0),
    averageSessionDuration: z.number().min(0).optional()
});
