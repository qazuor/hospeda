/**
 * Admin IA — Create Action Registry (T-016)
 *
 * Defines all quick-create actions that appear in the topbar "+" button and
 * mobile FAB. Each action carries a route to a real `/new` page that already
 * exists in the router tree.
 *
 * Canonical IDs used by role configs:
 *   `newAccommodation`, `newPost`, `newEvent`, `newCampaign` (explicitly referenced).
 *   Plus: `newDestination`, `newEventLocation`, `newEventOrganizer`, `newUser`,
 *         `newSponsor`, `newPromoCode`, `newAmenity`, `newFeature`, `newAttraction`,
 *         `newPostTag`, `newSystemTag`, `newInternalTag`.
 *
 * Design source of truth: `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §14.
 *
 * @see apps/admin/src/config/ia/schema.ts   — CreateAction type contract
 * @see apps/admin/src/routes/_authed/        — real /new route files
 */

import type { CreateAction } from './schema';

/**
 * Registry of all available create actions, keyed by canonical ID.
 *
 * Role configs reference these IDs in `topbar.showQuickCreate` and
 * `mobile.fab`. Passing `'all'` shows every action the user's permissions allow.
 *
 * @example
 * ```ts
 * import { createActions } from '@/config/ia/create-actions';
 * const action = createActions['newAccommodation'];
 * navigate(action.route);
 * ```
 */
