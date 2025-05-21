/**
 * API service for communicating with the Hospeda API
 * @module api
 */

/**
 * Base URL for the API
 */
const API_URL = import.meta.env.ASTRO_API_URL || 'http://localhost:3000';

/**
 * Default pagination parameters
 */
const DEFAULT_PARAMS = {
    page: 1,
    limit: 20
};

/**
 * API response with pagination metadata
 */
interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasMore: boolean;
    };
    error?: {
        code: string;
        message: string;
        details?: unknown[];
    };
}

/**
 * Parameters for fetching resources
 */
interface FetchParams {
    page?: number;
    limit?: number;
    query?: string;
    destinationId?: string;
    isFeatured?: boolean;
    orderBy?: string;
    order?: 'asc' | 'desc';
    [key: string]: unknown;
}

/**
 * Builds a query string from parameters
 * @param params - Object containing query parameters
 * @returns Formatted query string
 */
const buildQueryString = (params: Record<string, unknown>): string => {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
};

/**
 * Makes a GET request to the API
 * @param endpoint - API endpoint
 * @param params - Query parameters
 * @returns Promise with the response data
 */
async function get<T>(endpoint: string, params: FetchParams = {}): Promise<ApiResponse<T>> {
    const mergedParams = { ...DEFAULT_PARAMS, ...params };
    const queryString = buildQueryString(mergedParams);
    const url = `${API_URL}${endpoint}${queryString}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as ApiResponse<T>;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

/**
 * API functions for accommodations
 */
export const accommodationsApi = {
    /**
     * Fetches all accommodations
     * @param params - Query parameters
     * @returns Promise with accommodations data
     */
    getAll: (params?: FetchParams) => get('/api/v1/public/accommodations', params),

    /**
     * Fetches an accommodation by ID
     * @param id - Accommodation ID
     * @returns Promise with accommodation data
     */
    getById: (id: string) => get(`/api/v1/public/accommodations/${id}`),

    /**
     * Fetches featured accommodations
     * @param params - Query parameters
     * @returns Promise with featured accommodations data
     */
    getFeatured: (params?: FetchParams) => get('/api/v1/public/accommodations/featured', params),

    /**
     * Fetches accommodations by destination
     * @param destinationId - Destination ID
     * @param params - Query parameters
     * @returns Promise with accommodations data
     */
    getByDestination: (destinationId: string, params?: FetchParams) =>
        get(`/api/v1/public/accommodations/destination/${destinationId}`, params)
};

/**
 * API functions for destinations
 */
export const destinationsApi = {
    /**
     * Fetches all destinations
     * @param params - Query parameters
     * @returns Promise with destinations data
     */
    getAll: (params?: FetchParams) => get('/api/v1/public/destinations', params),

    /**
     * Fetches a destination by ID
     * @param id - Destination ID
     * @returns Promise with destination data
     */
    getById: (id: string) => get(`/api/v1/public/destinations/${id}`),

    /**
     * Fetches featured destinations
     * @param params - Query parameters
     * @returns Promise with featured destinations data
     */
    getFeatured: (params?: FetchParams) => get('/api/v1/public/destinations/featured', params),

    /**
     * Fetches top destinations
     * @param limit - Maximum number of destinations to return
     * @returns Promise with top destinations data
     */
    getTop: (limit = 4) => get('/api/v1/public/destinations/top', { limit })
};

/**
 * API functions for events
 */
export const eventsApi = {
    /**
     * Fetches all events
     * @param params - Query parameters
     * @returns Promise with events data
     */
    getAll: (params?: FetchParams) => get('/api/v1/public/events', params),

    /**
     * Fetches an event by ID
     * @param id - Event ID
     * @returns Promise with event data
     */
    getById: (id: string) => get(`/api/v1/public/events/${id}`),

    /**
     * Fetches upcoming events
     * @param params - Query parameters
     * @returns Promise with upcoming events data
     */
    getUpcoming: (params?: FetchParams) => get('/api/v1/public/events/upcoming', params)
};

/**
 * API functions for posts
 */
export const postsApi = {
    /**
     * Fetches all posts
     * @param params - Query parameters
     * @returns Promise with posts data
     */
    getAll: (params?: FetchParams) => get('/api/v1/public/posts', params),

    /**
     * Fetches a post by ID
     * @param id - Post ID
     * @returns Promise with post data
     */
    getById: (id: string) => get(`/api/v1/public/posts/${id}`),

    /**
     * Fetches a post by slug
     * @param slug - Post slug
     * @returns Promise with post data
     */
    getBySlug: (slug: string) => get(`/api/v1/public/posts/slug/${slug}`),

    /**
     * Fetches featured posts
     * @param limit - Maximum number of posts to return
     * @returns Promise with featured posts data
     */
    getFeatured: (limit = 3) => get('/api/v1/public/posts/featured', { limit })
};

/**
 * General search API function
 * @param query - Search query
 * @param types - Types of entities to search for
 * @param limit - Maximum number of results per type
 * @returns Promise with search results
 */
export const search = (
    query: string,
    types: string[] = ['accommodations', 'destinations', 'events', 'posts'],
    limit = 5
) => {
    return get('/api/v1/public/search', { q: query, types, limit });
};

export default {
    accommodations: accommodationsApi,
    destinations: destinationsApi,
    events: eventsApi,
    posts: postsApi,
    search
};
