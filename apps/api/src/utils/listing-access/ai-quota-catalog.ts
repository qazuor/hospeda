import type { AiFeature } from '@repo/schemas';

/** Catalog entitlement key required by each metered AI feature. */
export const AI_ENTITLEMENT_KEY_BY_FEATURE = {
    text_improve: 'ai_text_improve',
    chat: 'ai_chat',
    chat_venue: 'ai_chat',
    chat_experience: 'ai_chat',
    search: 'ai_search',
    support: 'ai_support',
    translate: 'ai_translate',
    accommodation_import: 'ai_accommodation_import',
    faq_draft: 'ai_faq_draft'
} as const satisfies Partial<Record<AiFeature, string>>;

/** Catalog monthly limit key used by each metered AI feature. */
export const AI_LIMIT_KEY_BY_FEATURE = {
    text_improve: 'max_ai_text_improve_per_month',
    chat: 'max_ai_chat_per_month',
    chat_venue: 'max_ai_chat_venue_per_month',
    chat_experience: 'max_ai_chat_experience_per_month',
    search: 'max_ai_search_per_month',
    support: 'max_ai_support_per_month',
    translate: 'max_ai_translate_per_month',
    accommodation_import: 'max_ai_accommodation_import_per_month',
    faq_draft: 'max_ai_faq_draft_per_month'
} as const satisfies Partial<Record<AiFeature, string>>;