export const createActions: Record<string, CreateAction> = {
    // ── Catálogo ────────────────────────────────────────────────────────────

    /**
     * Create a new accommodation. Gated by ACCOMMODATION_CREATE.
     * Real route: apps/admin/src/routes/_authed/accommodations/new.tsx
     */
    newAccommodation: {
        id: 'newAccommodation',
        label: { es: 'Nuevo alojamiento', en: 'New accommodation', pt: 'Novo alojamento' },
        route: '/accommodations/new',
        icon: 'AccommodationIcon',
        permissions: ['ACCOMMODATION_CREATE']
    },

    /**
     * Create a new destination. Gated by DESTINATION_CREATE.
     * Real route: apps/admin/src/routes/_authed/destinations/new.tsx
     */
    newDestination: {
        id: 'newDestination',
        label: { es: 'Nuevo destino', en: 'New destination', pt: 'Novo destino' },
        route: '/destinations/new',
        icon: 'DestinationIcon',
        permissions: ['DESTINATION_CREATE']
    },

    /**
     * Create a new attraction. Gated by ATTRACTION_CREATE.
     * Real route: apps/admin/src/routes/_authed/content/destination-attractions/new.tsx
     */
    newAttraction: {
        id: 'newAttraction',
        label: { es: 'Nueva atracción', en: 'New attraction', pt: 'Nova atração' },
        route: '/content/destination-attractions/new',
        icon: 'MapIcon',
        permissions: ['ATTRACTION_CREATE']
    },

    /**
     * Create a new amenity. Gated by AMENITY_CREATE.
     * Real route: apps/admin/src/routes/_authed/content/accommodation-amenities/new.tsx
     */
    newAmenity: {
        id: 'newAmenity',
        label: { es: 'Nueva amenidad', en: 'New amenity', pt: 'Nova amenidade' },
        route: '/content/accommodation-amenities/new',
        icon: 'SettingsIcon',
        permissions: ['AMENITY_CREATE']
    },

    /**
     * Create a new feature. Gated by FEATURE_CREATE.
     * Real route: apps/admin/src/routes/_authed/content/accommodation-features/new.tsx
     */
    newFeature: {
        id: 'newFeature',
        label: { es: 'Nueva característica', en: 'New feature', pt: 'Nova característica' },
        route: '/content/accommodation-features/new',
        icon: 'CheckCircleIcon',
        permissions: ['FEATURE_CREATE']
    },

    // ── Editorial ───────────────────────────────────────────────────────────

    /**
     * Create a new blog post. Gated by POST_CREATE.
     * Real route: apps/admin/src/routes/_authed/posts/new.tsx
     */
    newPost: {
        id: 'newPost',
        label: { es: 'Nuevo post', en: 'New post', pt: 'Novo post' },
        route: '/posts/new',
        icon: 'PostIcon',
        permissions: ['POST_CREATE']
    },

    /**
     * Create a new event. Gated by EVENT_CREATE.
     * Real route: apps/admin/src/routes/_authed/events/new.tsx
     */
    newEvent: {
        id: 'newEvent',
        label: { es: 'Nuevo evento', en: 'New event', pt: 'Novo evento' },
        route: '/events/new',
        icon: 'EventIcon',
        permissions: ['EVENT_CREATE']
    },

    /**
     * Create a new event location. Gated by EVENT_LOCATION_CREATE.
     * Real route: apps/admin/src/routes/_authed/events/locations/new.tsx
     */
    newEventLocation: {
        id: 'newEventLocation',
        label: { es: 'Nueva locación', en: 'New location', pt: 'Novo local' },
        route: '/events/locations/new',
        icon: 'EventLocationIcon',
        permissions: ['EVENT_LOCATION_CREATE']
    },

    /**
     * Create a new event organizer. Gated by EVENT_ORGANIZER_CREATE.
     * Real route: apps/admin/src/routes/_authed/events/organizers/new.tsx
     */
    newEventOrganizer: {
        id: 'newEventOrganizer',
        label: { es: 'Nuevo organizador', en: 'New organizer', pt: 'Novo organizador' },
        route: '/events/organizers/new',
        icon: 'EventOrganizerIcon',
        permissions: ['EVENT_ORGANIZER_CREATE']
    },

    /**
     * Create a new newsletter campaign. Gated by NEWSLETTER_CAMPAIGN_WRITE.
     * Real route: apps/admin/src/routes/_authed/newsletter/campaigns/new.tsx
     */
    newCampaign: {
        id: 'newCampaign',
        label: { es: 'Nueva campaña', en: 'New campaign', pt: 'Nova campanha' },
        route: '/newsletter/campaigns/new',
        icon: 'NewsletterIcon',
        permissions: ['NEWSLETTER_CAMPAIGN_WRITE']
    },

    /**
     * Create a new post tag. Gated by POST_TAG_CREATE.
     * Real route: apps/admin/src/routes/_authed/tags/post-tags/new.tsx
     */
    newPostTag: {
        id: 'newPostTag',
        label: { es: 'Nuevo post tag', en: 'New post tag', pt: 'Novo post tag' },
        route: '/tags/post-tags/new',
        icon: 'TagIcon',
        permissions: ['POST_TAG_CREATE']
    },

    // ── Comunidad ───────────────────────────────────────────────────────────

    /**
     * Create a new user. Gated by USER_CREATE.
     * Real route: apps/admin/src/routes/_authed/access/users/new.tsx
     */
    newUser: {
        id: 'newUser',
        label: { es: 'Nuevo usuario', en: 'New user', pt: 'Novo usuário' },
        route: '/access/users/new',
        icon: 'UsersManagementIcon',
        permissions: ['USER_CREATE']
    },

    // ── Comercial ───────────────────────────────────────────────────────────

    /**
     * Create a new sponsor (entity). Gated by POST_SPONSOR_CREATE.
     * Real route: apps/admin/src/routes/_authed/sponsors/new.tsx
     */
    newSponsor: {
        id: 'newSponsor',
        label: { es: 'Nuevo sponsor', en: 'New sponsor', pt: 'Novo patrocinador' },
        route: '/sponsors/new',
        icon: 'PostSponsorIcon',
        permissions: ['POST_SPONSOR_CREATE']
    },

    /**
     * Create a new promo code. Gated by DISCOUNT_CODE_CREATE.
     * Real route: apps/admin/src/routes/_authed/billing/promo-codes.tsx
     * (no dedicated /new route — action triggers modal, route points to list)
     */
    newPromoCode: {
        id: 'newPromoCode',
        label: { es: 'Nuevo código promo', en: 'New promo code', pt: 'Novo código promo' },
        route: '/billing/promo-codes',
        icon: 'CouponsIcon',
        permissions: ['DISCOUNT_CODE_CREATE']
    },

    // ── Plataforma ──────────────────────────────────────────────────────────

    /**
     * Create a new system tag. Gated by TAG_SYSTEM_CREATE.
     * Real route: apps/admin/src/routes/_authed/tags/system/new.tsx
     */
    newSystemTag: {
        id: 'newSystemTag',
        label: { es: 'Nuevo tag de sistema', en: 'New system tag', pt: 'Novo tag de sistema' },
        route: '/tags/system/new',
        icon: 'TagIcon',
        permissions: ['TAG_SYSTEM_CREATE']
    },

    /**
     * Create a new internal tag. Gated by TAG_INTERNAL_CREATE.
     * Real route: apps/admin/src/routes/_authed/tags/internal/new.tsx
     */
    newInternalTag: {
        id: 'newInternalTag',
        label: { es: 'Nuevo tag interno', en: 'New internal tag', pt: 'Novo tag interno' },
        route: '/tags/internal/new',
        icon: 'TagIcon',
        permissions: ['TAG_INTERNAL_CREATE']
    }
};
