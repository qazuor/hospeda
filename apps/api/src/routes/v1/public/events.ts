import { publicUser } from '@/types';
import { apiLogger } from '@/utils/logger';
import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { EventService } from '@repo/db';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the events public router
const eventsRoutes = new Hono();

// Common parameter validation
const idParam = z.object({
    id: z.string().uuid()
});

// List query params validation
const listQuerySchema = z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    query: z.string().optional(),
    category: z.string().optional(),
    locationId: z.string().uuid().optional(),
    organizerId: z.string().uuid().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional()
});

// List public events
eventsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Listing public events');

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            category: query.category,
            locationId: query.locationId,
            organizerId: query.organizerId,
            orderBy: query.orderBy,
            order: query.order,
            visibility: 'PUBLIC', // Only public events
            state: 'ACTIVE', // Only active events
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            includeDeleted: false
        };

        // Create the service
        const eventService = new EventService();

        // Fetch events
        const events = await eventService.list(filter, publicUser);

        // Get total count for pagination
        const total =
            events.length > query.limit
                ? events.length
                : Math.max(query.page * query.limit, events.length);

        return paginatedResponse(c, events, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error listing public events');
        return errorResponse(c, {
            message: 'Error listing events',
            status: 500
        });
    }
});

// Get a public event by ID
eventsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');

        apiLogger.info({ location: 'PublicAPI', id }, 'Fetching public event by ID');

        const eventService = new EventService();
        const event = await eventService.getById(id, publicUser);

        if (!event || event.visibility !== 'PUBLIC' || event.state !== 'ACTIVE') {
            return notFoundResponse(c, 'Event not found');
        }

        return successResponse(c, event);
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching public event');

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Event not found');
        }

        return errorResponse(c, {
            message: 'Error fetching event',
            status: 500
        });
    }
});

// Get upcoming events
eventsRoutes.get('/upcoming', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Fetching upcoming events');

        // Create the service
        const eventService = new EventService();

        // Pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit
        };

        // Fetch upcoming events
        const events = await eventService.listUpcoming(publicUser, filter);

        // Get total count for pagination
        const total =
            events.length > query.limit
                ? events.length
                : Math.max(query.page * query.limit, events.length);

        return paginatedResponse(c, events, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching upcoming events');
        return errorResponse(c, {
            message: 'Error fetching upcoming events',
            status: 500
        });
    }
});

// Get events this week
eventsRoutes.get('/this-week', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');

        apiLogger.info({ location: 'PublicAPI', query }, 'Fetching events this week');

        // Create the service
        const eventService = new EventService();

        // Pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit
        };

        // Fetch this week's events
        const events = await eventService.listThisWeek(publicUser, filter);

        // Get total count for pagination
        const total =
            events.length > query.limit
                ? events.length
                : Math.max(query.page * query.limit, events.length);

        return paginatedResponse(c, events, {
            page: query.page,
            limit: query.limit,
            total: total
        });
    } catch (error) {
        apiLogger.error(error as Error, 'PublicAPI - Error fetching events this week');
        return errorResponse(c, {
            message: 'Error fetching events this week',
            status: 500
        });
    }
});

// Get events by date range
eventsRoutes.get(
    '/date-range',
    zValidator(
        'query',
        z.object({
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            page: z.coerce.number().positive().default(1),
            limit: z.coerce.number().positive().max(100).default(20)
        })
    ),
    async (c) => {
        try {
            const { startDate, endDate, page, limit } = c.req.valid('query');

            apiLogger.info(
                { location: 'PublicAPI', startDate, endDate },
                'Fetching events by date range'
            );

            // Parse dates
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return errorResponse(c, {
                    message: 'Invalid date format',
                    status: 400
                });
            }

            if (start > end) {
                return errorResponse(c, {
                    message: 'Start date must be before or equal to end date',
                    status: 400
                });
            }

            // Create the service
            const eventService = new EventService();

            // Pagination params
            const filter = {
                limit,
                offset: (page - 1) * limit
            };

            // Fetch events in date range
            const events = await eventService.getByDateRange(start, end, publicUser, filter);

            // Get total count for pagination
            const total =
                events.length > limit ? events.length : Math.max(page * limit, events.length);

            return paginatedResponse(c, events, {
                page,
                limit,
                total
            });
        } catch (error) {
            apiLogger.error(error as Error, 'PublicAPI - Error fetching events by date range');
            return errorResponse(c, {
                message: 'Error fetching events by date range',
                status: 500
            });
        }
    }
);

export { eventsRoutes };
