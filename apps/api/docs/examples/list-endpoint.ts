/**
 * Paginated List Endpoint Example
 *
 * This example shows how to create a paginated list endpoint
 * with advanced filtering and search capabilities
 */

import { accommodationSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createListRoute } from '../../src/utils/route-factory';

// Advanced search schema with multiple filters
const advancedSearchSchema = z.object({
    // Text search
    search: z.string().optional(),

    // Location filters
    city: z.string().optional(),
    province: z.string().optional(),
    country: z.string().optional(),

    // Price range
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),

    // Status filter
    isActive: z.coerce.boolean().optional(),

    // Sorting
    sortBy: z.enum(['name', 'price', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),

    // Date range
    createdAfter: z.string().datetime().optional(),
    createdBefore: z.string().datetime().optional()
});

export const advancedListRoute = createListRoute({
    method: 'get',
    path: '/search',
    summary: 'Advanced accommodation search',
    description: 'Search accommodations with advanced filtering',
    tags: ['Accommodations'],
    querySchema: advancedSearchSchema.optional(),
    responseSchema: z.array(accommodationSchema),
    handler: async (c: Context, _params, _body, query) => {
        const service = new AccommodationService(c);

        // Build filter object from query params
        const filters = {
            search: query?.search,
            city: query?.city,
            province: query?.province,
            country: query?.country,
            minPrice: query?.minPrice,
            maxPrice: query?.maxPrice,
            isActive: query?.isActive,
            sortBy: query?.sortBy,
            sortOrder: query?.sortOrder,
            createdAfter: query?.createdAfter,
            createdBefore: query?.createdBefore,
            // Pagination params automatically included
            page: query?.page || 1,
            pageSize: query?.pageSize || 10
        };

        const result = await service.findAll(filters);

        // Return paginated response
        return {
            data: result.data,
            pagination: result.pagination
        };
    },
    options: {
        skipAuth: true,
        cacheTTL: 60 // Cache for 1 minute (shorter for search results)
    }
});

// Simple list endpoint
export const simpleListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations',
    description: 'Returns all accommodations with basic pagination',
    tags: ['Accommodations'],
    responseSchema: z.array(accommodationSchema),
    handler: async (c: Context) => {
        const service = new AccommodationService(c);
        const result = await service.findAll();

        return {
            data: result.data,
            pagination: result.pagination
        };
    },
    options: { skipAuth: true }
});
