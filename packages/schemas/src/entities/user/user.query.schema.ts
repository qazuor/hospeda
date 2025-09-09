import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { RoleEnumSchema } from '../../enums/index.js';
import { UserSchema } from './user.schema.js';

/**
 * User Query Schemas
 *
 * This file contains all schemas related to querying users:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Summary
 * - Stats
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for user-specific filters
 * Used in list and search operations
 */
export const UserFiltersSchema = z.object({
    // Basic filters
    role: RoleEnumSchema.optional(),
    isActive: z
        .boolean({
            message: 'zodError.user.filters.isActive.invalidType'
        })
        .optional(),

    isEmailVerified: z
        .boolean({
            message: 'zodError.user.filters.isEmailVerified.invalidType'
        })
        .optional(),

    // Date filters
    createdAfter: z
        .date({
            message: 'zodError.user.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.user.filters.createdBefore.invalidType'
        })
        .optional(),

    lastLoginAfter: z
        .date({
            message: 'zodError.user.filters.lastLoginAfter.invalidType'
        })
        .optional(),

    lastLoginBefore: z
        .date({
            message: 'zodError.user.filters.lastLoginBefore.invalidType'
        })
        .optional(),

    // Location filters
    country: z
        .string({
            message: 'zodError.user.filters.country.invalidType'
        })
        .min(2, { message: 'zodError.user.filters.country.min' })
        .max(2, { message: 'zodError.user.filters.country.max' })
        .optional(),

    // Age range filters
    minAge: z
        .number({
            message: 'zodError.user.filters.minAge.invalidType'
        })
        .int({ message: 'zodError.user.filters.minAge.int' })
        .min(13, { message: 'zodError.user.filters.minAge.min' })
        .max(120, { message: 'zodError.user.filters.minAge.max' })
        .optional(),

    maxAge: z
        .number({
            message: 'zodError.user.filters.maxAge.invalidType'
        })
        .int({ message: 'zodError.user.filters.maxAge.int' })
        .min(13, { message: 'zodError.user.filters.maxAge.min' })
        .max(120, { message: 'zodError.user.filters.maxAge.max' })
        .optional(),

    // Tags filter
    tags: z.array(z.string().uuid({ message: 'zodError.user.filters.tags.item.uuid' })).optional(),

    // Subscription status
    hasActiveSubscription: z
        .boolean({
            message: 'zodError.user.filters.hasActiveSubscription.invalidType'
        })
        .optional(),

    // Accommodation ownership
    hasAccommodations: z
        .boolean({
            message: 'zodError.user.filters.hasAccommodations.invalidType'
        })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for user list input parameters
 * Includes pagination and filters
 */
export const UserListInputSchema = PaginationSchema.extend({
    filters: UserFiltersSchema.optional()
});

/**
 * Schema for individual user items in lists
 * Contains essential fields for list display (excludes sensitive data)
 */
export const UserListItemSchema = UserSchema.pick({
    id: true,
    email: true,
    displayName: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    isEmailVerified: true,
    profilePicture: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for user list output
 * Uses generic paginated response with list items
 */
export const UserListOutputSchema = z.object({
    items: z.array(UserListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    })
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for user search input parameters
 * Extends base search with user-specific filters
 */
export const UserSearchInputSchema = BaseSearchSchema.extend({
    filters: UserFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.user.search.query.invalidType'
        })
        .min(1, { message: 'zodError.user.search.query.min' })
        .max(100, { message: 'zodError.user.search.query.max' })
        .optional()
});

/**
 * Schema for individual user search results
 * Extends list item with search score
 */
export const UserSearchResultSchema = UserListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.user.search.score.invalidType'
        })
        .min(0, { message: 'zodError.user.search.score.min' })
        .max(1, { message: 'zodError.user.search.score.max' })
        .optional()
});

/**
 * Schema for user search output
 * Uses generic paginated response with search results
 */
