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
 * HOS-2192 adds the owner-request queue (`GET /location-exception-requests`, `POST
 * /location-exception-requests/{requestId}/approve|reject`), the exception state with its
 * audit history (`GET /{id}/location-exception`) and an audited, conflict-checked
 * `DELETE`. The literal `/location-*` paths MUST be mounted before `/{id}`.
 *
 * Every route is gated by the vertical's own permission through
 * `PermissionEnum`, never by role. `/location-duplicates` MUST be mounted
 * before `/{id}` so Hono does not resolve it as a UUID param.
 */
import {
    type LocationKeyVertical,
    listingLocationExceptionModel,
    listingLocationModel
} from '@repo/db';
import {
    LocationDuplicatesQuerySchema,
    LocationDuplicatesResponseSchema,
    LocationExceptionApproveInputSchema,
    LocationExceptionDecisionResultSchema,
    LocationExceptionInputSchema,
    LocationExceptionRejectInputSchema,
    LocationExceptionRequestsQuerySchema,
    LocationExceptionRequestsResponseSchema,
    LocationExceptionResultSchema,
    LocationExceptionRevokeInputSchema,
    LocationExceptionStateSchema,
    type PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import {
    approveLocationExceptionRequest,
    getLocationExceptionState,
    grantLocationException,
    rejectLocationExceptionRequest,
    revokeLocationException
} from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { notifyLocationExceptionDecision } from '../../lib/location-exception-notifications';
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
export function createAdminLocationRoutes(args: {
    readonly vertical: LocationKeyVertical;
    readonly permission: PermissionEnum;
    readonly tag: string;
}) {
    const { vertical, permission, tag } = args;
    const idParam = { id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }) };

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
            // Grant + audit event + resolution of a pending request, in one transaction.
            const resolved = await grantLocationException({
                vertical,
                listingId: id,
                adminId: actor.id,
                reason
            });
            if (resolved) void notifyLocationExceptionDecision(resolved);
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
        description:
            'Removes the one-address exception of a listing and records the removal (actor, date, reason, key). Answers 409 (LOCATION_EXCEPTION_REVOKE_CONFLICT) when the listing is published and another published listing of the same owner holds the same address. The JSON body is optional: `{ reason }`.',
        tags: [tag],
        requiredPermissions: [permission],
        requestParams: idParam,
        responseSchema: LocationExceptionResultSchema,
        handler: async (ctx: Context, params: Record<string, unknown>) => {
            const actor = getActorFromContext(ctx);
            const id = params.id as string;
            // The factory never parses a DELETE body, so the optional `{ reason }` is read here.
            // A missing or empty body is fine; a present reason is validated like any other.
            const raw: unknown = await ctx.req.json().catch(() => ({}));
            const parsed = LocationExceptionRevokeInputSchema.safeParse(raw ?? {});
            if (!parsed.success)
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    parsed.error.issues[0]?.message ?? 'Invalid reason'
                );
            const { reason } = parsed.data;
            await revokeLocationException({ vertical, listingId: id, adminId: actor.id, reason });
            apiLogger.info(
                { vertical, listingId: id, adminId: actor.id },
                'location exception removed'
            );
            return { id, hasException: false };
        }
    });

    const getState = createAdminRoute({
        method: 'get',
        path: '/{id}/location-exception',
        summary: 'Location exception state and history',
        description:
            'The exception in force (who, when, why) and the audit history of requests, approvals, rejections, grants and removals of the listing, newest first.',
        tags: [tag],
        requiredPermissions: [permission],
        requestParams: idParam,
        responseSchema: LocationExceptionStateSchema,
        handler: async (_ctx: Context, params: Record<string, unknown>) =>
            getLocationExceptionState({ vertical, listingId: params.id as string })
    });

    const listRequests = createAdminRoute({
        method: 'get',
        path: '/location-exception-requests',
        summary: 'Owner location exception requests',
        description:
            "The queue of owner requests for a location exception (default status PENDING), oldest first, with the listing, the owner, the address and the owner's other published listings it collides with. Paginated with page and pageSize.",
        tags: [tag],
        requiredPermissions: [permission],
        requestQuery: LocationExceptionRequestsQuerySchema.shape,
        responseSchema: LocationExceptionRequestsResponseSchema,
        handler: async (
            _ctx: Context,
            _params: Record<string, unknown>,
            _body: unknown,
            query?: Record<string, unknown>
        ) => {
            const { status, page, pageSize } = LocationExceptionRequestsQuerySchema.parse(
                query ?? {}
            );
            const result = await listingLocationExceptionModel.listRequests({
                vertical,
                status,
                page,
                pageSize
            });
            return {
                items: result.items.map((row) => ({
                    requestId: row.requestId,
                    status: row.status,
                    listing: { id: row.listingId, name: row.listingName },
                    owner: { id: row.ownerId, name: row.ownerName, email: row.ownerEmail },
                    address: {
                        street: row.street,
                        number: row.number,
                        floor: row.floor,
                        apartment: row.apartment,
                        destinationId: row.destinationId
                    },
                    collidingListings: [...row.collidingListings],
                    reason: row.reason,
                    decisionReason: row.decisionReason,
                    requestedAt: row.requestedAt.toISOString()
                })),
                total: result.total,
                page,
                pageSize
            };
        }
    });

    const requestIdParam = {
        requestId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    };

    const approveRequest = createAdminRoute({
        method: 'post',
        path: '/location-exception-requests/{requestId}/approve',
        summary: 'Approve a location exception request',
        description:
            "Grants the exception exactly like the direct grant (bound to the address the listing has now; admin, reason and date recorded) and resolves the request. The reason defaults to the owner's and may be edited. The owner is notified.",
        tags: [tag],
        requiredPermissions: [permission],
        requestParams: requestIdParam,
        requestBody: LocationExceptionApproveInputSchema,
        responseSchema: LocationExceptionDecisionResultSchema,
        successStatusCode: 200,
        handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
            const actor = getActorFromContext(ctx);
            const decision = await approveLocationExceptionRequest({
                vertical,
                requestId: params.requestId as string,
                adminId: actor.id,
                reason: (body as { reason?: string }).reason
            });
            void notifyLocationExceptionDecision(decision);
            apiLogger.info(
                { vertical, requestId: decision.requestId, adminId: actor.id },
                'location exception request approved'
            );
            return { requestId: decision.requestId, status: decision.status };
        }
    });

    const rejectRequest = createAdminRoute({
        method: 'post',
        path: '/location-exception-requests/{requestId}/reject',
        summary: 'Reject a location exception request',
        description:
            'Rejects the request; the reason is mandatory and reaches the owner. The listing does not change.',
        tags: [tag],
        requiredPermissions: [permission],
        requestParams: requestIdParam,
        requestBody: LocationExceptionRejectInputSchema,
        responseSchema: LocationExceptionDecisionResultSchema,
        successStatusCode: 200,
        handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
            const actor = getActorFromContext(ctx);
            const decision = await rejectLocationExceptionRequest({
                vertical,
                requestId: params.requestId as string,
                adminId: actor.id,
                reason: (body as { reason: string }).reason
            });
            void notifyLocationExceptionDecision(decision);
            apiLogger.info(
                { vertical, requestId: decision.requestId, adminId: actor.id },
                'location exception request rejected'
            );
            return { requestId: decision.requestId, status: decision.status };
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

    return {
        setException,
        clearException,
        getState,
        listDuplicates,
        listRequests,
        approveRequest,
        rejectRequest
    } as const;
}
