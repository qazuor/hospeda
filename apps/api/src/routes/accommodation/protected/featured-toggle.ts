/**
 * PATCH /api/v1/protected/accommodations/:id/featured-toggle
 *
 * Owner self-service featured toggle (SPEC-309 T-019, G-6).
 *
 * SPEC-292 deliberately stripped `isFeatured` from the owner-facing
 * `AccommodationUpdateHttpSchema` (owner-leak closure) — this route does NOT
 * reopen that schema, and does not use its body/mapper. It is a new,
 * narrowly-scoped endpoint whose write path is gated by a live
 * FEATURED_LISTING entitlement check (plan OR addon), not just field
 * presence — see `setAccommodationFeaturedToggle` for the gate logic.
 *
 * No declarative `ownership:` config: ownership + the entitlement gate are
 * both enforced inside `setAccommodationFeaturedToggle`, mirroring
 * `masterToggle.ts` (SPEC-237 T-008). Safe to mount directly on the router
 * without joining the ownership-middleware sub-router.
 */
import { AccommodationFeaturedToggleHttpSchema, AccommodationIdSchema } from '@repo/schemas';
import {
    getAccommodationFeaturedEntitlement,
    setAccommodationFeaturedToggle
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

const FeaturedToggleResponseSchema = z.object({ isFeatured: z.boolean() });

const FeaturedEntitlementResponseSchema = z.object({
    isFeatured: z.boolean(),
    hasEntitlement: z.boolean()
});

/**
 * PATCH /api/v1/protected/accommodations/:id/featured-toggle
 *
 * Flips `accommodations.isFeatured` for an accommodation the actor owns (or
 * has `ACCOMMODATION_UPDATE_ANY` for), provided the owner currently holds an
 * active FEATURED_LISTING entitlement for this accommodation — from their
 * plan OR an accommodation-scoped `visibility-boost` addon grant. Uncapped,
 * no rotation/queue (SPEC-309 OQ-4): a pure visibility switch.
 */
export const protectedFeaturedToggleRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}/featured-toggle',
    summary: 'Toggle accommodation featured status (owner self-service)',
    description:
        'Sets accommodations.isFeatured. Requires the actor to own the accommodation ' +
        '(or hold ACCOMMODATION_UPDATE_ANY) AND to currently hold an active ' +
        'FEATURED_LISTING entitlement for it (plan or addon) — 403 otherwise.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationFeaturedToggleHttpSchema,
    responseSchema: FeaturedToggleResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { isFeatured } = body as { isFeatured: boolean };

        return await setAccommodationFeaturedToggle({
            actor,
            accommodationId: params.id as string,
            isFeatured
        });
    }
});

/**
 * GET /api/v1/protected/accommodations/:id/featured-toggle
 *
 * Read-side counterpart to {@link protectedFeaturedToggleRoute}: tells the
 * owner editor whether the self-service toggle should render at all, without
 * exposing the plan/addon FEATURED_LISTING entitlement check anywhere in the
 * broader `AccommodationProtectedSchema` used by the general getById route.
 */
export const protectedGetFeaturedEntitlementRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/featured-toggle',
    summary: 'Get accommodation featured status and entitlement (owner self-service)',
    description:
        'Returns the current accommodations.isFeatured value and whether the actor ' +
        'currently holds an active FEATURED_LISTING entitlement (plan or addon) for ' +
        'this accommodation. Requires the actor to own the accommodation (or hold ' +
        'ACCOMMODATION_UPDATE_ANY) — 403 otherwise.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: FeaturedEntitlementResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        return await getAccommodationFeaturedEntitlement({
            actor,
            accommodationId: params.id as string
        });
    }
});
