import type { EntitlementKey } from './entitlement.types.js';

/**
 * Limit key identifiers used across the billing system.
 * These keys map to numeric limits that vary by plan.
 */
export enum LimitKey {
    MAX_ACCOMMODATIONS = 'max_accommodations',
    MAX_PHOTOS_PER_ACCOMMODATION = 'max_photos_per_accommodation',
    MAX_ACTIVE_PROMOTIONS = 'max_active_promotions',
    MAX_FAVORITES = 'max_favorites',
    MAX_PROPERTIES = 'max_properties',
    MAX_STAFF_ACCOUNTS = 'max_staff_accounts',
    /** Maximum number of active price-alert subscriptions (tourist plans) */
    MAX_ACTIVE_ALERTS = 'max_active_alerts',
    /** Maximum number of accommodations that can be compared simultaneously (tourist plans) */
    MAX_COMPARE_ITEMS = 'max_compare_items',

    /** AI usage limits per calendar month (SPEC-173) */
    /** Maximum number of AI text improvement requests per month (-1 = unlimited) */
    MAX_AI_TEXT_IMPROVE_PER_MONTH = 'max_ai_text_improve_per_month',
    /** Maximum number of AI chat interactions per month, metered against the listing OWNER who pays for the capability (-1 = unlimited) */
    MAX_AI_CHAT_PER_MONTH = 'max_ai_chat_per_month',
    /**
     * Maximum number of AI chat interactions per month metered against the
     * REQUESTING (consuming) user — the consumer-side quota added by SPEC-283.
     * Distinct from {@link MAX_AI_CHAT_PER_MONTH}, which caps the listing
     * owner's cost: a chat call passes only if BOTH the owner-side and this
     * consumer-side quota have headroom (-1 = unlimited).
     */
    MAX_AI_CHAT_CONSUMER_PER_MONTH = 'max_ai_chat_consumer_per_month',
    /** Maximum number of AI-powered search queries per month (-1 = unlimited) */
    MAX_AI_SEARCH_PER_MONTH = 'max_ai_search_per_month',
    /** Maximum number of AI support interactions per month (-1 = unlimited) */
    MAX_AI_SUPPORT_PER_MONTH = 'max_ai_support_per_month',
    /** Maximum number of AI content translation requests per month (-1 = unlimited) */
    MAX_AI_TRANSLATE_PER_MONTH = 'max_ai_translate_per_month',
    /** Maximum number of AI accommodation import requests per month (-1 = unlimited) */
    MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH = 'max_ai_accommodation_import_per_month',

    /**
     * Maximum number of search history entries persisted for the user (SPEC-289).
     * Free plan has no entitlement so this limit is never evaluated for free users.
     * Plus = 50, VIP = 200 (owner/complex inherit 200 via `TOURIST_VIP_LIMITS`).
     */
    MAX_SEARCH_HISTORY_ENTRIES = 'max_search_history_entries'
}

/**
 * Plan category indicating the target user type
 */
export type PlanCategory = 'owner' | 'complex' | 'tourist';

/**
 * Limit definition with a numeric value
 */
export interface LimitDefinition {
    /** The limit key */
    key: LimitKey;
    /** Numeric value for this limit (-1 means unlimited) */
    value: number;
    /** Human-readable name */
    name: string;
    /** Description of the limit */
    description: string;
}

/**
 * Complete plan definition including metadata, pricing, entitlements, and limits
 */
export interface PlanDefinition {
    /** Unique plan identifier (slug) */
    slug: string;
    /** Display name */
    name: string;
    /** Plan description */
    description: string;
    /** Target user category */
    category: PlanCategory;
    /** Monthly price in ARS cents (0 for free plans) */
    monthlyPriceArs: number;
    /** Annual price in ARS cents (0 for free, null if no annual option) */
    annualPriceArs: number | null;
    /** USD reference price for display purposes */
    monthlyPriceUsdRef: number;
    /** Whether this plan has a trial period */
    hasTrial: boolean;
    /** Trial duration in days (0 if no trial) */
    trialDays: number;
    /** Whether this is the default plan for its category */
    isDefault: boolean;
    /** Sort order for display */
    sortOrder: number;
    /** Entitlement keys included in this plan */
    entitlements: EntitlementKey[];
    /** Limits for this plan */
    limits: LimitDefinition[];
    /** Whether the plan is currently available for purchase */
    isActive: boolean;
}
