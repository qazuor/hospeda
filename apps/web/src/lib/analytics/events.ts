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
    NewsletterSubscribed: 'newsletter_subscribed',

    /**
     * Visitor clicked a ContributionBanner CTA (SPEC-191). Props: `source`
     * (destination_detail | destination_listing | blog_listing | events_listing),
     * `variant` (photos | editors).
     */
    ContributionBannerClicked: 'contribution_banner_clicked',

    /** Destination-info report form submitted successfully (SPEC-191). Props: `destino?`, `locale`. */
    ContributionReportSubmitted: 'contribution_report_submitted',

    /** Photo-contribution form submitted successfully (SPEC-191). Props: `locale`. */
    ContributionPhotoSubmitted: 'contribution_photo_submitted',

    /** Editor-application form submitted successfully (SPEC-191). Props: `locale`. */
    ContributionEditorSubmitted: 'contribution_editor_submitted',

    /**
     * Blog post detail page was loaded (SPEC-159 T-013).
     * Props: `slug`, `post_id`, `locale`.
     */
    PostViewed: 'post_viewed',

    /**
     * Event detail page was loaded (SPEC-159 T-013).
     * Props: `slug`, `event_id`, `locale`.
     */
    EventViewed: 'event_viewed',

    // ── AI Natural-Language Search (SPEC-199) ─────────────────────────────────

    /**
     * User submitted the NL search form (SPEC-199 Q10).
     * Props: `locale`, `queryLength`.
     */
    AiSearchSubmitted: 'ai_search_submitted',

    /**
     * Extracted intent was applied to the search results navigation (SPEC-199 Q10).
     * Props: `confidence`, `slotsExtracted: number`, `fallback: boolean`.
     */
    AiSearchIntentApplied: 'ai_search_intent_applied',

    /**
     * Search fell back to plain keyword mode (SPEC-199 Q10).
     * Props: `reason: 'low_confidence' | 'api_error'`, `confidence?: number`.
     */
    AiSearchFallbackKeyword: 'ai_search_fallback_keyword',

    /**
     * Anonymous user was prompted to log in when submitting NL search (SPEC-199 Q10).
     * Props: `locale`.
     */
    AiSearchLoginPrompted: 'ai_search_login_prompted',

    // ── Property Import (SPEC-258) ────────────────────────────────────────────

    /**
     * Host triggered an import-from-URL attempt (SPEC-258 A7).
     * Props: `source` (the detected ImportSource, e.g. 'airbnb').
     * Fired after the import API call is initiated (i.e. the user submitted the URL form).
     */
    PropertyImportAttempted: 'property_import_attempted',

    /**
     * Import-from-URL completed successfully (SPEC-258 A7).
     * Props: `source` (ImportSource), `fieldsPrefilled` (count of fields set in the form).
     * No PII: counts only, no field values.
     */
    PropertyImportSucceeded: 'property_import_succeeded',

    /**
     * Import-from-URL failed (SPEC-258 A7).
     * Props: `source` (ImportSource | 'unknown').
     */
    PropertyImportFailed: 'property_import_failed'
} as const;

/** Union of all explicit web event names — safe to use as a function argument type. */
export type WebEventName = (typeof WebEvents)[keyof typeof WebEvents];
