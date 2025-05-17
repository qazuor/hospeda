import {
    errorResponse,
    notFoundResponse,
    paginatedResponse,
    successResponse
} from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { EventLocationService, EventOrganizerService, EventService } from '@repo/db';
import { logger } from '@repo/logger';
import { EventCreateSchema, EventUpdateSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the events router
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
    authorId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    organizerId: z.string().uuid().optional(),
    visibility: z.string().optional(),
    state: z.string().optional(),
    orderBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    includeDeleted: z.enum(['true', 'false']).optional()
});

// List all events
eventsRoutes.get('/', zValidator('query', listQuerySchema), async (c) => {
    try {
        const query = c.req.valid('query');
        const user = c.get('user');

        logger.info('Listing events', 'EventsAPI', { query });

        // Convert pagination params
        const filter = {
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            query: query.query,
            category: query.category,
            authorId: query.authorId,
            locationId: query.locationId,
            organizerId: query.organizerId,
            visibility: query.visibility,
            state: query.state,
            orderBy: query.orderBy,
            order: query.order,
            isFeatured:
                query.isFeatured === 'true'
                    ? true
                    : query.isFeatured === 'false'
                      ? false
                      : undefined,
            includeDeleted: query.includeDeleted === 'true'
        };

        // Create the service
        const eventService = new EventService();

        // Fetch events
        const events = await eventService.list(filter, user);

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
        logger.error('Error listing events', 'EventsAPI', error);
        return errorResponse(c, {
            message: 'Error listing events',
            status: 500
        });
    }
});

// Get event by ID
eventsRoutes.get('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Fetching event by ID', 'EventsAPI', { id });

        const eventService = new EventService();
        const event = await eventService.getById(id, user);

        if (!event) {
            return notFoundResponse(c, 'Event not found');
        }

        return successResponse(c, event);
    } catch (error) {
        logger.error('Error fetching event', 'EventsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Event not found');
        }

        return errorResponse(c, {
            message: 'Error fetching event',
            status: 500
        });
    }
});

// Create a new event
eventsRoutes.post('/', zValidator('json', EventCreateSchema), async (c) => {
    try {
        const data = c.req.valid('json');
        const user = c.get('user');

        logger.info('Creating new event', 'EventsAPI');

        const eventService = new EventService();
        const newEvent = await eventService.create(data, user);

        return successResponse(c, newEvent, 201);
    } catch (error) {
        logger.error('Error creating event', 'EventsAPI', error);
        return errorResponse(c, {
            message: 'Error creating event',
            status: 500
        });
    }
});

// Update an event
eventsRoutes.put(
    '/:id',
    zValidator('param', idParam),
    zValidator('json', EventUpdateSchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const data = c.req.valid('json');
            const user = c.get('user');

            logger.info('Updating event', 'EventsAPI', { id });

            const eventService = new EventService();
            const updatedEvent = await eventService.update(id, data, user);

            return successResponse(c, updatedEvent);
        } catch (error) {
            logger.error('Error updating event', 'EventsAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Event not found');
            }
            if ((error as Error).message === 'Forbidden') {
                return errorResponse(c, {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to update this event',
                    status: 403
                });
            }

            return errorResponse(c, {
                message: 'Error updating event',
                status: 500
            });
        }
    }
);

// Delete (soft-delete) an event
eventsRoutes.delete('/:id', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Soft-deleting event', 'EventsAPI', { id });

        const eventService = new EventService();
        await eventService.delete(id, user);

        return successResponse(c, { id, deleted: true });
    } catch (error) {
        logger.error('Error deleting event', 'EventsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Event not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this event',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error deleting event',
            status: 500
        });
    }
});

// Restore a soft-deleted event
eventsRoutes.post('/:id/restore', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Restoring event', 'EventsAPI', { id });

        const eventService = new EventService();
        await eventService.restore(id, user);

        return successResponse(c, { id, restored: true });
    } catch (error) {
        logger.error('Error restoring event', 'EventsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Event not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to restore this event',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error restoring event',
            status: 500
        });
    }
});

// List events by location
eventsRoutes.get(
    '/location/:id',
    zValidator('param', idParam),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');
            const user = c.get('user');

            logger.info('Listing events by location', 'EventsAPI', { locationId: id });

            const eventLocationService = new EventLocationService();

            // First check if location exists
            await eventLocationService.getById(id, user);

            // Then get events at this location
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const events = await eventLocationService.listEvents(id, user, filter);

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
            logger.error('Error listing events by location', 'EventsAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Location not found');
            }

            return errorResponse(c, {
                message: 'Error listing events by location',
                status: 500
            });
        }
    }
);

// List events by organizer
eventsRoutes.get(
    '/organizer/:id',
    zValidator('param', idParam),
    zValidator('query', listQuerySchema),
    async (c) => {
        try {
            const { id } = c.req.valid('param');
            const query = c.req.valid('query');
            const user = c.get('user');

            logger.info('Listing events by organizer', 'EventsAPI', { organizerId: id });

            const eventOrganizerService = new EventOrganizerService();

            // First check if organizer exists
            await eventOrganizerService.getById(id, user);

            // Then get events by this organizer
            const filter = {
                limit: query.limit,
                offset: (query.page - 1) * query.limit
            };

            const events = await eventOrganizerService.listEvents(id, user, filter);

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
            logger.error('Error listing events by organizer', 'EventsAPI', error);

            if ((error as Error).message.includes('not found')) {
                return notFoundResponse(c, 'Organizer not found');
            }

            return errorResponse(c, {
                message: 'Error listing events by organizer',
                status: 500
            });
        }
    }
);

// Publish an event (change visibility to PUBLIC)
eventsRoutes.post('/:id/publish', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Publishing event', 'EventsAPI', { id });

        const eventService = new EventService();
        const updatedEvent = await eventService.publish(id, user);

        return successResponse(c, updatedEvent);
    } catch (error) {
        logger.error('Error publishing event', 'EventsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Event not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to publish this event',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error publishing event',
            status: 500
        });
    }
});

// Unpublish an event (change visibility to DRAFT)
eventsRoutes.post('/:id/unpublish', zValidator('param', idParam), async (c) => {
    try {
        const { id } = c.req.valid('param');
        const user = c.get('user');

        logger.info('Unpublishing event', 'EventsAPI', { id });

        const eventService = new EventService();
        const updatedEvent = await eventService.unpublish(id, user);

        return successResponse(c, updatedEvent);
    } catch (error) {
        logger.error('Error unpublishing event', 'EventsAPI', error);

        if ((error as Error).message.includes('not found')) {
            return notFoundResponse(c, 'Event not found');
        }
        if ((error as Error).message === 'Forbidden') {
            return errorResponse(c, {
                code: 'FORBIDDEN',
                message: 'You do not have permission to unpublish this event',
                status: 403
            });
        }

        return errorResponse(c, {
            message: 'Error unpublishing event',
            status: 500
        });
    }
});

export { eventsRoutes };
