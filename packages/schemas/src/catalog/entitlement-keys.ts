import type { CatalogKeyDefinition } from './key-attributes.js';
import { type KeyRow, toDefinitions } from './key-row.js';

/**
 * Every entitlement (boolean) key the new design keeps.
 *
 * Names and declared attributes ONLY (scope, aggregation, enforcement, class).
 * No value, price or plan assignment lives here (INV:15, INV:16). Some keys have
 * no gate in code today because the old billing gates were removed; later units
 * re-gate them, so they stay in the catalog. Row shape: `[key, scope, aggregation, enforcement, class]`.
 */
const ROWS: readonly KeyRow[] = [
    ['publish_accommodations', 'vertical', 'MAX', 'UNPUBLISH', 'COMMERCIAL'],
    ['publish_gastronomy', 'vertical', 'MAX', 'UNPUBLISH', 'COMMERCIAL'],
    ['publish_experience', 'vertical', 'MAX', 'UNPUBLISH', 'COMMERCIAL'],
    ['edit_accommodation_info', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['edit_gastronomy_info', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['edit_experience_info', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['view_basic_stats', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['view_advanced_stats', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['respond_reviews', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['priority_support', 'global', 'MAX', 'NONE', 'COMMERCIAL'],
    ['featured_listing', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['custom_branding', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['create_promotions', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_use_rich_description', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_embed_video', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_use_calendar', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_sync_external_calendar', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_contact_whatsapp_display', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_contact_whatsapp_direct', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['has_verification_badge', 'global', 'MAX', 'NONE', 'COMMERCIAL'],
    ['download_listing_pdf', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['manage_gastronomy_menu', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['menu_item_photos', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['manage_gastronomy_daily_special', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['manage_gastronomy_events', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['multilingual_gastronomy_menu', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['menu_qr_scan_metrics', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['issue_experience_certificate', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['manage_experience_directions', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['manage_experience_private_galleries', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['multi_property_management', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['consolidated_analytics', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['centralized_booking', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['staff_management', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['save_favorites', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['write_reviews', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['price_alerts', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['exclusive_deals', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['vip_support', 'global', 'MAX', 'NONE', 'COMMERCIAL'],
    ['vip_visibility_access', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['vip_promotions_access', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_compare_accommodations', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_attach_review_photos', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_view_search_history', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_view_recommendations', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['can_use_collections', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['ai_text_improve', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['ai_chat', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['ai_search', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['ai_support', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['ai_translate', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['ai_accommodation_import', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    // Two separate keys (HOS-1352 DEC-ENT-006): the public page is granted by Gold only,
    // the carousel presence by Gold and Silver. Who gets which is a plan assignment, not code.
    ['partner_public_page', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['partner_carousel_presence', 'vertical', 'MAX', 'NONE', 'COMMERCIAL'],
    ['recover_own_listing', 'vertical', 'MAX', 'NONE', 'BASE'],
    ['subscribe_to_plan', 'vertical', 'MAX', 'NONE', 'BASE']
];

/** Every entitlement (boolean) key the new design keeps. */
export const ENTITLEMENT_KEY_DEFINITIONS: readonly CatalogKeyDefinition[] = toDefinitions({
    kind: 'entitlement',
    rows: ROWS
});
