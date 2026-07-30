import { z } from 'zod';

const idSchema = z.string().min(1);
const slugSchema = z.string().min(1);
const localeSchema = z.string().min(2).max(8).optional();
const nullableStringSchema = z.string().min(1).nullable().optional();
const nullableNumberSchema = z.number().finite().nullable().optional();
const countSchema = z.number().int().nonnegative();

/** Shared analytics event catalog for Hospeda. */
export const AnalyticsEvents = {
    destinationViewed: 'destination_viewed',
    accommodationViewed: 'accommodation_viewed',
    eventViewed: 'event_viewed',
    postViewed: 'post_viewed',
    searchPerformed: 'search_performed',
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
    subscriptionCheckoutStarted: 'subscription_checkout_started',
    subscriptionCreated: 'subscription_created',
    subscriptionPaymentSucceeded: 'subscription_payment_succeeded',
    subscriptionPaymentFailed: 'subscription_payment_failed',
    trialConvertedToPaid: 'trial_converted_to_paid',
    newsletterSubscribed: 'newsletter_subscribed',
    favoriteAdded: 'favorite_added',
    favoriteRemoved: 'favorite_removed',
    reviewSubmitted: 'review_submitted',
    aiSearchPerformed: 'ai_search_performed',
    aiSearchIntentApplied: 'ai_search_intent_applied',
    aiSearchFallbackKeyword: 'ai_search_fallback_keyword',
    aiSearchLoginPrompted: 'ai_search_login_prompted',
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
    [AnalyticsEvents.accommodationViewed]: z.object({
        accommodation_id: idSchema,
        accommodation_slug: slugSchema,
        accommodation_type: z.string().min(1).optional(),
        destination_id: idSchema.optional(),
        destination_slug: slugSchema.optional(),
        is_featured: z.boolean().optional(),
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.eventViewed]: z.object({
        event_id: idSchema,
        event_slug: slugSchema,
        locale: localeSchema,
        source_page: z.string().min(1).optional()
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
    [AnalyticsEvents.contactOwnerStarted]: z.object({
        accommodation_id: idSchema,
        destination_id: idSchema.optional(),
        owner_id: idSchema.optional(),
        contact_method: z.string().min(1),
        is_authenticated: z.boolean(),
        locale: localeSchema,
        source_page: z.string().min(1).optional()
    }),
    [AnalyticsEvents.contactOwnerCompleted]: z.object({
        accommodation_id: idSchema,
        destination_id: idSchema.optional(),
        owner_id: idSchema.optional(),
        contact_method: z.string().min(1),
        conversation_flow: z.string().min(1),
        is_authenticated: z.boolean(),
        locale: localeSchema
    }),
    [AnalyticsEvents.contactOwnerFailed]: z.object({
        accommodation_id: idSchema.optional(),
        destination_id: idSchema.optional(),
        owner_id: idSchema.optional(),
        contact_method: z.string().min(1).optional(),
        failure_reason: z.string().min(1),
        is_authenticated: z.boolean().optional(),
        locale: localeSchema
    }),
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
    [AnalyticsEvents.subscriptionCheckoutStarted]: z.object({
        amount: nullableNumberSchema,
        billing_period: z.enum(['monthly', 'annual']),
        currency: nullableStringSchema,
        plan_slug: slugSchema,
        promotion_code: nullableStringSchema
    }),
    [AnalyticsEvents.subscriptionCreated]: z.object({
        amount: nullableNumberSchema,
        billing_period: z.enum(['monthly', 'annual']),
        checkout_outcome: z.enum(['paid', 'trial', 'discount', 'comp']).optional(),
        currency: nullableStringSchema,
        plan_slug: slugSchema,
        promotion_code: nullableStringSchema,
        promotion_code_ignored: z.boolean().optional(),
        subscription_id: idSchema.nullable().optional(),
        trial_granted: z.boolean().optional(),
        $set: z.record(z.string(), z.string()).optional()
    }),
    [AnalyticsEvents.subscriptionPaymentSucceeded]: z.object({
        amount: nullableNumberSchema,
        currency: nullableStringSchema,
        payment_kind: nullableStringSchema,
        payment_method: nullableStringSchema,
        payment_provider: z.string().min(1),
        source: nullableStringSchema,
        $set: z.record(z.string(), z.string()).optional()
    }),
    [AnalyticsEvents.subscriptionPaymentFailed]: z.object({
        amount: nullableNumberSchema,
        currency: nullableStringSchema,
        failure_category: nullableStringSchema,
        failure_reason: nullableStringSchema,
        payment_provider: z.string().min(1),
        source: nullableStringSchema
    }),
    [AnalyticsEvents.trialConvertedToPaid]: z.object({
        amount: nullableNumberSchema,
        converted_billing_period: z.enum(['monthly', 'annual']).nullable().optional(),
        currency: nullableStringSchema,
        intended_billing_period: z.enum(['monthly', 'annual']).nullable().optional(),
        new_subscription_id: idSchema.nullable().optional(),
        plan_slug: slugSchema.nullable().optional(),
        source: nullableStringSchema,
        superseded_subscription_id: idSchema.nullable().optional(),
        trigger_source: nullableStringSchema
    }),
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
        source: nullableStringSchema,
        tour_id: idSchema
    }),
    [AnalyticsEvents.adminTourCompleted]: z.object({
        role: nullableStringSchema,
        tour_id: idSchema
    }),
    [AnalyticsEvents.adminTourSkipped]: z.object({
        role: nullableStringSchema,
        source: nullableStringSchema,
        tour_id: idSchema
    }),
    [AnalyticsEvents.adminWhatsNewPanelOpened]: z.object({
        role: nullableStringSchema,
        unseen_count: countSchema.optional()
    }),
    [AnalyticsEvents.adminWhatsNewModalShown]: z.object({
        entry_count: countSchema,
        role: nullableStringSchema
    }),
    [AnalyticsEvents.adminWhatsNewModalClosed]: z.object({
        entry_count: countSchema
    }),
    [AnalyticsEvents.aiChatOpened]: z.object({
        accommodation_id: idSchema,
        locale: localeSchema,
        message_count: countSchema.optional()
    }),
    [AnalyticsEvents.aiChatCapReached]: z.object({
        accommodation_id: idSchema,
        locale: localeSchema,
        message_count: countSchema.optional()
    }),
    [AnalyticsEvents.aiChatMessageSent]: z.object({
        accommodation_id: idSchema,
        conversation_id: idSchema.nullable().optional(),
        locale: localeSchema,
        message_count: countSchema.optional()
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
