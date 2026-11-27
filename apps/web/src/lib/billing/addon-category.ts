/** Closed presentation categories for catalog-driven add-ons. */
export const ADDON_CATEGORIES = ['visibility', 'listings', 'media', 'other'] as const;

/** One presentation category, independent of billing policy. */
export type AddonCategory = (typeof ADDON_CATEGORIES)[number];

/** Every catalog key is classified explicitly; the catalog coverage test guards additions. */
export const ADDON_CATEGORY_BY_KEY: Readonly<Record<string, AddonCategory>> = {
    publish_accommodations: 'other',
    publish_venue: 'other',
    publish_experience: 'other',
    edit_accommodation_info: 'other',
    edit_venue_info: 'other',
    edit_experience_info: 'other',
    view_basic_stats: 'other',
    view_advanced_stats: 'other',
    respond_reviews: 'other',
    priority_support: 'other',
    featured_listing: 'visibility',
    custom_branding: 'other',
    create_promotions: 'other',
    can_use_rich_description: 'other',
    can_embed_video: 'other',
    can_use_calendar: 'other',
    can_sync_external_calendar: 'other',
    can_contact_whatsapp_display: 'other',
    can_contact_whatsapp_direct: 'other',
    has_verification_badge: 'other',
    download_listing_pdf: 'other',
    manage_venue_menu: 'other',
    menu_item_photos: 'other',
    manage_venue_daily_special: 'other',
    manage_venue_events: 'other',
    multilingual_venue_menu: 'other',
    menu_qr_scan_metrics: 'other',
    issue_experience_certificate: 'other',
    manage_experience_directions: 'other',
    manage_experience_private_galleries: 'other',
    multi_property_management: 'other',
    consolidated_analytics: 'other',
    centralized_booking: 'other',
    staff_management: 'other',
    save_favorites: 'other',
    write_reviews: 'other',
    read_reviews: 'other',
    price_alerts: 'other',
    exclusive_deals: 'other',
    vip_support: 'other',
    vip_visibility_access: 'other',
    vip_promotions_access: 'other',
    vip_only_promotions: 'other',
    can_compare_accommodations: 'other',
    can_attach_review_photos: 'other',
    can_view_search_history: 'other',
    can_view_recommendations: 'other',
    can_use_collections: 'other',
    ai_text_improve: 'other',
    ai_chat: 'other',
    ai_search: 'other',
    ai_support: 'other',
    ai_translate: 'other',
    ai_accommodation_import: 'other',
    ai_faq_draft: 'other',
    ai_assistant_access: 'other',
    partner_public_page: 'other',
    partner_carousel_presence: 'other',
    recover_own_listing: 'other',
    subscribe_to_plan: 'other',
    activate_trial: 'other',
    max_accommodations: 'listings',
    max_venues: 'listings',
    max_experiences: 'listings',
    max_properties: 'listings',
    max_photos_per_accommodation: 'media',
    max_photos_per_venue: 'media',
    max_photos_per_experience: 'media',
    max_active_promotions: 'other',
    max_active_private_galleries: 'other',
    max_favorites: 'other',
    max_collections: 'other',
    max_search_history_entries: 'other',
    max_staff_accounts: 'other',
    max_active_alerts: 'other',
    max_compare_items: 'other',
    max_ai_text_improve_per_month: 'other',
    max_ai_chat_per_month: 'other',
    max_ai_chat_consumer_per_month: 'other',
    max_ai_chat_venue_per_month: 'other',
    max_ai_chat_experience_per_month: 'other',
    max_ai_search_per_month: 'other',
    max_ai_support_per_month: 'other',
    max_ai_translate_per_month: 'other',
    max_ai_accommodation_import_per_month: 'other',
    max_ai_faq_draft_per_month: 'other',
    max_free_visible_promotions: 'other'
};

/** First recognized non-other grant wins; unknown or empty grants remain other. */
export function resolveAddonCategory({
    grantedKeys
}: {
    readonly grantedKeys: readonly string[];
}): AddonCategory {
    for (const key of grantedKeys) {
        if (!Object.hasOwn(ADDON_CATEGORY_BY_KEY, key)) continue;
        const category = ADDON_CATEGORY_BY_KEY[key];
        if (category && category !== 'other') return category;
    }
    return 'other';
}
