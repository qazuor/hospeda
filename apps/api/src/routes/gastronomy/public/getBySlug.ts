/**
 * Public get gastronomy listing by slug endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { GastronomyPublicSchema } from '@repo/schemas';
import {
    GastronomyService,
    getGastronomyMenu,
    resolveOwnerGastronomyMenuGrants,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import {
    fetchGastronomyAmenities,
    fetchGastronomyFeatures
} from '../../../utils/commerce-catalog-relations';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { applyGastronomyMenuManagementGate } from './menu-projection';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies/slug/:slug
 * Get gastronomy listing by slug — Public endpoint.
 *
 * Delegates to GastronomyService.getBySlug (inherited from BaseCrudService
 * via getByField('slug', ...)). Returns null when the slug resolves to no
 * visible listing.
 */
export const publicGetGastronomyBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get gastronomy listing by slug',
    description: 'Retrieves a gastronomy listing by its URL-friendly slug',
    tags: ['Gastronomy'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: GastronomyPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const gastronomy = result.data;
        if (!gastronomy) {
            return null;
        }

        // HOS-1072: the amenities and features the owner ticked. The service
        // loads the junction rows but not the catalog behind them, so the slug
        // (the i18n key) and the icon are fetched here — same reason and same
        // shape as the accommodation route's own `fetchAmenities`/`fetchFeatures`.
        //
        // Emitted as `undefined` when empty rather than `[]`: the detail page
        // renders nothing for either, and an empty array on the wire would read
        // as "loaded, and there are none" from a payload that never joined.
        //
        // HOS-895 PR2: the structured carta and the uploaded photo/PDF are read
        // in the same parallel batch, and gated by a live check —
        // `resolveOwnerGastronomyMenuGrants` reads the owner's CURRENT
        // gastronomy subscription, not whatever plan was active when the carta
        // was typed or the file was uploaded. See the resolver's own doc for
        // why this is a live read rather than a synced column.
        //
        // HOS-1045 adds a SECOND grant to the same lookup (the per-dish
        // photos, premium-only). One call, not two: both answers come out of
        // the same three queries, so they cannot disagree about which instant
        // they describe.
        //
        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`,
        // the same accessor the protected menu routes use.
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof getGastronomyMenu>[0] }
        ).model;

        const [amenitiesData, featuresData, menuResult, menuGrants] = await Promise.all([
            fetchGastronomyAmenities(gastronomy.id),
            fetchGastronomyFeatures(gastronomy.id),
            getGastronomyMenu(model, { gastronomyId: gastronomy.id }),
            resolveOwnerGastronomyMenuGrants({ ownerId: gastronomy.ownerId })
        ]);

        const menuGate = applyGastronomyMenuManagementGate({
            gastronomy,
            menuSections: menuResult.error ? [] : menuResult.data.sections,
            ownerGrantsMenuManagement: menuGrants.manageMenu,
            ownerGrantsMenuItemPhotos: menuGrants.menuItemPhotos
        });

        return {
            ...gastronomy,
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined,
            ...menuGate
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
