/**
 * Admin create event endpoint
 * Allows admins to create new events
 */
import {
    adminBodyToDomainEventCreate,
    type EventAdminCreateBody,
    EventAdminCreateBodySchema,
    EventAdminSchema,
    PermissionEnum
} from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { parseRefinedBody } from '../../../utils/refined-body';
import { createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';

const eventService = new EventService({ logger: apiLogger });

/**
 * Refuses a body that tries to set `authorId`, instead of dropping it quietly.
 *
 * `EventAdminCreateBodySchema` omits `authorId`, and a Zod object strips what
 * it does not declare — so without this the key vanishes and the event is
 * attributed to the actor with a 201 and no signal. The admin panel never
 * sends one, but a script, an integration or a seed that did would go from
 * "creates the event under that author" to "creates it under whoever ran it",
 * silently. The repo settled this same trade-off the same way on the protected
 * tier (H-134 on `EventCreateHttpSchema`: "a caller trying to set the author is
 * told so, rather than quietly getting a different one").
 *
 * WHY HERE AND NOT IN THE SCHEMA: the parsed body has already lost the key by
 * the time any object-level check runs, so a `.superRefine` reading it is
 * vacuous — measured. Declaring `authorId: z.never()` does reject, but
 * zod-to-openapi cannot render a `ZodNever` and the whole OpenAPI document
 * fails to build; giving it a fake `type` to render would document an
 * `authorId` this surface does not accept. Reading the raw body keeps both the
 * schema and the published document honest. Hono caches the parsed JSON, so
 * this re-read costs nothing.
 *
 * `.strict()` would also work and is the broader hammer: it would newly reject
 * every unknown key on a schema that mirrors `EventCreateInputSchema`'s strip
 * behaviour, which risks re-breaking the alta this route just got back.
 */
const NoAuthorIdSchema = z
    // `.passthrough()` is the point: a stripping object would have discarded
    // `authorId` before the check below could see it.
    .object({})
    .passthrough()
    .superRefine((value, ctx) => {
        if ('authorId' in value) {
            ctx.addIssue({
                code: 'custom',
                path: ['authorId'],
                message: 'zodError.event.authorId.notAccepted'
            });
        }
    });

async function assertNoAuthorIdInBody(ctx: Context): Promise<void> {
    const raw: unknown = await ctx.req.json().catch(() => undefined);

    if (raw === undefined) {
        return;
    }

    // `parseRefinedBody` rather than a hand-thrown `ServiceError`: it raises
    // `RefinedBodyValidationError`, which extends the ServiceError class that
    // `handleRouteError` actually compares against, and renders the same rich
    // `{details, summary, userFriendlyMessage}` body as any other field-level
    // rejection on this route. A bare `ServiceError` imported from the package
    // root is a DIFFERENT class under the test suite's global service-core
    // mock, so `instanceof` misses it and the caller gets a 500 (measured).
    parseRefinedBody({ schema: NoAuthorIdSchema, body: raw });
}

/**
 * POST /api/v1/admin/events
 * Create event - Admin endpoint
 */
export const adminCreateEventRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create event',
    description: 'Creates a new event. Admin only.',
    tags: ['Events'],
    requiredPermissions: [PermissionEnum.EVENT_CREATE],
    requestBody: EventAdminCreateBodySchema,
    responseSchema: EventAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        await assertNoAuthorIdInBody(ctx);

        const actor = getActorFromContext(ctx);
        // Authorship comes from the actor, never from the body (HOS-374 D-2),
        // exactly as the protected sibling resolves it. Declaring the domain
        // schema here instead demanded an `authorId` the panel has no field
        // for, which made the admin alta impossible (HOS-998).
        const data = adminBodyToDomainEventCreate(body as EventAdminCreateBody, actor.id);

        const result = await eventService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
