/**
 * Public destination weather endpoint
 * Returns the cached current conditions + 16-day forecast for a destination.
 */
import { DestinationIdSchema, DestinationWeatherCacheSchema } from '@repo/schemas';
import { DestinationService, WeatherService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });
const weatherService = new WeatherService({ destinationService });

/**
 * GET /api/v1/public/destinations/:id/weather
 *
 * Returns the cached weather for a destination (current + 16-day forecast), or
 * `null` when no weather is cached yet (no coordinates / cron has not run). A
 * non-visible or unknown destination surfaces a NOT_FOUND error via the service.
 */
export const publicGetDestinationWeatherRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/weather',
    summary: 'Get destination weather',
    description: 'Retrieves the cached current conditions and 16-day forecast for a destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: DestinationWeatherCacheSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        return weatherService.getCachedWeather(actor, { destinationId: params.id as string });
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