export const UserSearchOutputSchema = z.object({
    items: z.array(UserSearchResultSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    searchInfo: z
        .object({
            query: z.string().optional(),
            executionTime: z.number().min(0).optional(),
            totalResults: z.number().min(0)
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for user summary
 * Contains essential information for quick display (public safe)
 */
export const UserSummarySchema = UserSchema.pick({
    id: true,
    displayName: true,
    firstName: true,
    lastName: true,
    profilePicture: true,
    role: true,
    isActive: true,
    createdAt: true
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for user statistics
 * Contains metrics and analytics data
 */
export const UserStatsSchema = z.object({
    // Account statistics
    totalUsers: z
        .number({
            message: 'zodError.user.stats.totalUsers.invalidType'
        })
        .int({ message: 'zodError.user.stats.totalUsers.int' })
        .min(0, { message: 'zodError.user.stats.totalUsers.min' })
        .default(0),

    activeUsers: z
        .number({
            message: 'zodError.user.stats.activeUsers.invalidType'
        })
        .int({ message: 'zodError.user.stats.activeUsers.int' })
        .min(0, { message: 'zodError.user.stats.activeUsers.min' })
        .default(0),

    verifiedUsers: z
        .number({
            message: 'zodError.user.stats.verifiedUsers.invalidType'
        })
        .int({ message: 'zodError.user.stats.verifiedUsers.int' })
        .min(0, { message: 'zodError.user.stats.verifiedUsers.min' })
        .default(0),

    // Role distribution
    roleDistribution: z
        .object({
            superAdmin: z.number().int().min(0).default(0),
            admin: z.number().int().min(0).default(0),
            moderator: z.number().int().min(0).default(0),
            host: z.number().int().min(0).default(0),
            guest: z.number().int().min(0).default(0)
        })
        .optional(),

    // Registration statistics
    newUsersToday: z
        .number({
            message: 'zodError.user.stats.newUsersToday.invalidType'
        })
        .int({ message: 'zodError.user.stats.newUsersToday.int' })
        .min(0, { message: 'zodError.user.stats.newUsersToday.min' })
        .default(0),

    newUsersThisWeek: z
        .number({
            message: 'zodError.user.stats.newUsersThisWeek.invalidType'
        })
        .int({ message: 'zodError.user.stats.newUsersThisWeek.int' })
        .min(0, { message: 'zodError.user.stats.newUsersThisWeek.min' })
        .default(0),

    newUsersThisMonth: z
        .number({
            message: 'zodError.user.stats.newUsersThisMonth.invalidType'
        })
        .int({ message: 'zodError.user.stats.newUsersThisMonth.int' })
        .min(0, { message: 'zodError.user.stats.newUsersThisMonth.min' })
        .default(0),

    // Activity statistics
    usersLoggedInToday: z
        .number({
            message: 'zodError.user.stats.usersLoggedInToday.invalidType'
        })
        .int({ message: 'zodError.user.stats.usersLoggedInToday.int' })
        .min(0, { message: 'zodError.user.stats.usersLoggedInToday.min' })
        .default(0),

    usersLoggedInThisWeek: z
        .number({
            message: 'zodError.user.stats.usersLoggedInThisWeek.invalidType'
        })
        .int({ message: 'zodError.user.stats.usersLoggedInThisWeek.int' })
        .min(0, { message: 'zodError.user.stats.usersLoggedInThisWeek.min' })
        .default(0),

    // Content statistics
    usersWithAccommodations: z
        .number({
            message: 'zodError.user.stats.usersWithAccommodations.invalidType'
        })
        .int({ message: 'zodError.user.stats.usersWithAccommodations.int' })
        .min(0, { message: 'zodError.user.stats.usersWithAccommodations.min' })
        .default(0),

    usersWithSubscriptions: z
        .number({
            message: 'zodError.user.stats.usersWithSubscriptions.invalidType'
        })
        .int({ message: 'zodError.user.stats.usersWithSubscriptions.int' })
        .min(0, { message: 'zodError.user.stats.usersWithSubscriptions.min' })
        .default(0),

    // Geographic distribution
    topCountries: z
        .array(
            z.object({
                country: z.string(),
                userCount: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserFilters = z.infer<typeof UserFiltersSchema>;
export type UserListInput = z.infer<typeof UserListInputSchema>;
export type UserListItem = z.infer<typeof UserListItemSchema>;
export type UserListOutput = z.infer<typeof UserListOutputSchema>;
export type UserSearchInput = z.infer<typeof UserSearchInputSchema>;
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
export type UserSearchOutput = z.infer<typeof UserSearchOutputSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type UserStats = z.infer<typeof UserStatsSchema>;
