import type { CatalogKeyDefinition } from './key-attributes.js';
import { type KeyRow, toDefinitions } from './key-row.js';

/**
 * Every limit (numeric) key the new design keeps.
 *
 * Names and declared attributes ONLY (scope, aggregation, enforcement, class).
 * No value, price or plan assignment lives here (INV:15, INV:16).
 * Row shape: `[key, scope, aggregation, enforcement, class]`.
 */
const ROWS: readonly KeyRow[] = [
    ['max_accommodations', 'vertical', 'SUM', 'UNPUBLISH', 'COMERCIAL'],
    ['max_gastronomies', 'vertical', 'SUM', 'UNPUBLISH', 'COMERCIAL'],
    ['max_experiences', 'vertical', 'SUM', 'UNPUBLISH', 'COMERCIAL'],
    ['max_properties', 'vertical', 'SUM', 'UNPUBLISH', 'COMERCIAL'],
    ['max_photos_per_accommodation', 'vertical', 'SUM', 'ARCHIVE', 'COMERCIAL'],
    ['max_active_promotions', 'vertical', 'SUM', 'ARCHIVE', 'COMERCIAL'],
    ['max_active_private_galleries', 'vertical', 'SUM', 'ARCHIVE', 'COMERCIAL'],
    ['max_favorites', 'vertical', 'SUM', 'ARCHIVE', 'COMERCIAL'],
    ['max_collections', 'vertical', 'SUM', 'ARCHIVE', 'COMERCIAL'],
    ['max_search_history_entries', 'vertical', 'MAX', 'ARCHIVE', 'COMERCIAL'],
    ['max_staff_accounts', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_active_alerts', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_compare_items', 'vertical', 'MAX', 'NONE', 'COMERCIAL'],
    ['max_ai_text_improve_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_chat_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_chat_consumer_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_chat_gastronomy_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_chat_experience_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_search_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_support_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_translate_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL'],
    ['max_ai_accommodation_import_per_month', 'vertical', 'SUM', 'DISABLE', 'COMERCIAL']
];

/** Every limit (numeric) key the new design keeps. */
export const LIMIT_KEY_DEFINITIONS: readonly CatalogKeyDefinition[] = toDefinitions({
    kind: 'limit',
    rows: ROWS
});
