import { createHash } from 'node:crypto';

/** Largest PostgreSQL int4 value; Coord-41 represents the measured unlimited limits with it. */
export const UNLIMITED_LIMIT_VALUE = 2147483647;

export interface PlanCatalogDefinition {
    readonly vertical: 'accommodation' | 'gastronomy' | 'experience' | 'tourist' | 'partner';
    readonly slug: string;
    readonly name: string;
    readonly pricingOrder: number;
    readonly role: 'trial' | 'pre_trial' | 'floor' | null;
    readonly version: {
        readonly rank: number;
        readonly sellable: boolean;
        readonly current: boolean;
        readonly graceDays: number;
        readonly trialDays: number;
        readonly allowsPause: boolean;
        readonly inheritsTouristVip: boolean;
        readonly entitlements: readonly {
            readonly key: string;
            readonly planQuota?: number;
            readonly trialQuota?: number;
        }[];
        readonly limits: readonly { readonly key: string; readonly value: number }[];
    };
}

export const PRODUCTION_PLAN_CATALOG = [
    {
        vertical: 'accommodation',
        slug: 'owner-basico',
        name: 'Basic',
        pricingOrder: 1,
        role: null,
        version: {
            rank: 10,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'publish_accommodations'
                },
                {
                    key: 'edit_accommodation_info'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'respond_reviews'
                },
                {
                    key: 'can_use_calendar'
                },
                {
                    key: 'create_promotions'
                },
                {
                    key: 'ai_text_improve',
                    planQuota: 50,
                    trialQuota: 50
                },
                {
                    key: 'ai_chat',
                    planQuota: 50,
                    trialQuota: 50
                },
                {
                    key: 'ai_translate',
                    planQuota: 200,
                    trialQuota: 200
                },
                {
                    key: 'ai_accommodation_import',
                    planQuota: 10,
                    trialQuota: 10
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_accommodations',
                    value: 1
                },
                {
                    key: 'max_photos_per_accommodation',
                    value: 15
                },
                {
                    key: 'max_active_promotions',
                    value: 2
                },
                {
                    key: 'max_ai_text_improve_per_month',
                    value: 50
                },
                {
                    key: 'max_ai_chat_per_month',
                    value: 50
                },
                {
                    key: 'max_ai_translate_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_accommodation_import_per_month',
                    value: 10
                }
            ]
        }
    },
    {
        vertical: 'accommodation',
        slug: 'owner-pro',
        name: 'Professional',
        pricingOrder: 2,
        role: null,
        version: {
            rank: 20,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'publish_accommodations'
                },
                {
                    key: 'edit_accommodation_info'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'respond_reviews'
                },
                {
                    key: 'priority_support'
                },
                {
                    key: 'featured_listing'
                },
                {
                    key: 'create_promotions'
                },
                {
                    key: 'can_use_rich_description'
                },
                {
                    key: 'can_embed_video'
                },
                {
                    key: 'can_use_calendar'
                },
                {
                    key: 'can_sync_external_calendar'
                },
                {
                    key: 'ai_text_improve',
                    planQuota: 250,
                    trialQuota: 50
                },
                {
                    key: 'ai_chat',
                    planQuota: 250,
                    trialQuota: 50
                },
                {
                    key: 'ai_translate',
                    planQuota: 1000,
                    trialQuota: 200
                },
                {
                    key: 'ai_accommodation_import',
                    planQuota: 50,
                    trialQuota: 10
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_accommodations',
                    value: 3
                },
                {
                    key: 'max_photos_per_accommodation',
                    value: 30
                },
                {
                    key: 'max_active_promotions',
                    value: 5
                },
                {
                    key: 'max_ai_text_improve_per_month',
                    value: 250
                },
                {
                    key: 'max_ai_chat_per_month',
                    value: 250
                },
                {
                    key: 'max_ai_translate_per_month',
                    value: 1000
                },
                {
                    key: 'max_ai_accommodation_import_per_month',
                    value: 50
                }
            ]
        }
    },
    {
        vertical: 'accommodation',
        slug: 'owner-premium',
        name: 'Premium',
        pricingOrder: 3,
        role: null,
        version: {
            rank: 30,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'publish_accommodations'
                },
                {
                    key: 'edit_accommodation_info'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'view_advanced_stats'
                },
                {
                    key: 'respond_reviews'
                },
                {
                    key: 'priority_support'
                },
                {
                    key: 'featured_listing'
                },
                {
                    key: 'custom_branding'
                },
                {
                    key: 'create_promotions'
                },
                {
                    key: 'can_use_rich_description'
                },
                {
                    key: 'can_embed_video'
                },
                {
                    key: 'can_use_calendar'
                },
                {
                    key: 'can_sync_external_calendar'
                },
                {
                    key: 'has_verification_badge'
                },
                {
                    key: 'ai_text_improve',
                    planQuota: 1250,
                    trialQuota: 50
                },
                {
                    key: 'ai_chat',
                    planQuota: 1250,
                    trialQuota: 50
                },
                {
                    key: 'ai_translate',
                    planQuota: 5000,
                    trialQuota: 200
                },
                {
                    key: 'ai_accommodation_import',
                    planQuota: 250,
                    trialQuota: 10
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_accommodations',
                    value: 10
                },
                {
                    key: 'max_photos_per_accommodation',
                    value: 50
                },
                {
                    key: 'max_active_promotions',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_ai_text_improve_per_month',
                    value: 1250
                },
                {
                    key: 'max_ai_chat_per_month',
                    value: 1250
                },
                {
                    key: 'max_ai_translate_per_month',
                    value: 5000
                },
                {
                    key: 'max_ai_accommodation_import_per_month',
                    value: 250
                }
            ]
        }
    },
    {
        vertical: 'gastronomy',
        slug: 'gastronomy-basico',
        name: 'Gastronomía Básico',
        pricingOrder: 1,
        role: null,
        version: {
            rank: 10,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'edit_gastronomy_info'
                },
                {
                    key: 'publish_gastronomy'
                },
                {
                    key: 'view_basic_stats'
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_gastronomies',
                    value: 1
                },
                {
                    key: 'max_ai_chat_gastronomy_per_month',
                    value: 0
                },
                {
                    key: 'max_active_private_galleries',
                    value: 0
                }
            ]
        }
    },
    {
        vertical: 'gastronomy',
        slug: 'gastronomy-pro',
        name: 'Gastronomía Profesional',
        pricingOrder: 2,
        role: null,
        version: {
            rank: 20,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'edit_gastronomy_info'
                },
                {
                    key: 'publish_gastronomy'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'manage_gastronomy_menu'
                },
                {
                    key: 'manage_gastronomy_daily_special'
                },
                {
                    key: 'manage_gastronomy_events'
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_gastronomies',
                    value: 3
                },
                {
                    key: 'max_ai_chat_gastronomy_per_month',
                    value: 0
                },
                {
                    key: 'max_active_private_galleries',
                    value: 0
                }
            ]
        }
    },
    {
        vertical: 'gastronomy',
        slug: 'gastronomy-premium',
        name: 'Gastronomía Premium',
        pricingOrder: 3,
        role: null,
        version: {
            rank: 30,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'edit_gastronomy_info'
                },
                {
                    key: 'publish_gastronomy'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'download_listing_pdf'
                },
                {
                    key: 'manage_gastronomy_menu'
                },
                {
                    key: 'manage_gastronomy_daily_special'
                },
                {
                    key: 'manage_gastronomy_events'
                },
                {
                    key: 'menu_item_photos'
                },
                {
                    key: 'ai_chat',
                    planQuota: 1250,
                    trialQuota: 50
                },
                {
                    key: 'multilingual_gastronomy_menu'
                },
                {
                    key: 'menu_qr_scan_metrics'
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_gastronomies',
                    value: 5
                },
                {
                    key: 'max_ai_chat_gastronomy_per_month',
                    value: 1250
                },
                {
                    key: 'max_active_private_galleries',
                    value: 0
                }
            ]
        }
    },
    {
        vertical: 'experience',
        slug: 'experience-basico',
        name: 'Experiencias Básico',
        pricingOrder: 1,
        role: null,
        version: {
            rank: 10,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'edit_experience_info'
                },
                {
                    key: 'publish_experience'
                },
                {
                    key: 'view_basic_stats'
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_experiences',
                    value: 1
                },
                {
                    key: 'max_ai_chat_experience_per_month',
                    value: 0
                },
                {
                    key: 'max_active_private_galleries',
                    value: 0
                }
            ]
        }
    },
    {
        vertical: 'experience',
        slug: 'experience-pro',
        name: 'Experiencias Profesional',
        pricingOrder: 2,
        role: null,
        version: {
            rank: 20,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'edit_experience_info'
                },
                {
                    key: 'publish_experience'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'manage_experience_directions'
                },
                {
                    key: 'issue_experience_certificate'
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_experiences',
                    value: 5
                },
                {
                    key: 'max_ai_chat_experience_per_month',
                    value: 0
                },
                {
                    key: 'max_active_private_galleries',
                    value: 0
                }
            ]
        }
    },
    {
        vertical: 'experience',
        slug: 'experience-premium',
        name: 'Experiencias Premium',
        pricingOrder: 3,
        role: null,
        version: {
            rank: 30,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: true,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'edit_experience_info'
                },
                {
                    key: 'publish_experience'
                },
                {
                    key: 'view_basic_stats'
                },
                {
                    key: 'download_listing_pdf'
                },
                {
                    key: 'manage_experience_directions'
                },
                {
                    key: 'issue_experience_certificate'
                },
                {
                    key: 'ai_chat',
                    planQuota: 1250,
                    trialQuota: 50
                },
                {
                    key: 'manage_experience_private_galleries'
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                },
                {
                    key: 'max_experiences',
                    value: 10
                },
                {
                    key: 'max_ai_chat_experience_per_month',
                    value: 1250
                },
                {
                    key: 'max_active_private_galleries',
                    value: 20
                }
            ]
        }
    },
    {
        vertical: 'tourist',
        slug: 'tourist-vip',
        name: 'VIP',
        pricingOrder: 3,
        role: null,
        version: {
            rank: 10,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'price_alerts'
                },
                {
                    key: 'exclusive_deals'
                },
                {
                    key: 'vip_support'
                },
                {
                    key: 'vip_visibility_access'
                },
                {
                    key: 'vip_promotions_access'
                },
                {
                    key: 'can_compare_accommodations'
                },
                {
                    key: 'can_attach_review_photos'
                },
                {
                    key: 'can_view_search_history'
                },
                {
                    key: 'can_view_recommendations'
                },
                {
                    key: 'can_contact_whatsapp_display'
                },
                {
                    key: 'can_contact_whatsapp_direct'
                },
                {
                    key: 'can_use_collections'
                },
                {
                    key: 'ai_search',
                    planQuota: 200,
                    trialQuota: 200
                },
                {
                    key: 'ai_chat',
                    planQuota: 200,
                    trialQuota: 200
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_active_alerts',
                    value: UNLIMITED_LIMIT_VALUE
                },
                {
                    key: 'max_compare_items',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 200
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 200
                },
                {
                    key: 'max_search_history_entries',
                    value: 200
                },
                {
                    key: 'max_collections',
                    value: 25
                }
            ]
        }
    },
    {
        vertical: 'partner',
        slug: 'partner-silver',
        name: 'Partner Silver',
        pricingOrder: 2,
        role: null,
        version: {
            rank: 10,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'partner_carousel_presence'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'partner',
        slug: 'partner-gold',
        name: 'Partner Gold',
        pricingOrder: 3,
        role: null,
        version: {
            rank: 20,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'partner_public_page'
                },
                {
                    key: 'partner_carousel_presence'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'accommodation',
        slug: 'trial',
        name: 'Accommodation Trial',
        pricingOrder: 0,
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: [
                {
                    key: 'max_accommodations',
                    value: 1
                }
            ]
        }
    },
    {
        vertical: 'accommodation',
        slug: 'pre-trial',
        name: 'Accommodation Pre Trial',
        pricingOrder: 0,
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'activate_trial'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'accommodation',
        slug: 'floor',
        name: 'Accommodation Floor',
        pricingOrder: 0,
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'recover_own_listing'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'gastronomy',
        slug: 'trial',
        name: 'Gastronomy Trial',
        pricingOrder: 0,
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: [
                {
                    key: 'max_gastronomies',
                    value: 1
                }
            ]
        }
    },
    {
        vertical: 'gastronomy',
        slug: 'pre-trial',
        name: 'Gastronomy Pre Trial',
        pricingOrder: 0,
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'activate_trial'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'gastronomy',
        slug: 'floor',
        name: 'Gastronomy Floor',
        pricingOrder: 0,
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'recover_own_listing'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'trial',
        name: 'Experience Trial',
        pricingOrder: 0,
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: [
                {
                    key: 'max_experiences',
                    value: 1
                }
            ]
        }
    },
    {
        vertical: 'experience',
        slug: 'pre-trial',
        name: 'Experience Pre Trial',
        pricingOrder: 0,
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'activate_trial'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'floor',
        name: 'Experience Floor',
        pricingOrder: 0,
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'recover_own_listing'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'tourist',
        slug: 'trial',
        name: 'Tourist Trial',
        pricingOrder: 0,
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 30,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: []
        }
    },
    {
        vertical: 'tourist',
        slug: 'pre-trial',
        name: 'Tourist Pre Trial',
        pricingOrder: 0,
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'activate_trial'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'tourist',
        slug: 'floor',
        name: 'Turista Free',
        pricingOrder: 0,
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'recover_own_listing'
                },
                {
                    key: 'save_favorites'
                },
                {
                    key: 'write_reviews'
                },
                {
                    key: 'ai_search',
                    planQuota: 10,
                    trialQuota: 10
                },
                {
                    key: 'ai_chat',
                    planQuota: 10,
                    trialQuota: 10
                }
            ],
            limits: [
                {
                    key: 'max_favorites',
                    value: 5
                },
                {
                    key: 'max_ai_search_per_month',
                    value: 10
                },
                {
                    key: 'max_ai_chat_consumer_per_month',
                    value: 10
                }
            ]
        }
    },
    {
        vertical: 'partner',
        slug: 'trial',
        name: 'Partner Trial',
        pricingOrder: 0,
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: []
        }
    },
    {
        vertical: 'partner',
        slug: 'pre-trial',
        name: 'Partner Pre Trial',
        pricingOrder: 0,
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                }
            ],
            limits: []
        }
    },
    {
        vertical: 'partner',
        slug: 'floor',
        name: 'Partner Floor',
        pricingOrder: 0,
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [
                {
                    key: 'subscribe_to_plan'
                },
                {
                    key: 'recover_own_listing'
                }
            ],
            limits: []
        }
    }
] as const satisfies readonly PlanCatalogDefinition[];

