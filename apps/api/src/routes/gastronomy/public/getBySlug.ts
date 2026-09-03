/**
 * Public get gastronomy listing by slug endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { EntitlementKey } from '@repo/billing';
import { GastronomyPublicSchema } from '@repo/schemas';
import {
    GastronomyService,
    getGastronomyEvents,
    getGastronomyMenu,
    resolveOwnerGastronomyPlanEntitlements,
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
import { applyGastronomyVenueEventsGate } from './events-projection';
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
        // in the same parallel batch, and gated by a live check that reads the
        // owner's CURRENT gastronomy subscription, not whatever plan was active
        // when the carta was typed or the file was uploaded. See the resolver's
        // own doc for why this is a live read rather than a synced column.
        //
        // HOS-1042 adds the venue agenda on those same terms, and takes the
        // plan's whole entitlement SET in ONE resolver call rather than asking
        // a second boolean question. Two calls would be three extra queries per
        // page view AND would let the carta and the agenda be answered from
        // different reads of the same subscription if a plan change landed
        // between them — a page that showed one paid feature and withheld the
        // other, for no reason a reader could see.
        //
        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`,
        // the same accessor the protected menu routes use.
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof getGastronomyMenu>[0] }
        ).model;

        const [amenitiesData, featuresData, menuResult, eventsResult, ownerPlanEntitlements] =
            await Promise.all([
                fetchGastronomyAmenities(gastronomy.id),
                fetchGastronomyFeatures(gastronomy.id),
                getGastronomyMenu(model, { gastronomyId: gastronomy.id }),
                getGastronomyEvents(model, { gastronomyId: gastronomy.id }),
                resolveOwnerGastronomyPlanEntitlements({ ownerId: gastronomy.ownerId })
            ]);

        const menuGate = applyGastronomyMenuManagementGate({
            gastronomy,
            menuSections: menuResult.error ? [] : menuResult.data.sections,
            ownerGrantsMenuManagement: ownerPlanEntitlements.has(
                EntitlementKey.MANAGE_GASTRONOMY_MENU
            )
        });

        const eventsGate = applyGastronomyVenueEventsGate({
            events: eventsResult.error ? [] : eventsResult.data.events,
            ownerGrantsVenueEvents: ownerPlanEntitlements.has(
                EntitlementKey.MANAGE_GASTRONOMY_EVENTS
            )
        });

        return {
            ...gastronomy,
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined,
            ...menuGate,
            ...eventsGate
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
