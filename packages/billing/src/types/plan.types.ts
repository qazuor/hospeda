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
    MAX_SEARCH_HISTORY_ENTRIES = 'max_search_history_entries',
    /**
     * Maximum number of active favorites collections per user (SPEC-287).
     * Free plan has no entitlement so this limit is never evaluated for free users.
     * Plus = 10, VIP = 25 (owner/complex inherit 25 via `TOURIST_VIP_LIMITS`).
     */
    MAX_COLLECTIONS = 'max_collections',

    /**
     * Maximum number of gastronomy listings an owner may hold (HOS-688).
     *
     * Commerce billing is per-OWNER and per-VERTICAL: a gastronomy plan caps
     * gastronomy listings and says nothing about experiences. A single pooled
     * commerce cap was considered and rejected — it cannot express "one
     * restaurant and one excursion", since both slots could be spent on
     * restaurants.
     *
     * Metered by `usage-tracking.service.ts` and enforced by
     * `enforceGastronomyLimit()` on the owner create route. Raised one listing
     * at a time by the `extra-gastronomies-1` addon.
     */
    MAX_GASTRONOMIES = 'max_gastronomies',
    /**
     * Maximum number of experience listings an owner may hold (HOS-688).
     * The experience-side twin of {@link MAX_GASTRONOMIES} — see its doc for
     * why the two caps are separate rather than pooled.
     */
    MAX_EXPERIENCES = 'max_experiences',

    /**
     * Monthly AI-chat quota borne by a GASTRONOMY listing's owner (HOS-400).
     *
     * The gastronomy twin of {@link MAX_AI_CHAT_PER_MONTH}, which stays
     * accommodation-only. The caps are separate for the same reason
     * {@link MAX_GASTRONOMIES} and {@link MAX_EXPERIENCES} are: commerce
     * billing is per-OWNER and per-VERTICAL, and SPEC-239 isolates the domains
     * on purpose. A single pooled AI-chat cap would let an owner who is at once
     * a host and a restaurateur spend their accommodation plan's chat budget on
     * gastronomy traffic (and the reverse) — exactly the cross-domain leak
     * `subscriptionMatchesDomain()` exists to prevent.
     *
     * A separate cap is only HALF the isolation. The quota is enforced by
     * counting `ai_usage` rows keyed by `(userId, feature)`, so each vertical's
     * cap is paired with its own `AiFeature` (`chat_gastronomy`). Two limit keys
     * over one shared `'chat'` counter would be two numbers reading the same
     * bucket.
     */
    MAX_AI_CHAT_GASTRONOMY_PER_MONTH = 'max_ai_chat_gastronomy_per_month',
    /**
     * Monthly AI-chat quota borne by an EXPERIENCE listing's owner (HOS-400).
     * The experience-side twin of {@link MAX_AI_CHAT_GASTRONOMY_PER_MONTH} — see
     * its doc for why each vertical carries both its own cap AND its own
     * `AiFeature` counter rather than sharing either.
     */
    MAX_AI_CHAT_EXPERIENCE_PER_MONTH = 'max_ai_chat_experience_per_month',

    /**
     * Maximum number of private galleries an experience provider may hold ALIVE
     * at once (HOS-1060).
     *
     * ## Active, not created
     *
     * A gallery lives 30 days from its creation and a cron deletes it, so this
     * counts what has not expired yet — the number of tourists who can still
     * open their link today. A lifetime counter would make the cap a quota that
     * runs out and never refills, which is not what was sold: the provider who
     * ran twenty outings last month should be able to run twenty more.
     *
     * ## Why this key exists at all, when `MENU_ITEM_PHOTOS` has none
     *
     * `MENU_ITEM_PHOTOS` deliberately ships with no numeric limit because access
     * is its whole gate. Galleries cannot do that: photo storage is the only
     * recurring per-use cost in this epic, and the cap is what bounds it. It is
     * also what the three `private-galleries-+N` add-ons sell more of.
     *
     * ## Experience-only, and declared as an explicit ZERO elsewhere
     *
     * `PRODUCT_DOMAIN_BY_LIMIT_KEY` maps it to the EXPERIENCE domain, so an
     * accommodation or gastronomy subscription never supplies its base value.
     * Even so, all six commerce tiers declare it — gastronomy at `0` — for the
     * reason `commerceVerticalTier` states about `aiChatPerMonth`: an ABSENT key
     * is resolved as UNLIMITED through five layers without raising, so "nobody
     * thought about this tier" and "deliberately uncapped" would be the same
     * row.
     */
    MAX_ACTIVE_PRIVATE_GALLERIES = 'max_active_private_galleries'
}