/** V2.4a fixture retained for the mechanism tests. */
export const PLACEHOLDER_CATALOG = [
    {
        vertical: 'experience',
        slug: 'placeholder-trial',
        name: 'Placeholder Trial',
        pricingOrder: 0,
        role: 'trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 14,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'placeholder-pre-trial',
        name: 'Placeholder Pre Trial',
        pricingOrder: 0,
        role: 'pre_trial',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [{ key: 'activate_trial' }, { key: 'subscribe_to_plan' }],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'placeholder-floor',
        name: 'Placeholder Floor',
        pricingOrder: 0,
        role: 'floor',
        version: {
            rank: 0,
            sellable: false,
            current: true,
            graceDays: 10,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false,
            entitlements: [{ key: 'subscribe_to_plan' }, { key: 'recover_own_listing' }],
            limits: []
        }
    },
    {
        vertical: 'experience',
        slug: 'placeholder-sellable',
        name: 'Placeholder Sellable',
        pricingOrder: 0,
        role: null,
        version: {
            rank: 900_000,
            sellable: true,
            current: true,
            graceDays: 10,
            trialDays: 14,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: [
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' },
                { key: 'publish_experience' }
            ],
            limits: [{ key: 'max_experiences', value: 123 }]
        }
    }
] as const satisfies readonly PlanCatalogDefinition[];

/** UUIDv5 using one fixed namespace and a natural catalog key. */
export function catalogId(key: string): string {
    const namespace = Buffer.from('8cd05b0f6e6352e297d631f5b58cba82', 'hex');
    const bytes = createHash('sha1').update(namespace).update(key, 'utf8').digest().subarray(0, 16);
    bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
    bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
