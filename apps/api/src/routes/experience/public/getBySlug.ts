/**
 * Public get experience listing by slug endpoint (T-019)
 * Returns a single experience listing projected through ExperiencePublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { ExperiencePublicSchema } from '@repo/schemas';
import {
    ExperienceService,
    resolveOwnerGrantsExperienceDirections,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import {
    fetchExperienceAmenities,
    fetchExperienceFeatures
} from '../../../utils/commerce-catalog-relations';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { applyExperienceDirectionsGate } from './directions-projection';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/public/experiences/slug/:slug
 * Get experience listing by slug — Public endpoint.
 *
 * Delegates to ExperienceService.getBySlug (inherited from BaseCrudService
 * via getByField('slug', ...)). Returns null when the slug resolves to no
 * visible listing.
 */
export const publicGetExperienceBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get experience listing by slug',
    description: 'Retrieves an experience listing by its URL-friendly slug',
    tags: ['Experience'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: ExperiencePublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const experience = result.data;
        if (!experience) {
            return null;
        }

        // HOS-1072: the amenities and features the provider ticked — including
        // the eight `*_included` rows ("incluye transporte", "incluye guía",
        // …) that were seeded for this page and had nowhere to appear. The
        // service loads the junction rows but not the catalog behind them, so
        // the slug (the i18n key) and the icon are fetched here.
        //
        // Emitted as `undefined` when empty rather than `[]`: the detail page
        // renders nothing for either, and an empty array on the wire would read
        // as "loaded, and there are none" from a payload that never joined.
        //
        // HOS-1049: the how-to-get-there half is resolved in the same parallel
        // batch and gated by a LIVE check —
        // `resolveOwnerGrantsExperienceDirections` reads the provider's CURRENT
        // experience subscription, not whatever plan was active when the
        // instructions were typed. See the resolver's own doc for why this is a
        // live read rather than a synced column, and note that the meeting point
        // and its coordinates are NOT part of the gate: they ship on every tier.
        const [amenitiesData, featuresData, ownerGrantsDirections] = await Promise.all([
            fetchExperienceAmenities(experience.id),
            fetchExperienceFeatures(experience.id),
            resolveOwnerGrantsExperienceDirections({ ownerId: experience.ownerId })
        ]);

        // The gate wraps the WHOLE object rather than being spread into it: it
        // has to REMOVE `meetingPointDirections`, and a spread of
        // `{ meetingPointDirections: undefined }` leaves the key present. See
        // the projection module's doc.
        return applyExperienceDirectionsGate({
            experience: {
                ...experience,
                amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
                features: featuresData.length > 0 ? featuresData : undefined
            },
            ownerGrantsDirections
        });
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
