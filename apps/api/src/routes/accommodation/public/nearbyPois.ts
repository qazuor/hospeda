/**
 * Public nearby-points-of-interest endpoint (HOS-145 T-005).
 * Returns points of interest near an accommodation, ordered nearest-first,
 * each annotated with `distanceKm`. The accommodation's real coordinates are
 * read server-side by `AccommodationService.getNearbyPois` and are NEVER
 * included in the response (AC-4 privacy contract).
 */
import { NearbyPoiQuerySchema, NearbyPoiSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/public/accommodations/:slug/nearby-pois
 * Public endpoint - no auth required.
 *
 * @remarks Always returns `200 { items: [] }` for an unknown slug or an
 * accommodation without coordinates (AC-2) — this endpoint deliberately
 * does NOT 404 on a missing slug. `AccommodationService.getNearbyPois`
 * already resolves both cases to an empty array, so the route passes the
 * service result straight through with no existence pre-check (spec §7,
 * decision 2026-07-14).
 */
export const publicGetAccommodationNearbyPoisRoute = createPublicRoute({
    method: 'get',
    path: '/{slug}/nearby-pois',
    summary: 'Get points of interest near an accommodation',
    description:
        "Returns points of interest near the accommodation's real coordinates, ordered nearest-first, each annotated with distanceKm. Never exposes the accommodation's own coordinates.",
    tags: ['Accommodations'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    requestQuery: NearbyPoiQuerySchema.shape,
    responseSchema: z.object({
        items: z.array(NearbyPoiSchema)
    }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // TYPE-WORKAROUND: the route factory types `query` as Record<string, unknown>;
        // NearbyPoiQuerySchema already validated and coerced radius/limit to numbers upstream.
        const { radius, limit } = query as unknown as { radius: number; limit: number };

        const result = await accommodationService.getNearbyPois(
            { slug: params.slug as string, radiusKm: radius, limit },
            actor
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { items: result.data ?? [] };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
