/**
 * Admin batch event endpoint
 * Retrieves multiple events by IDs
 */
import { EventAdminSchema, EventBatchRequestSchema } from '@repo/schemas';
import { EventService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const eventService = new EventService({ logger: apiLogger });

/**
 * POST /api/v1/admin/events/batch
 * Get multiple events by IDs - Admin endpoint
 */
export const adminEventBatchRoute = createAdminRoute({
    method: 'post',
    path: '/batch',
    summary: 'Get multiple events by IDs',
    description: 'Retrieves multiple events by their IDs for entity select components',
    tags: ['Events'],
    requestBody: EventBatchRequestSchema,
    responseSchema: z.array(EventAdminSchema.nullable()),
    handler: async (ctx: Context, _params, body: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { ids, fields } = body as { ids: string[]; fields?: string[] };

        // Load all events by their IDs
        const events = await Promise.all(
            ids.map(async (id) => {
                const result = await eventService.getById(actor, id);
                return result.error ? null : result.data;
            })
        );

        // Filter fields if specified
        if (fields && fields.length > 0) {
            // Always include id and name for entity selectors to work
            const requiredFields = ['id', 'name'];
            const fieldsToInclude = [...new Set([...requiredFields, ...fields])];

            return events.map((event) => {
                if (!event) return null;

                const filtered: Record<string, unknown> = {};
                for (const field of fieldsToInclude) {
                    if (field in event) {
                        filtered[field] = event[field as keyof typeof event];
                    }
                }

                return filtered;
            });
        }

        return events;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 50, windowMs: 60000 }
    }
});
