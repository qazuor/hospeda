/**
 * Public get gastronomy listing by slug endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */
import { EntitlementKey } from '@repo/billing';
import { GastronomyPublicSchema } from '@repo/schemas';
import {
    GastronomyService,
    getGastronomyDailySpecials,
    getGastronomyEvents,
    getGastronomyMenu,
    resolveOwnerGastronomyPlanEntitlementSet,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getTodayInMarketTimezone } from '../../../services/calendar-sync/date-range';
import { getActorFromContext } from '../../../utils/actor';
import {
    fetchGastronomyAmenities,
    fetchGastronomyFeatures
} from '../../../utils/commerce-catalog-relations';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { applyGastronomyDailySpecialsGate } from './daily-specials-projection';
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
        // FIVE gated features now hang off this page — the carta (HOS-895), the
        // per-dish photos (HOS-1045), the menú del día (HOS-1041), the venue
        // agenda (HOS-1042) and the carta's translations (HOS-1043) — and they
        // take the plan's whole entitlement SET in ONE resolver call.
        // Per-feature calls would multiply a three-query lookup by five AND
        // would let the answers come from different reads of the same
        // subscription if a plan change landed between them:
        // a page showing one paid feature and withholding another, for no
        // reason a reader could see. The nesting HOS-1045 warns about (a dish
        // photo surviving a carta that was withheld) is impossible here for the
        // same reason — one lookup, one instant.
        //
        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`,
        // the same accessor the protected menu routes use.
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof getGastronomyMenu>[0] }
        ).model;

        // HOS-1041: the menú del día joins the same parallel batch, read with
        // `validOn` set to TODAY. That argument is the entire expiry mechanism
        // — a special whose window has passed is filtered out in SQL on this
        // very read, so no cron ever runs and there is no state to be behind
        // on. It is resolved in the AR MARKET timezone, not UTC: at 21:00 in
        // Concepción del Uruguay the UTC day has already rolled over, and a UTC
        // "today" would retire the dish of the day in the middle of dinner
        // service.
        //
        // The route's `cacheTTL` (300s) therefore bounds how long a just-lapsed
        // special can survive at the edge. Five minutes past midnight is an
        // acceptable tail for a feature whose alternative was "until the owner
        // remembers"; if it ever stops being acceptable, the fix is the cache
        // tag, not a job.
        const today = getTodayInMarketTimezone();

        // ONE entitlement resolution for all THREE gated features. Each of the
        // three arrived with its own boolean resolver call; kept that way this
        // batch would issue nine billing queries per public render instead of
        // three, and — worse — the three answers could come from different
        // reads of the same subscription if a plan change landed mid-render,
        // publishing one paid feature while withholding another for no reason a
        // reader could see. See `resolveOwnerGastronomyPlanEntitlements`.
        const [
            amenitiesData,
            featuresData,
            menuResult,
            eventsResult,
            dailySpecialsResult,
            ownerPlanEntitlements
        ] = await Promise.all([
            fetchGastronomyAmenities(gastronomy.id),
            fetchGastronomyFeatures(gastronomy.id),
            getGastronomyMenu(model, { gastronomyId: gastronomy.id }),
            getGastronomyEvents(model, { gastronomyId: gastronomy.id }),
            getGastronomyDailySpecials(model, { gastronomyId: gastronomy.id, validOn: today }),
            resolveOwnerGastronomyPlanEntitlementSet({ ownerId: gastronomy.ownerId })
        ]);

        const menuGate = applyGastronomyMenuManagementGate({
            gastronomy,
            menuSections: menuResult.error ? [] : menuResult.data.sections,
            ownerGrantsMenuManagement: ownerPlanEntitlements.has(
                EntitlementKey.MANAGE_GASTRONOMY_MENU
            ),
            ownerGrantsMenuItemPhotos: ownerPlanEntitlements.has(EntitlementKey.MENU_ITEM_PHOTOS),
            ownerGrantsMenuTranslations: ownerPlanEntitlements.has(
                EntitlementKey.MULTILINGUAL_GASTRONOMY_MENU
            )
        });

        const eventsGate = applyGastronomyVenueEventsGate({
            events: eventsResult.error ? [] : eventsResult.data.events,
            ownerGrantsVenueEvents: ownerPlanEntitlements.has(
                EntitlementKey.MANAGE_GASTRONOMY_EVENTS
            )
        });

        const dailySpecialsGate = applyGastronomyDailySpecialsGate({
            dailySpecials: dailySpecialsResult.error ? [] : dailySpecialsResult.data.specials,
            ownerGrantsDailySpecial: ownerPlanEntitlements.has(
                EntitlementKey.MANAGE_GASTRONOMY_DAILY_SPECIAL
            )
        });

        return {
            ...gastronomy,
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined,
            ...menuGate,
            ...eventsGate,
            ...dailySpecialsGate
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