/**
 * Plan category indicating the target user type
 */
export type PlanCategory = 'owner' | 'complex' | 'tourist';

/**
 * Ordinal rank of each {@link PlanCategory}, ascending by "tier weight"
 * (HOS-222).
 *
 * The rank encodes the product's category hierarchy — `tourist` (consumer) is
 * the lowest tier, `owner` (single-property host) sits above it, and `complex`
 * (multi-property host) is the highest. This is the SINGLE SOURCE OF TRUTH used
 * by the plan-change classifier to decide upgrade-vs-downgrade ACROSS
 * categories, where a raw price comparison is wrong: an equal-priced
 * `tourist-vip` → `owner-basico` move is a genuine cross-tier UPGRADE even
 * though the price does not increase, so it must apply immediately rather than
 * being (mis)classified as a downgrade and rejected.
 *
 * Do NOT re-derive this ordering anywhere else — import {@link compareCategoryRank}.
 */
export const CATEGORY_RANK: Readonly<Record<PlanCategory, number>> = {
    tourist: 0,
    owner: 1,
    complex: 2
} as const;

/**
 * Compare two {@link PlanCategory} values by their {@link CATEGORY_RANK}.
 *
 * @param a - The "from" / current category.
 * @param b - The "to" / target category.
 * @returns A negative number when `a` ranks below `b` (moving up a tier),
 *   `0` when both categories are the same tier, and a positive number when `a`
 *   ranks above `b` (moving down a tier). Mirrors the `Array.prototype.sort`
 *   comparator convention.
 *
 * @example
 * ```ts
 * compareCategoryRank('tourist', 'owner'); // < 0  (rank up: tourist → owner)
 * compareCategoryRank('owner', 'owner');   // === 0 (same tier)
 * compareCategoryRank('complex', 'owner'); // > 0  (rank down: complex → owner)
 * ```
 */
export function compareCategoryRank(a: PlanCategory, b: PlanCategory): number {
    return CATEGORY_RANK[a] - CATEGORY_RANK[b];
}

/**
 * Read a plan's {@link PlanCategory} defensively off its raw
 * `billing_plans.metadata` value (HOS-222).
 *
 * The category is stored in the plan's `metadata.category` JSONB field (seeded
 * from {@link PlanDefinition.category}). The qzpay-core plan shape types
 * `metadata` as `unknown`, so this is the single source of truth for turning
 * that raw value into a trusted {@link PlanCategory} — mirroring
 * `resolvePlanTrialConfig`'s defensiveness against malformed/missing metadata.
 *
 * @param metadata - The plan's `metadata` value (typed `unknown`).
 * @returns The resolved {@link PlanCategory}, or `undefined` when the metadata
 *   is missing/malformed or the stored value is not one of the three known
 *   categories. Callers MUST treat `undefined` as "category unknown — fall back
 *   to price-based classification" so plans without the field behave exactly as
 *   they did before this helper existed.
 *
 * @example
 * ```ts
 * const category = resolvePlanCategory(plan.metadata); // 'owner' | 'complex' | 'tourist' | undefined
 * ```
 */
export function resolvePlanCategory(metadata: unknown): PlanCategory | undefined {
    const meta = (metadata ?? {}) as Record<string, unknown>;
    const raw = meta.category;
    return raw === 'owner' || raw === 'complex' || raw === 'tourist' ? raw : undefined;
}

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
