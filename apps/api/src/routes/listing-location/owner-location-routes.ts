/**
 * Owner side of the location exception request (HOS-2192), built once for the two
 * verticals the one-address rule covers.
 *
 * `POST /{id}/location-exception-request` creates the owner's request. The route
 * authorizes by ROW OWNERSHIP, not by permission: it declares no
 * `requiredPermissions`, and a listing that is not the caller's answers 404, never
 * 403 and never 409 (`apps/api/docs/error-contract.md`: a 403 would confirm the id
 * exists). The service re-checks ownership inside its transaction, so the 404 does
 * not depend on this middleware alone.
 *
 * The request status itself travels in the protected `GET /{id}` projection
 * (`locationException`), not in a route of its own.
 */
import type { LocationKeyVertical } from '@repo/db';
import {
    LocationExceptionRequestCreatedSchema,
    LocationExceptionRequestInputSchema
} from '@repo/schemas';
import { requestLocationException } from '@repo/service-core';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ListingPurgeService } from '../../services/listing-publication/listing-purge.service';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

const ownership = new ListingPurgeService();

/**
 * Builds the owner request route of one vertical.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.tag - OpenAPI tag.
 * @returns The route, ready to mount.
 */
export function createOwnerLocationRoutes(args: {
    readonly vertical: LocationKeyVertical;
    readonly tag: string;
}) {
    const { vertical, tag } = args;

    /** 400 for a malformed id, 404 unless the actor owns the listing. */
    const ownerAccess: MiddlewareHandler = async (ctx, next) => {
        const id = ctx.req.param('id') ?? '';
        if (!z.string().uuid().safeParse(id).success)
            throw new HTTPException(400, { message: 'Invalid listing id' });
        await ownership.assertOwnerAccess({ actor: getActorFromContext(ctx), vertical, id });
        await next();
    };

    const requestException = createProtectedRoute({
        method: 'post',
        path: '/{id}/location-exception-request',
        summary: 'Ask for a location exception',
        description:
            'The owner asks an admin to let the listing share its address with another published listing of theirs (a cabin complex, a food court, a hotel restaurant). The reason is mandatory (10 to 500 characters). At most one request is pending per listing. 409 with reason LOCATION_EXCEPTION_REQUEST_PENDING, _ALREADY_GRANTED, _NOT_NEEDED or _NEEDS_KEY when the state does not allow it. A listing of somebody else answers 404.',
        tags: [tag],
        listingAccess: { vertical, operation: 'READ_OWN', idParam: 'id' },
        requestParams: { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) },
        requestBody: LocationExceptionRequestInputSchema,
        responseSchema: LocationExceptionRequestCreatedSchema,
        options: { middlewares: [ownerAccess] },
        handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
            const actor = getActorFromContext(ctx);
            const listingId = params.id as string;
            const created = await requestLocationException({
                vertical,
                listingId,
                actorId: actor.id,
                reason: (body as { reason: string }).reason
            });
            apiLogger.info(
                { vertical, listingId, requestId: created.id, ownerId: actor.id },
                'location exception requested'
            );
            return {
                id: created.id,
                status: created.status,
                requestedAt: created.requestedAt.toISOString()
            };
        }
    });

    return { requestException } as const;
}
