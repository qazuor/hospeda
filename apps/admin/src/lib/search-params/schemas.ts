import { z } from 'zod';

/**
 * Search parameter validation schemas
 * Provides type-safe search parameter handling for TanStack Router
 */

/**
 * Base search parameters that are common across entity pages
 */
export const baseEntitySearchSchema = z.object({
    /**
     * Current active tab
     */
    tab: z.enum(['details', 'relations', 'history', 'settings']).optional(),

    /**
     * Whether the entity is in edit mode
     */
    edit: z.boolean().optional(),

    /**
     * Current section within a tab (for deep linking)
     */
    section: z.string().optional(),

    /**
     * Layout preference for the entity view
     */
    layout: z.enum(['card', 'table', 'grid', 'auto']).optional(),

    /**
     * Whether to show debug information
     */
    debug: z.boolean().optional()
});

/**
 * Search parameters for entity list pages
 */
export const entityListSearchSchema = z.object({
    /**
     * Search query string
     */
    search: z.string().optional(),

    /**
     * Current page number (1-based)
     */
    page: z.coerce.number().int().min(1).optional(),

    /**
     * Number of items per page
     */
    limit: z.coerce.number().int().min(1).max(100).optional(),

    /**
     * Sort field and direction
     */
    sort: z.string().optional(),

    /**
     * Sort direction
     */
    order: z.enum(['asc', 'desc']).optional(),

    /**
     * Filter parameters (generic object for flexibility)
     */
    filters: z.record(z.string(), z.unknown()).optional(),

    /**
     * View mode for the list
     */
    view: z.enum(['table', 'grid', 'card', 'auto']).optional(),

    /**
     * Whether to show archived items
     */
    archived: z.boolean().optional(),

    /**
     * Selected items (for bulk operations)
     */
    selected: z.array(z.string()).optional()
});

/**
 * Search parameters for entity detail pages
 */
export const entityDetailSearchSchema = baseEntitySearchSchema.extend({
    /**
     * Specific relation to highlight or expand
     */
    relation: z.string().optional(),

    /**
     * Whether to show the entity in a modal/overlay
     */
    modal: z.boolean().optional(),

    /**
     * Return URL for navigation after actions
     */
    returnTo: z.string().optional(),

    /**
     * Highlight specific field or section
     */
    highlight: z.string().optional()
});

/**
 * Search parameters for dashboard pages
 */
export const dashboardSearchSchema = z.object({
    /**
     * Time range for metrics and data
     */
    timeRange: z.enum(['1h', '24h', '7d', '30d', '90d', '1y']).optional(),

    /**
     * Active dashboard tab
     */
    tab: z.enum(['overview', 'analytics', 'reports', 'settings']).optional(),

    /**
     * Refresh interval in seconds
     */
    refresh: z.coerce.number().int().min(0).max(300).optional(),

    /**
     * Filters for dashboard data
     */
    filters: z.record(z.string(), z.unknown()).optional()
});

/**
 * Search parameters for authentication pages
 */
export const authSearchSchema = z.object({
    /**
     * Redirect URL after successful authentication
     */
    redirect: z.string().optional(),

    /**
     * Error message to display
     */
    error: z.string().optional(),

    /**
     * Success message to display
     */
    success: z.string().optional(),

    /**
     * Authentication flow step
     */
    step: z.enum(['signin', 'signup', 'forgot', 'reset', 'verify']).optional()
});

/**
 * Utility type to extract search params type from schema
 */
export type SearchParamsFromSchema<T extends z.ZodSchema> = z.infer<T>;

/**
 * Type definitions for each search schema
 */
export type BaseEntitySearch = SearchParamsFromSchema<typeof baseEntitySearchSchema>;
export type EntityListSearch = SearchParamsFromSchema<typeof entityListSearchSchema>;
export type EntityDetailSearch = SearchParamsFromSchema<typeof entityDetailSearchSchema>;
export type DashboardSearch = SearchParamsFromSchema<typeof dashboardSearchSchema>;
export type AuthSearch = SearchParamsFromSchema<typeof authSearchSchema>;

/**
 * Default values for search parameters
 */
export const defaultEntityListSearch: Partial<EntityListSearch> = {
    page: 1,
    limit: 20,
    view: 'auto',
    order: 'desc',
    archived: false
};

export const defaultEntityDetailSearch: Partial<EntityDetailSearch> = {
    tab: 'details',
    edit: false,
    layout: 'auto',
    debug: false
};

export const defaultDashboardSearch: Partial<DashboardSearch> = {
    timeRange: '7d',
    tab: 'overview',
    refresh: 30
};

/**
 * Utility function to merge search params with defaults
 */
export const mergeWithDefaults = <T extends Record<string, unknown>>(
    searchParams: Partial<T>,
    defaults: Partial<T>
): T => {
    return { ...defaults, ...searchParams } as T;
};

/**
 * Validation helper that returns parsed params or defaults on error
 */
export const safeParseSearchParams = <T extends z.ZodSchema>(
    schema: T,
    searchParams: unknown,
    defaults: Partial<z.infer<T>> = {}
): z.infer<T> => {
    const result = schema.safeParse(searchParams);

    if (result.success) {
        return mergeWithDefaults(result.data, defaults);
    }

    // Log validation errors in development
    if (process.env.NODE_ENV === 'development') {
        console.warn('Search params validation failed:', result.error.issues);
    }

    return defaults as z.infer<T>;
};
