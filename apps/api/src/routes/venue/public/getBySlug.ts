/**
 * Public get gastronomy listing by slug endpoint (T-042)
 * Returns a single gastronomy listing projected through GastronomyPublicSchema.
 * Returns null (404) when the listing is not found or not publicly visible.
 */

import { VenuePublicSchema, VerticalEnum } from '@repo/schemas';
import {
    getVenueDailySpecials,
    getVenueEvents,
    getVenueMenu,
    ServiceError,
    VenueService
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getTodayInMarketTimezone } from '../../../services/calendar-sync/date-range';
import { resolvePublicIsFeatured } from '../../../utils/accommodation-featured';
import { getActorFromContext } from '../../../utils/actor';
import { readEffectiveKeys } from '../../../utils/listing-access/user-gate';
import { fetchVenueAmenities, fetchVenueFeatures } from '../../../utils/listing-catalog-relations';
import { withPublicVisibleFaqs } from '../../../utils/listing-faq-visibility';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';
import { applyVenueDailySpecialsGate } from '../../venue/public/daily-specials-projection';
import { applyVenueEventsGate } from '../../venue/public/events-projection';
import { applyVenueMenuManagementGate } from '../../venue/public/menu-projection';

const venueService = new VenueService({ logger: apiLogger });

/**
 * GET /api/v1/public/venues/slug/:slug
 * Get gastronomy listing by slug — Public endpoint.
 *
 * Delegates to VenueService.getBySlug (inherited from BaseCrudService
 * via getByField('slug', ...)). Returns null when the slug resolves to no
 * visible listing.
 */
export const publicGetVenueBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get gastronomy listing by slug',
    description: 'Retrieves a gastronomy listing by its URL-friendly slug',
    tags: ['Gastronomy'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: VenuePublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await venueService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const venue = result.data;
        if (!venue) {
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
        const model = (venueService as unknown as { model: Parameters<typeof getVenueMenu>[0] })
            .model;

        // HOS-1041: the menú del día joins the same parallel batch, read with
        // `validOn` set to TODAY. That argument is the entire expiry mechanism
        // — a special whose window has passed is filtered out in SQL on this
        // very read, so no cron ever runs and there is no state to be behind
        // on. It is resolved in the AR MARKET timezone, not UTC: at 21:00 in
        // Concepción del Uruguay the UTC day has already rolled over, and a UTC
        // "today" would retire the dish of the day in the middle of dinner
        // service.
        //
        // The cache TTL (global cache middleware, plus the edge rule) therefore bounds how long a just-lapsed
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
        const ownerGrants = await readEffectiveKeys({
            userId: venue.ownerId,
            vertical: VerticalEnum.VENUE,
            keys: [
                'manage_venue_menu',
                'menu_item_photos',
                'multilingual_venue_menu',
                'manage_venue_events',
                'manage_venue_daily_special'
            ]
        });

        const [amenitiesData, featuresData, menuResult, eventsResult, dailySpecialsResult] =
            await Promise.all([
                fetchVenueAmenities(venue.id),
                fetchVenueFeatures(venue.id),
                getVenueMenu(model, { venueId: venue.id }),
                getVenueEvents(model, { venueId: venue.id }),
                getVenueDailySpecials(model, { venueId: venue.id, validOn: today })
            ]);

        const menuGate = applyVenueMenuManagementGate({
            venue: venue,
            menuSections: menuResult.error ? [] : menuResult.data.sections,
            ownerGrantsMenuManagement: ownerGrants.manage_venue_menu ?? false,
            ownerGrantsMenuItemPhotos: ownerGrants.menu_item_photos ?? false,
            ownerGrantsMenuTranslations: ownerGrants.multilingual_venue_menu ?? false
        });

        const eventsGate = applyVenueEventsGate({
            events: eventsResult.error ? [] : eventsResult.data.events,
            ownerGrantsVenueEvents: ownerGrants.manage_venue_events ?? false
        });

        const dailySpecialsGate = applyVenueDailySpecialsGate({
            dailySpecials: dailySpecialsResult.error ? [] : dailySpecialsResult.data.specials,
            ownerGrantsDailySpecial: ownerGrants.manage_venue_daily_special ?? false
        });

        return {
            ...withPublicVisibleFaqs(venue),
            // HOS-1286: PUBLIC tier derives `isFeatured` from `featuredByEntitlement`.
            isFeatured: resolvePublicIsFeatured(venue),
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined,
            ...menuGate,
            ...eventsGate,
            ...dailySpecialsGate
        };
    },
    options: {
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
