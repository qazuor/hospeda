import type { CatalogKeyDefinition } from './key-attributes.js';
import { type KeyRow, toDefinitions } from './key-row.js';

/**
 * Every entitlement (boolean) key the new design keeps.
 *
 * Names and declared attributes ONLY (scope, aggregation, enforcement, class).
 * No value, price or plan assignment lives here (INV:15, INV:16).
 * Row shape: `[key, scope, aggregation, enforcement, class]`.
 */
const ROWS: readonly KeyRow[] = [
    ['publish_accommodations', 'vertical', 'MAX', 'UNPUBLISH', 'COMERCIAL'],
    ['publish_gastronomy', 'vertical', 'MAX', 'UNPUBLISH', 'COMERCIAL'],
    ['publish_experience', 'vertical', 'MAX', 'UNPUBLISH', 'COMERCIAL'],
    ['edit_accommodation_info', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['edit_gastronomy_info', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['edit_experience_info', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['view_basic_stats', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['view_advanced_stats', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['respond_reviews', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['priority_support', 'global', 'MAX', 'NONE', 'COMERCIAL'],
    ['featured_listing', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['custom_branding', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['create_promotions', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_use_rich_description', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_embed_video', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_use_calendar', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_sync_external_calendar', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_contact_whatsapp_display', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_contact_whatsapp_direct', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['has_verification_badge', 'global', 'MAX', 'NONE', 'COMERCIAL'],
    ['download_listing_pdf', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['manage_gastronomy_menu', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['menu_item_photos', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['manage_gastronomy_daily_special', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['manage_gastronomy_events', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['multilingual_gastronomy_menu', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['menu_qr_scan_metrics', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['issue_experience_certificate', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['manage_experience_directions', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['manage_experience_private_galleries', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['multi_property_management', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['consolidated_analytics', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['centralized_booking', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['staff_management', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['save_favorites', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['write_reviews', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['price_alerts', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['exclusive_deals', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['vip_support', 'global', 'MAX', 'NONE', 'COMERCIAL'],
    ['vip_visibility_access', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['vip_promotions_access', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_compare_accommodations', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_attach_review_photos', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_view_search_history', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_view_recommendations', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['can_use_collections', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['ai_text_improve', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['ai_chat', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['ai_search', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['ai_support', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['ai_translate', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['ai_accommodation_import', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['partner_public_page', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['partner_carousel_presence', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['recover_own_listing', 'vertical', 'MAX', 'NONE', 'DE_ACCESO'],
    ['subscribe_to_plan', 'vertical', 'MAX', 'NONE', 'DE_ACCESO']
];

/** Every entitlement (boolean) key the new design keeps. */
export const ENTITLEMENT_KEY_DEFINITIONS: readonly CatalogKeyDefinition[] = toDefinitions({
    kind: 'entitlement',
    rows: ROWS
});
