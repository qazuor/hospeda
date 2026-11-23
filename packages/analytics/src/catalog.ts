import { z } from 'zod';
import { AddonAnalyticsEventSchemas, BillingAnalyticsEventSchemas } from './catalog-billing.js';

const idSchema = z.string().min(1);
const slugSchema = z.string().min(1);
const localeSchema = z.string().min(2).max(8).optional();

/** Surfaces from which a visitor can initiate listing contact. */
export const ContactOriginSchema = z.enum([
    'bar',
    'panel',
    'summary',
    'sidebar',
    'contact_block',
    'gallery',
    'tabs'
]);
const nullableStringSchema = z.string().min(1).nullable().optional();
const nullableNumberSchema = z.number().finite().nullable().optional();
const countSchema = z.number().int().nonnegative();

/**
 * Entity types that can carry `entity_id` / `entity_type` on view and contact
 * events. Mirrors `TRACKABLE_ENTITY_TYPES` in `@repo/schemas` (this package
 * does not depend on it; parity is asserted in `apps/api` catalog-parity test).
 */
export const ANALYTICS_ENTITY_TYPES = [
    'ACCOMMODATION',
    'POST',
    'EVENT',
    'VENUE',
    'EXPERIENCE',
    'PARTNER'
] as const;

/** Entity types that emit the generic `entity_viewed` event (no dedicated view event). */
export const ANALYTICS_ENTITY_VIEWED_TYPES = ['VENUE', 'EXPERIENCE', 'PARTNER'] as const;

/** Entity-id schema: must be the entity UUID (Umami filters on `pf_entity_id=eq.<uuid>`). */
const entityIdSchema = z.string().uuid();
const entityViewedTypeSchema = z.enum(ANALYTICS_ENTITY_VIEWED_TYPES);

/**
 * Listing types that have an owner-facing traffic page (and so an internal-entry
 * event): the subset of `ANALYTICS_ENTITY_TYPES` a user can own. Mirrors
 * `LISTING_TRAFFIC_STATS_ENTITY_TYPES` in `@repo/schemas` (this package does not
 * depend on it); parity is asserted in apps/api `catalog-parity.test.ts`.
 */
export const ANALYTICS_LISTING_ENTITY_TYPES = [
    'ACCOMMODATION',
    'VENUE',
    'EXPERIENCE',
    'PARTNER'
] as const;

/**
 * Optional, additive entity identification shared by the accommodation view
 * and contact events. These events only ever describe an ACCOMMODATION; other
 * types use `entity_viewed`.
 */
const optionalEntityShape = {
    entity_id: entityIdSchema.optional(),
    entity_type: z.literal('ACCOMMODATION').optional()
};

/** Refinement: `entity_id` and `entity_type` must come together (both or neither). */
const entityPairRefinement = {
    check: (value: { entity_id?: string | undefined; entity_type?: string | undefined }) =>
        (value.entity_id === undefined) === (value.entity_type === undefined),
    params: {
        message: 'entity_id and entity_type must be provided together',
        path: ['entity_id']
    }
};

