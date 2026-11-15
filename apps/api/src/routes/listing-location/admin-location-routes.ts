/**
 * Admin routes of the one-address rule (HOS-1810), built once for the two
 * verticals the rule covers (accommodation and venue).
 *
 * - `POST   /{id}/location-exception`  grants an exception, reason required.
 * - `DELETE /{id}/location-exception`  removes it.
 * - `GET    /location-duplicates`      the repeated-address report: groups of
 *   published listings sharing a place key, with `sameOwner`. It is the admin
 *   flag for duplicates across owners, which never block the publisher.
 *
 * Every route is gated by the vertical's own permission through
 * `PermissionEnum`, never by role. `/location-duplicates` MUST be mounted
 * before `/{id}` so Hono does not resolve it as a UUID param.
 */
import { type LocationKeyVertical, listingLocationModel } from '@repo/db';
import {
    LocationDuplicatesQuerySchema,
    LocationDuplicatesResponseSchema,
    LocationExceptionInputSchema,
    LocationExceptionResultSchema,
    type PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

/**
 * Builds the three admin routes for one vertical.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.permission - The vertical's location-exception permission.
 * @param args.tag - OpenAPI tag.
 * @returns The three routes, ready to mount.
 */
/** Reason of the 409 answered when an exception is requested for a listing with no comparable address. */
const LOCATION_EXCEPTION_NEEDS_KEY_REASON = 'LOCATION_EXCEPTION_NEEDS_KEY';

export function createAdminLocationRoutes(args: {
    readonly vertical: LocationKeyVertical;
    readonly permission: PermissionEnum;
    readonly tag: string;
}) {
    const { vertical, permission, tag } = args;
    const idParam = { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) };

    const notFound = () => new ServiceError(ServiceErrorCode.NOT_FOUND, `${vertical} not found`);

    const setException = createAdminRoute({
        method: 'post',
        path: '/{id}/location-exception',
        summary: 'Grant a location exception',
        description:
            'Lets a listing share an address with another published listing of its owner (a cabin complex, a food court, a hotel restaurant). The reason is mandatory and recorded with the admin and the date. The exception is bound to the address the listing has when it is granted: moving the listing to another address ends it. A listing with no comparable address answers 409 (LOCATION_EXCEPTION_NEEDS_KEY).',
        tags: [tag],
        requiredPermissions: [permission],
        requestParams: idParam,
        requestBody: LocationExceptionInputSchema,
        responseSchema: LocationExceptionResultSchema,
        handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
            const actor = getActorFromContext(ctx);
            const id = params.id as string;
            const { reason } = body as { reason: string };
            const done = await listingLocationModel.setException({
                vertical,
                id,
                adminId: actor.id,
                reason,
                at: new Date()
            });
            if (done === 'not_found') throw notFound();
            // The exception is bound to the address key it is granted for; a listing
            // with no comparable address (no number, `s/n`) has none, so there is
            // nothing to exempt. A state conflict (409), not an input error.
            if (done === 'no_key')
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'The listing has no comparable address to grant an exception for',
                    undefined,
                    LOCATION_EXCEPTION_NEEDS_KEY_REASON
                );
            apiLogger.info(
                { vertical, listingId: id, adminId: actor.id },
                'location exception granted'
            );
            return { id, hasException: true };
        }
    });

    const clearException = createAdminRoute({
        method: 'delete',
        path: '/{id}/location-exception',
        summary: 'Remove a location exception',
        description: 'Removes the one-address exception of a listing.',
        tags: [tag],
        requiredPermissions: [permission],
        requestParams: idParam,
        responseSchema: LocationExceptionResultSchema,
        handler: async (ctx: Context, params: Record<string, unknown>) => {
            const actor = getActorFromContext(ctx);
            const id = params.id as string;
            const done = await listingLocationModel.clearException({ vertical, id });
            if (!done) throw notFound();
            apiLogger.info(
                { vertical, listingId: id, adminId: actor.id },
                'location exception removed'
            );
            return { id, hasException: false };
        }
    });

    const listDuplicates = createAdminRoute({
        method: 'get',
        path: '/location-duplicates',
        summary: 'Repeated-address report',
        description:
            'Groups of two or more published listings that share a place key and have no exception. `sameOwner` tells whether the whole group belongs to one owner. Paginated with page and pageSize.',
        tags: [tag],
        requiredPermissions: [permission],
        requestQuery: LocationDuplicatesQuerySchema.shape,
        responseSchema: LocationDuplicatesResponseSchema,
        handler: async (
            _ctx: Context,
            _params: Record<string, unknown>,
            _body: unknown,
            query?: Record<string, unknown>
        ) => {
            const { page, pageSize } = LocationDuplicatesQuerySchema.parse(query ?? {});
            const result = await listingLocationModel.listDuplicateGroups({
                vertical,
                page,
                pageSize
            });
            return { ...result, page, pageSize };
        }
    });

    return { setException, clearException, listDuplicates } as const;
}
