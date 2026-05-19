/**
 * @file events.ts
 * @description Typed catalog of explicit PostHog event names for the web
 * app (SPEC-140).
 *
 * Autocapture is enabled in the PostHog project settings, so most clicks
 * + form submits already arrive as auto-captured events. This catalog
 * lists the SMALL set of business events we capture explicitly to make
 * them discoverable + correlatable across funnels (search → view →
 * booking-initiation, signup → first-action, etc.).
 *
 * Call site usage:
 *
 * ```ts
 * import { trackEvent } from '@/lib/analytics/posthog-client';
 * import { WebEvents } from '@/lib/analytics/events';
 *
 * trackEvent(WebEvents.AccommodationSearched, { query, locale });
 * ```
 *
 * When adding a new event, follow the existing naming convention:
 * `<entity>_<verb_in_past_tense>` with snake_case (matches the PostHog
 * autocapture convention and aligns with the SQL-friendly event ID
 * pattern).
 */

export const WebEvents = {
    /** User submitted the search bar. Props: `query`, `locale`. */
    AccommodationSearched: 'accommodation_searched',

    /** Accommodation detail page was loaded. Props: `slug`, `locale`. */
    AccommodationViewed: 'accommodation_viewed',

    /** Better Auth signup flow completed. Props: `provider` (email | google | facebook). */
    SignupCompleted: 'signup_completed',

    /** Visitor clicked the "contact host" CTA on an accommodation detail. Props: `slug`. */
    BookingInitiated: 'booking_initiated',

    /** Newsletter subscription form completed successfully. Props: `source` (footer | inline). */
    NewsletterSubscribed: 'newsletter_subscribed'
} as const;

/** Union of all explicit web event names — safe to use as a function argument type. */
export type WebEventName = (typeof WebEvents)[keyof typeof WebEvents];