/** Shared analytics event catalog for Hospeda. */
export const AnalyticsEvents = {
    destinationViewed: 'destination_viewed',
    accommodationViewed: 'accommodation_viewed',
    eventViewed: 'event_viewed',
    entityViewed: 'entity_viewed',
    postViewed: 'post_viewed',
    searchPerformed: 'search_performed',
    listingInternalEntry: 'listing_internal_entry',
    listingContactClicked: 'listing_contact_clicked',
    contactOwnerStarted: 'contact_owner_started',
    contactOwnerCompleted: 'contact_owner_completed',
    contactOwnerFailed: 'contact_owner_failed',
    signUpStarted: 'sign_up_started',
    signUpCompleted: 'sign_up_completed',
    signInCompleted: 'sign_in_completed',
    onboardingStarted: 'onboarding_started',
    accommodationDraftSaved: 'accommodation_draft_saved',
    accommodationImportStarted: 'accommodation_import_started',
    accommodationImportCompleted: 'accommodation_import_completed',
    accommodationImportFailed: 'accommodation_import_failed',
    accommodationPublished: 'accommodation_published',
    billingCheckoutStarted: 'billing_checkout_started',
    billingCheckoutAbandoned: 'billing_checkout_abandoned',
    billingSubscriptionActivated: 'billing_subscription_activated',
    billingPlanChanged: 'billing_plan_changed',
    billingChargeSucceeded: 'billing_charge_succeeded',
    billingChargeDeclined: 'billing_charge_declined',
    billingGraceEntered: 'billing_grace_entered',
    billingSubscriptionSuspended: 'billing_subscription_suspended',
    billingSubscriptionRecovered: 'billing_subscription_recovered',
    billingCancelScheduled: 'billing_cancel_scheduled',
    billingSubscriptionCancelled: 'billing_subscription_cancelled',
    addonCheckoutStarted: 'addon_checkout_started',
    addonCheckoutAbandoned: 'addon_checkout_abandoned',
    addonActivated: 'addon_activated',
    addonChargeSucceeded: 'addon_charge_succeeded',
    addonChargeDeclined: 'addon_charge_declined',
    addonCancelled: 'addon_cancelled',
    addonGrantedFree: 'addon_granted_free',
    trialStarted: 'trial_started',
    trialConverted: 'trial_converted',
    trialExpired: 'trial_expired',
    newsletterSubscribed: 'newsletter_subscribed',
    favoriteAdded: 'favorite_added',
    favoriteRemoved: 'favorite_removed',
    reviewSubmitted: 'review_submitted',
    aiSearchPerformed: 'ai_search_performed',
    aiSearchIntentApplied: 'ai_search_intent_applied',
    aiSearchFallbackKeyword: 'ai_search_fallback_keyword',
    aiSearchLoginPrompted: 'ai_search_login_prompted',
    aiSearchFailed: 'ai_search_failed',
    contributionBannerClicked: 'contribution_banner_clicked',
    contributionReportSubmitted: 'contribution_report_submitted',
    contributionPhotoSubmitted: 'contribution_photo_submitted',
    contributionEditorSubmitted: 'contribution_editor_submitted',
    adminTourShown: 'admin_tour_shown',
    adminTourCompleted: 'admin_tour_completed',
    adminTourSkipped: 'admin_tour_skipped',
    adminWhatsNewPanelOpened: 'admin_whats_new_panel_opened',
    adminWhatsNewModalShown: 'admin_whats_new_modal_shown',
    adminWhatsNewModalClosed: 'admin_whats_new_modal_closed',
    aiChatOpened: 'ai_chat_opened',
    aiChatCapReached: 'ai_chat_cap_reached',
    aiChatMessageSent: 'ai_chat_message_sent',
    aiChatModerationBlocked: 'ai_chat_moderation_blocked',
    aiChatResponseCompleted: 'ai_chat_response_completed',
    aiFallback: 'ai_fallback',
    aiCallExhausted: 'ai_call_exhausted',
    aiKillSwitchHit: 'ai_kill_switch_hit',
    aiModerationBlocked: 'ai_moderation_blocked',
    aiFeatureUsed: 'ai_feature_used'
} as const;

