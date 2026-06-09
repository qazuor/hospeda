/**
 * Public endpoint: list accommodations by owner (user)
 *
 * GET /api/v1/public/users/:id/accommodations
 *
 * Returns a paginated list of ACTIVE, non-deleted accommodations
 * owned by the given user. The `ownerId` filter is injected
 * server-side from the path param — clients cannot override it.
 *
 * A non-existent user ID returns an empty list (HTTP 200) rather than
 * 404 to avoid user-enumeration. This matches the spec acceptance criteria.
 *
 * SPEC-187: richDescription is stripped from every item before the response
 * is sent. This is a card-listing endpoint that never renders rich text;
 * the field must be absent regardless of the owner's plan. Stripping at the
 * DATA level is fail-closed and independent of any schema change.
 */
import { AccommodationPublicSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

/**
 * Strips richDescription from an accommodation object before it reaches the
 * public owner-list response payload.
 *
 * richDescription is a PREMIUM field gated per-owner by the entitlement system.
 * This card-listing endpoint never renders rich text, so the field must be absent
 * from the payload regardless of the owner's current plan. Omission at the DATA
 * level is fail-closed and independent of any Zod schema change. (SPEC-187 fix.)
 *
 * @param item - Raw accommodation object from the service layer.
 * @returns The accommodation object with richDescription removed.
 */
function stripRichDescription<T extends { richDescription?: unknown }>(
    item: T
): Omit<T, 'richDescription'> {
    const { richDescription: _dropped, ...rest } = item;
    return rest;
}

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/public/users/{id}/accommodations
 * List accommodations by owner - Public endpoint
 *
 * Visibility rules (enforced server-side, not exposed to clients):
 * - Only `lifecycleState = ACTIVE` accommodations are returned.
 * - Soft-deleted records are excluded automatically by the service/model layer.
 * - The `ownerId` is taken from the URL path; client cannot override it.
 *
 * Non-existent user → empty paginated list (HTTP 200, NOT 404).
 */
export const publicGetUserAccommodationsRoute = createPublicListRoute({
    method: 'get',
    path: '/{id}/accommodations',
    summary: 'List accommodations by owner',
    description:
        "Returns a paginated list of the owner's active accommodations. " +
        'Non-existent user ID returns an empty list rather than 404.',
    tags: ['Users', 'Accommodations'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: AccommodationPublicSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const ownerId = params.id as string;
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const result = await accommodationService.search(actor, {
            ownerId,
            page,
            pageSize,
            // Only surface publicly visible accommodations.
            // `lifecycleState` is validated and enforced by the service layer.
            // Soft-deleted records are excluded by the base model (deletedAt IS NULL).
            featuredFirst: true
        });

        if (result.error) {
            // Surface DB / permission errors but not "no rows" — that is a valid
            // empty result and must return HTTP 200 with an empty items array.
            apiLogger.warn(
                `publicGetUserAccommodationsRoute: service error for ownerId=${ownerId}: ${result.error.message}`
            );
            return {
                items: [],
                pagination: getPaginationResponse(0, { page, pageSize })
            };
        }

        // SPEC-187 data-level omission: richDescription is a PREMIUM field gated
        // per-owner by the entitlement system. This card-listing endpoint never
        // renders it, so the field is stripped before reaching the response payload
        // — fail-closed and independent of any schema change.
        const rawItems = result.data?.items ?? [];
        const items = rawItems.map(stripRichDescription);

        return {
            items,
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 120,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
