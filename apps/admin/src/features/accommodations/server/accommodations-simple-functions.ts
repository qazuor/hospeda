/**
 * @file Simple Accommodations Server Functions
 *
 * Simplified server functions that work directly with TanStack Start
 * without complex abstractions.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { fetchApi } from '../../../lib/api/client';
import { adminLogger } from '../../../utils/logger';
import {
    type Accommodation,
    createAccommodationSchema,
    updateAccommodationSchema
} from './accommodations-server.config';

/**
 * Server function result types - simplified to avoid TanStack Start type conflicts
 */
// biome-ignore lint/suspicious/noExplicitAny: Simplified types to avoid TanStack Start conflicts
type ServerFunctionResult = any;

/**
 * Get accommodation by ID
 */
export const getAccommodationSimple = createServerFn()
    .validator(z.object({ id: z.string().uuid() }))
    .handler(async ({ data }) => {
        try {
            adminLogger.log(`Fetching accommodation: ${data.id}`);

            const response = await fetchApi<Accommodation>({
                path: `/api/accommodations/${data.id}`,
                method: 'GET'
            });

            // Return response data directly (validation handled by API)
            return {
                success: true,
                data: response.data,
                meta: {
                    timestamp: new Date().toISOString()
                }
            } as ServerFunctionResult;
        } catch (error) {
            adminLogger.error(error, `Failed to fetch accommodation: ${data.id}`);

            return {
                success: false,
                error: {
                    code: 'FETCH_ERROR',
                    message:
                        error instanceof Error ? error.message : 'Failed to fetch accommodation'
                }
            } as ServerFunctionResult;
        }
    });

/**
 * List accommodations with pagination
 */
export const listAccommodationsSimple = createServerFn()
    .validator(
        z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(100).default(20),
            sort: z.string().optional(),
            order: z.enum(['asc', 'desc']).default('desc'),
            search: z.string().optional(),
            filters: z.record(z.unknown()).optional()
        })
    )
    .handler(async ({ data }) => {
        try {
            adminLogger.log('Fetching accommodations list', JSON.stringify(data));

            // Build query parameters
            const queryParams = new URLSearchParams();
            queryParams.set('page', data.page.toString());
            queryParams.set('limit', data.limit.toString());

            if (data.sort) queryParams.set('sort', data.sort);
            queryParams.set('order', data.order);
            if (data.search) queryParams.set('search', data.search);

            // Add filters
            if (data.filters) {
                for (const [key, value] of Object.entries(data.filters)) {
                    if (value !== undefined && value !== null) {
                        queryParams.set(`filter[${key}]`, String(value));
                    }
                }
            }

            const endpoint = `/api/accommodations?${queryParams.toString()}`;
            const response = await fetchApi<{
                data: Accommodation[];
                pagination: {
                    page: number;
                    limit: number;
                    total: number;
                    totalPages: number;
                };
            }>({
                path: endpoint,
                method: 'GET'
            });

            // Return response data directly (validation handled by API)
            return {
                success: true,
                data: {
                    data: response.data.data,
                    pagination: response.data.pagination
                },
                meta: {
                    timestamp: new Date().toISOString()
                }
            } as ServerFunctionResult;
        } catch (error) {
            adminLogger.error(error, 'Failed to fetch accommodations list');

            return {
                success: false,
                error: {
                    code: 'FETCH_ERROR',
                    message:
                        error instanceof Error ? error.message : 'Failed to fetch accommodations'
                }
            } as ServerFunctionResult;
        }
    });

/**
 * Create new accommodation
 */
export const createAccommodationSimple = createServerFn()
    .validator(z.object({ data: createAccommodationSchema }))
    .handler(async ({ data: { data: accommodationData } }) => {
        try {
            adminLogger.log('Creating accommodation', JSON.stringify(accommodationData));

            const response = await fetchApi<Accommodation>({
                path: '/api/accommodations',
                method: 'POST',
                body: accommodationData
            });

            // Return response data directly (validation handled by API)
            return {
                success: true,
                data: response.data,
                meta: {
                    timestamp: new Date().toISOString()
                }
            } as ServerFunctionResult;
        } catch (error) {
            adminLogger.error(error, 'Failed to create accommodation');

            return {
                success: false,
                error: {
                    code: 'CREATE_ERROR',
                    message:
                        error instanceof Error ? error.message : 'Failed to create accommodation'
                }
            } as ServerFunctionResult;
        }
    });

/**
 * Update accommodation
 */
export const updateAccommodationSimple = createServerFn()
    .validator(
        z.object({
            id: z.string().uuid(),
            data: updateAccommodationSchema
        })
    )
    .handler(async ({ data: { id, data: accommodationData } }) => {
        try {
            adminLogger.log(`Updating accommodation: ${id}`, JSON.stringify(accommodationData));

            const response = await fetchApi<Accommodation>({
                path: `/api/accommodations/${id}`,
                method: 'PUT',
                body: accommodationData
            });

            // Return response data directly (validation handled by API)
            return {
                success: true,
                data: response.data,
                meta: {
                    timestamp: new Date().toISOString()
                }
            } as ServerFunctionResult;
        } catch (error) {
            adminLogger.error(error, `Failed to update accommodation: ${id}`);

            return {
                success: false,
                error: {
                    code: 'UPDATE_ERROR',
                    message:
                        error instanceof Error ? error.message : 'Failed to update accommodation'
                }
            } as ServerFunctionResult;
        }
    });

/**
 * Delete accommodation
 */
export const deleteAccommodationSimple = createServerFn()
    .validator(z.object({ id: z.string().uuid() }))
    .handler(async ({ data }) => {
        try {
            adminLogger.log(`Deleting accommodation: ${data.id}`);

            await fetchApi({
                path: `/api/accommodations/${data.id}`,
                method: 'DELETE'
            });

            return {
                success: true as const,
                data: { id: data.id },
                meta: {
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            adminLogger.error(error, `Failed to delete accommodation: ${data.id}`);

            return {
                success: false,
                error: {
                    code: 'DELETE_ERROR',
                    message:
                        error instanceof Error ? error.message : 'Failed to delete accommodation'
                }
            } as ServerFunctionResult;
        }
    });