export const AnalyticsEventSchemas = {
    [AnalyticsEvents.destinationViewed]: z.object({
        destination_id: idSchema,
        destination_slug: slugSchema,
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.accommodationViewed]: z
        .object({
            accommodation_id: idSchema,
            ...optionalEntityShape,
            accommodation_slug: slugSchema,
            accommodation_type: z.string().min(1).optional(),
            destination_id: idSchema.optional(),
            destination_slug: slugSchema.optional(),
            is_featured: z.boolean().optional(),
            locale: localeSchema,
            source_page: z.string().min(1).optional()
        })
        .refine(entityPairRefinement.check, entityPairRefinement.params),
    [AnalyticsEvents.eventViewed]: z.object({
        event_id: idSchema,
        event_slug: slugSchema,
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.entityViewed]: z.object({
        entity_type: entityViewedTypeSchema,
        entity_id: entityIdSchema,
        locale: localeSchema
    }),
    [AnalyticsEvents.postViewed]: z.object({
        post_id: idSchema,
        post_slug: slugSchema,
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.searchPerformed]: z.object({
        search_type: z.string().min(1),
        destination_id: idSchema.nullable().optional(),
        destination_slug: slugSchema.nullable().optional(),
        has_dates: z.boolean().optional(),
        adult_count: countSchema.optional(),
        child_count: countSchema.optional(),
        filter_count: countSchema.optional(),
        result_count: countSchema.optional(),
        locale: localeSchema,
        query_length: countSchema.optional(),
        source_page: z.string().min(1).optional()
    }),
    /*
     * A listing detail page was entered from another page of the same site.
     * Umami hides same-site referrers, so without this event that navigation is
     * indistinguishable from a direct visit in the owner traffic stats
     * (HOS-2119 T-075). Sent with `tag=<entity_id>`; the API reads DISTINCT
     * visitors through `metrics/expanded?type=event`.
     */
    [AnalyticsEvents.listingInternalEntry]: z.object({
        entity_id: entityIdSchema,
        entity_type: z.enum(ANALYTICS_LISTING_ENTITY_TYPES),
        locale: localeSchema
    }),
    [AnalyticsEvents.listingContactClicked]: z.object({
        listing_id: idSchema,
        vertical: z.enum(['accommodation', 'experience', 'venue', 'partner']),
        channel: z.enum(['whatsapp', 'phone', 'email', 'website', 'menu', 'social', 'form_open']),
        origin: ContactOriginSchema,
        is_whatsapp_entitled: z.boolean().optional(),
        locale: localeSchema
    }),
    [AnalyticsEvents.contactOwnerStarted]: z
        .object({
            accommodation_id: idSchema,
            ...optionalEntityShape,
            destination_id: idSchema.optional(),
            owner_id: idSchema.optional(),
            contact_method: z.string().min(1),
            is_authenticated: z.boolean(),
            locale: localeSchema,
            source_page: z.string().min(1).optional(),
            origin: ContactOriginSchema.optional()
        })
        .refine(entityPairRefinement.check, entityPairRefinement.params),
    [AnalyticsEvents.contactOwnerCompleted]: z
        .object({
            accommodation_id: idSchema,
            ...optionalEntityShape,
            destination_id: idSchema.optional(),
            owner_id: idSchema.optional(),
            contact_method: z.string().min(1),
            conversation_flow: z.string().min(1),
            is_authenticated: z.boolean(),
            locale: localeSchema,
            source_page: z.string().min(1).optional(),
            origin: ContactOriginSchema.optional()
        })
        .refine(entityPairRefinement.check, entityPairRefinement.params),
    [AnalyticsEvents.contactOwnerFailed]: z
        .object({
            accommodation_id: idSchema.optional(),
            ...optionalEntityShape,
            destination_id: idSchema.optional(),
            owner_id: idSchema.optional(),
            contact_method: z.string().min(1).optional(),
            failure_reason: z.string().min(1),
            is_authenticated: z.boolean().optional(),
            locale: localeSchema,
            source_page: z.string().min(1).optional(),
            origin: ContactOriginSchema.optional()
        })
        .refine(entityPairRefinement.check, entityPairRefinement.params),
    [AnalyticsEvents.signUpStarted]: z.object({
        auth_method: z.string().min(1),
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.signUpCompleted]: z.object({
        auth_method: z.string().min(1),
        role: z.string().min(1).optional(),
        user_type: z.string().min(1).optional()
    }),
    [AnalyticsEvents.signInCompleted]: z.object({
        auth_method: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        user_type: z.string().min(1).optional()
    }),
    [AnalyticsEvents.onboardingStarted]: z.object({
        onboarding_type: z.string().min(1),
        draft_source: z.string().min(1).optional()
    }),
    [AnalyticsEvents.accommodationDraftSaved]: z.object({
        accommodation_id: idSchema,
        accommodation_type: z.string().min(1).optional(),
        creation_source: z.string().min(1).optional(),
        destination_id: idSchema.optional(),
        import_source: z.string().min(1).nullable().optional()
    }),
    [AnalyticsEvents.accommodationImportStarted]: z.object({
        import_mode: z.string().min(1).optional(),
        import_source: nullableStringSchema
    }),
    [AnalyticsEvents.accommodationImportCompleted]: z.object({
        accommodation_id: idSchema.nullable().optional(),
        import_source: nullableStringSchema,
        partial: z.boolean().nullable().optional(),
        prefilled_field_count: nullableNumberSchema
    }),
    [AnalyticsEvents.accommodationImportFailed]: z.object({
        failure_reason: nullableStringSchema,
        import_source: nullableStringSchema
    }),
    [AnalyticsEvents.accommodationPublished]: z.object({
        accommodation_id: idSchema,
        accommodation_type: z.string().min(1).optional(),
        destination_id: idSchema.optional(),
        is_first_publication: z.boolean().nullable().optional(),
        owner_id: idSchema.optional()
    }),
    ...BillingAnalyticsEventSchemas,
    ...AddonAnalyticsEventSchemas,
    [AnalyticsEvents.newsletterSubscribed]: z.object({
        is_authenticated: z.boolean().optional(),
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.favoriteAdded]: z.object({
        assigned_collection: z.boolean().optional(),
        entity_id: idSchema,
        entity_type: z.string().min(1)
    }),
    [AnalyticsEvents.favoriteRemoved]: z.object({
        assigned_collection: z.boolean().optional(),
        entity_id: idSchema,
        entity_type: z.string().min(1)
    }),
    [AnalyticsEvents.reviewSubmitted]: z.object({
        accommodation_id: idSchema,
        average_rating: nullableNumberSchema,
        has_content: z.boolean().optional(),
        has_title: z.boolean().optional()
    }),
    [AnalyticsEvents.aiSearchPerformed]: z.object({
        locale: localeSchema,
        query_length: countSchema
    }),
    [AnalyticsEvents.aiSearchIntentApplied]: z.object({
        confidence: nullableNumberSchema,
        extracted_slot_count: countSchema.optional(),
        fallback: z.boolean().optional()
    }),
    [AnalyticsEvents.aiSearchFallbackKeyword]: z.object({
        confidence: nullableNumberSchema,
        failure_reason: z.string().min(1)
    }),
    [AnalyticsEvents.aiSearchLoginPrompted]: z.object({
        locale: localeSchema
    }),
    /*
     * A conversational-search turn that ended in an error the visitor saw.
     *
     * Exists because the failure this records is invisible everywhere else
     * (HOS-668). When the edge answers 5xx the request never reaches the
     * origin, so `api-prod` logs nothing; and when the fetch never leaves the
     * browser there is no server-side trace by construction. The UI already
     * computes the status to pick its copy and then discards it — this event
     * is what keeps it.
     *
     * `error_status` is the discriminator that matters:
     *   > 0  an HTTP response arrived (502/504/520-526 ⇒ the edge, not us)
     *   = 0  the fetch threw — network/DNS/CORS, the request never left
     *   null an SSE-level `error` frame, which carries a code but no status
     */
    [AnalyticsEvents.aiSearchFailed]: z.object({
        error_source: z.enum(['transport', 'sse']),
        error_status: z.number().int().nullable(),
        error_code: nullableStringSchema,
        locale: localeSchema
    }),
    [AnalyticsEvents.contributionBannerClicked]: z.object({
        contribution_variant: z.string().min(1),
        source_page: z.string().min(1)
    }),
    [AnalyticsEvents.contributionReportSubmitted]: z.object({
        destination_slug: slugSchema.optional(),
        locale: localeSchema
    }),
    [AnalyticsEvents.contributionPhotoSubmitted]: z.object({
        locale: localeSchema
    }),
    [AnalyticsEvents.contributionEditorSubmitted]: z.object({
        locale: localeSchema
    }),
    [AnalyticsEvents.adminTourShown]: z.object({
        role: nullableStringSchema,
        roles: z.array(z.string().min(1)).optional(),
        source: nullableStringSchema,
        tour_id: idSchema
    }),
    [AnalyticsEvents.adminTourCompleted]: z.object({
        role: nullableStringSchema,
        roles: z.array(z.string().min(1)).optional(),
        tour_id: idSchema
    }),
    [AnalyticsEvents.adminTourSkipped]: z.object({
        role: nullableStringSchema,
        roles: z.array(z.string().min(1)).optional(),
        source: nullableStringSchema,
        tour_id: idSchema
    }),
    [AnalyticsEvents.adminWhatsNewPanelOpened]: z.object({
        role: nullableStringSchema,
        roles: z.array(z.string().min(1)).optional(),
        unseen_count: countSchema.optional()
    }),
    [AnalyticsEvents.adminWhatsNewModalShown]: z.object({
        entry_count: countSchema,
        role: nullableStringSchema,
        roles: z.array(z.string().min(1)).optional()
    }),
    [AnalyticsEvents.adminWhatsNewModalClosed]: z.object({
        entry_count: countSchema
    }),
    [AnalyticsEvents.aiChatOpened]: z.object({
        accommodation_id: idSchema,
        locale: localeSchema,
        messages_count: countSchema.optional()
    }),
    [AnalyticsEvents.aiChatCapReached]: z.object({
        accommodation_id: idSchema,
        locale: localeSchema,
        messages_count: countSchema.optional()
    }),
    [AnalyticsEvents.aiChatMessageSent]: z.object({
        accommodation_id: idSchema,
        conversation_id: idSchema.nullable().optional(),
        locale: localeSchema,
        messages_count: countSchema.optional()
    }),
    [AnalyticsEvents.aiChatModerationBlocked]: z.object({
        accommodation_id: idSchema,
        conversation_id: idSchema.nullable().optional(),
        locale: localeSchema
    }),
    [AnalyticsEvents.aiChatResponseCompleted]: z.object({
        accommodation_id: idSchema,
        completion_tokens: countSchema.optional(),
        locale: localeSchema,
        model: nullableStringSchema,
        prompt_tokens: countSchema.optional(),
        provider: nullableStringSchema
    }),
    [AnalyticsEvents.aiFallback]: z.object({
        feature: z.string().min(1),
        from_provider: z.string().min(1),
        to_provider: z.string().min(1)
    }),
    [AnalyticsEvents.aiCallExhausted]: z.object({
        feature: z.string().min(1)
    }),
    [AnalyticsEvents.aiKillSwitchHit]: z.object({
        feature: z.string().min(1)
    }),
    [AnalyticsEvents.aiModerationBlocked]: z.object({
        direction: z.string().min(1),
        feature: z.string().min(1)
    }),
    [AnalyticsEvents.aiFeatureUsed]: z.object({
        feature: z.string().min(1),
        provider: nullableStringSchema
    })
} as const;

export type AnalyticsEventName = keyof typeof AnalyticsEventSchemas;

export type AnalyticsEventProperties<TName extends AnalyticsEventName> = z.infer<
    (typeof AnalyticsEventSchemas)[TName]
>;
