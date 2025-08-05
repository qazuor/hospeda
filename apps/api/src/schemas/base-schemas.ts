import { z } from '@hono/zod-openapi';

/**
 * Base schemas for common API patterns
 * These schemas can be reused across all endpoints
 */

/**
 * ID parameter schema for path parameters
 */
export const idParamSchema = z.object({
    id: z
        .string()
        .uuid({ message: 'zodError.common.id.invalid_uuid' })
        .openapi({
            param: {
                name: 'id',
                in: 'path'
            },
            example: '123e4567-e89b-12d3-a456-426614174000'
        })
});

/**
 * Pagination query parameters schema
 */
export const paginationQuerySchema = z.object({
    page: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.common.pagination.page.min_value' })
        .default(1)
        .openapi({
            param: {
                name: 'page',
                in: 'query'
            },
            example: 1
        }),
    limit: z.coerce
        .number()
        .int()
        .min(1, { message: 'zodError.common.pagination.limit.min_value' })
        .max(100, { message: 'zodError.common.pagination.limit.max_value' })
        .default(20)
        .openapi({
            param: {
                name: 'limit',
                in: 'query'
            },
            example: 20
        }),
    sort: z
        .string()
        .optional()
        .openapi({
            param: {
                name: 'sort',
                in: 'query'
            },
            example: 'createdAt'
        }),
    order: z
        .enum(['asc', 'desc'])
        .default('asc')
        .openapi({
            param: {
                name: 'order',
                in: 'query'
            },
            example: 'asc'
        })
});

/**
 * Search query parameters schema
 */
export const searchQuerySchema = z.object({
    q: z
        .string()
        .min(3, { message: 'zodError.common.search.query.min_length' })
        .max(100, { message: 'zodError.common.search.query.max_length' })
        .openapi({
            param: {
                name: 'q',
                in: 'query'
            },
            example: 'search term'
        }),
    type: z
        .string()
        .optional()
        .openapi({
            param: {
                name: 'type',
                in: 'query'
            },
            example: 'user'
        })
});

/**
 * Combined search and pagination schema
 */
export const searchWithPaginationSchema = searchQuerySchema.merge(paginationQuerySchema);

/**
 * Date range query parameters schema
 */
export const dateRangeQuerySchema = z
    .object({
        startDate: z
            .string()
            .datetime({ message: 'zodError.common.date.start_date.invalid' })
            .openapi({
                param: {
                    name: 'startDate',
                    in: 'query'
                },
                example: '2024-01-01T00:00:00Z'
            }),
        endDate: z
            .string()
            .datetime({ message: 'zodError.common.date.end_date.invalid' })
            .openapi({
                param: {
                    name: 'endDate',
                    in: 'query'
                },
                example: '2024-12-31T23:59:59Z'
            })
    })
    .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
        message: 'zodError.common.date.range.invalid',
        path: ['endDate']
    });

/**
 * Geolocation query parameters schema
 */
export const geolocationQuerySchema = z.object({
    lat: z
        .number()
        .min(-90, { message: 'zodError.common.geolocation.lat.min_value' })
        .max(90, { message: 'zodError.common.geolocation.lat.max_value' })
        .openapi({
            param: {
                name: 'lat',
                in: 'query'
            },
            example: 40.7128
        }),
    lng: z
        .number()
        .min(-180, { message: 'zodError.common.geolocation.lng.min_value' })
        .max(180, { message: 'zodError.common.geolocation.lng.max_value' })
        .openapi({
            param: {
                name: 'lng',
                in: 'query'
            },
            example: -74.006
        }),
    radius: z.coerce
        .number()
        .min(0.1, { message: 'zodError.common.geolocation.radius.min_value' })
        .max(100, { message: 'zodError.common.geolocation.radius.max_value' })
        .default(10)
        .openapi({
            param: {
                name: 'radius',
                in: 'query'
            },
            example: 10
        })
});

/**
 * Language preference query parameter schema
 */
export const languageQuerySchema = z.object({
    lang: z
        .string()
        .regex(/^[a-z]{2}$/, { message: 'zodError.common.language.invalid_format' })
        .default('en')
        .openapi({
            param: {
                name: 'lang',
                in: 'query'
            },
            example: 'en'
        })
});

/**
 * Common field schemas for reuse
 */
export const commonFieldSchemas = {
    email: z.string().email({ message: 'zodError.common.email.invalid' }).openapi({
        example: 'user@example.com'
    }),

    url: z.string().url({ message: 'zodError.common.url.invalid' }).openapi({
        example: 'https://example.com'
    }),

    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, { message: 'zodError.common.phone.invalid' })
        .openapi({
            example: '+1234567890'
        }),

    slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'zodError.common.slug.invalid' })
        .openapi({
            example: 'my-slug-123'
        }),

    uuid: z.string().uuid({ message: 'zodError.common.uuid.invalid' }).openapi({
        example: '123e4567-e89b-12d3-a456-426614174000'
    }),

    latitude: z
        .number()
        .min(-90, { message: 'zodError.common.latitude.min_value' })
        .max(90, { message: 'zodError.common.latitude.max_value' })
        .openapi({
            example: 40.7128
        }),

    longitude: z
        .number()
        .min(-180, { message: 'zodError.common.longitude.min_value' })
        .max(180, { message: 'zodError.common.longitude.max_value' })
        .openapi({
            example: -74.006
        }),

    positiveInt: z
        .number()
        .int()
        .positive({ message: 'zodError.common.positive_int.invalid' })
        .openapi({
            example: 42
        }),

    nonNegativeInt: z
        .number()
        .int()
        .min(0, { message: 'zodError.common.non_negative_int.invalid' })
        .openapi({
            example: 0
        })
} as const;
