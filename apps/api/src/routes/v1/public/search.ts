import { publicUser } from '@/types';
import { errorResponse, successResponse } from '@/utils/response';
import { zValidator } from '@hono/zod-validator';
import { AccommodationService, DestinationService, EventService, PostService } from '@repo/db';
import { logger } from '@repo/logger';
import { Hono } from 'hono';
import { z } from 'zod';

// Create the search public router
const searchRoutes = new Hono();

// Global search query validation
const searchQuerySchema = z.object({
    q: z.string().min(1).max(100),
    types: z
        .array(z.enum(['accommodations', 'destinations', 'events', 'posts']))
        .optional()
        .default(['accommodations', 'destinations', 'events', 'posts']),
    limit: z.coerce.number().positive().max(50).default(10)
});

// Global search across multiple entity types
searchRoutes.get('/', zValidator('query', searchQuerySchema), async (c) => {
    try {
        const { q, types, limit } = c.req.valid('query');

        logger.info('Performing global search', 'SearchAPI', { query: q, types, limit });

        // Search across different entity types in parallel
        const results: Record<string, unknown[]> = {};
        const promises: Promise<void>[] = [];

        if (types.includes('accommodations')) {
            promises.push(
                (async () => {
                    const accommodationService = new AccommodationService();
                    const accommodations = await accommodationService.searchFullText(
                        q,
                        publicUser,
                        { limit }
                    );
                    // Filter to only public, active accommodations
                    results.accommodations = accommodations.filter((a) => a.state === 'ACTIVE');
                })()
            );
        }

        if (types.includes('destinations')) {
            promises.push(
                (async () => {
                    const destinationService = new DestinationService();
                    const destinations = await destinationService.list(
                        { query: q, visibility: 'PUBLIC', state: 'ACTIVE', limit },
                        publicUser
                    );
                    results.destinations = destinations;
                })()
            );
        }

        if (types.includes('events')) {
            promises.push(
                (async () => {
                    const eventService = new EventService();
                    const events = await eventService.list(
                        { query: q, visibility: 'PUBLIC', state: 'ACTIVE', limit },
                        publicUser
                    );
                    results.events = events;
                })()
            );
        }

        if (types.includes('posts')) {
            promises.push(
                (async () => {
                    const postService = new PostService();
                    const posts = await postService.search(q, publicUser, { limit });
                    // Filter to only public, active posts
                    results.posts = posts.filter(
                        (p) => p.visibility === 'PUBLIC' && p.state === 'ACTIVE'
                    );
                })()
            );
        }

        // Wait for all searches to complete
        await Promise.all(promises);

        // Create total count
        const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

        return successResponse(c, {
            results,
            meta: {
                query: q,
                totalResults,
                types
            }
        });
    } catch (error) {
        logger.error('Error performing global search', 'SearchAPI', error);
        return errorResponse(c, {
            message: 'Error performing search',
            status: 500
        });
    }
});

export { searchRoutes };
