/**
 * Domain grouping for the permission catalog screen (HOS-1124).
 *
 * `/access/permissions` shows every {@link PermissionCategoryEnum} arranged into
 * a handful of domain groups. It used to do that with a chain of `if/else if`
 * branches that listed the categories of each group by hand and had NO final
 * `else`: a category no branch claimed was not put in an "other" bucket, it was
 * dropped. Thirty-four of the enum's eighty-one categories — `HOST_TRADE`,
 * `PARTNER`, `MEDIA`, `MODERATION`, `COMMERCE`, every `SOCIAL_*`, and more —
 * fell through that hole.
 *
 * What that costs, stated precisely: this page is a READ-ONLY catalogue. It
 * lists categories, performs no mutation, and its own info note points at Roles
 * for assignments. Granting and revoking happens in `PermissionPicker`, which
 * groups through `getPermissionsByCategory()` from `@repo/schemas` and never
 * lost anything. So what broke was the REFERENCE — the screen an operator
 * consults to learn what the platform can even express — which showed 47 of 81
 * families while looking complete. That is worth fixing on its own; it is not
 * "those permissions could not be assigned".
 *
 * Two things keep that from happening again, and the first is the one that
 * matters:
 *
 *  1. {@link CATEGORY_GROUP} is a total `Record<PermissionCategoryEnum, …>`.
 *     TypeScript refuses to compile a missing key, so adding a category to the
 *     enum without placing it here is a typecheck error pointing straight at
 *     this file — the failure arrives at the moment the category is created,
 *     not months later when somebody notices the screen is short.
 *  2. {@link groupPermissionCategories} still has a final `else`
 *     ({@link UNGROUPED_CATEGORY_GROUP}) for anything that reaches it at
 *     runtime without a mapping — a value widened to `string`, a category from
 *     a newer build. Rendering it in an "Other" card is ugly; dropping it is
 *     invisible, which is worse.
 *
 * Group membership is a product taxonomy question that the enum does not encode
 * (nothing in `ACCOMMODATION` says "Content Management"), so the mapping is
 * declared here rather than derived. What is derived — and enforced — is its
 * COMPLETENESS.
 */
import type { TranslationKey } from '@repo/i18n';
import { PermissionCategoryEnum } from '@repo/schemas';

/**
 * The domain groups, in display order.
 *
 * Order is deliberate and is the order the page renders in: the groups an
 * operator reaches for most often come first, and the catch-all comes last.
 */
export const PERMISSION_CATEGORY_GROUPS = [
    'Content Management',
    'User & Access',
    'Commerce & Billing',
    'Marketing & Advertising',
    'Services & Listings',
    'System & Configuration',
    'Other'
] as const;

/** A domain group key. Not displayed directly — translated at render time. */
export type PermissionCategoryGroup = (typeof PERMISSION_CATEGORY_GROUPS)[number];

/**
 * The group that collects categories with no declared mapping.
 *
 * Unreachable while {@link CATEGORY_GROUP} typechecks, which is the point: it
 * exists so that a category arriving through a hole the type system cannot see
 * is rendered visibly instead of being discarded.
 */
export const UNGROUPED_CATEGORY_GROUP: PermissionCategoryGroup = 'Other';

/**
 * Heading translation key per group. Total by type, so a group added to
 * {@link PERMISSION_CATEGORY_GROUPS} cannot ship without a heading.
 */
export const GROUP_TRANSLATION_KEYS: Record<PermissionCategoryGroup, TranslationKey> = {
    'Content Management': 'admin-pages.access.permissions.groupContentManagement',
    'User & Access': 'admin-pages.access.permissions.groupUserAccess',
    'Commerce & Billing': 'admin-pages.access.permissions.groupCommerceBilling',
    'Marketing & Advertising': 'admin-pages.access.permissions.groupMarketingAdvertising',
    'Services & Listings': 'admin-pages.access.permissions.groupServicesListings',
    'System & Configuration': 'admin-pages.access.permissions.groupSystemConfiguration',
    Other: 'admin-pages.access.permissions.groupOther'
};

/**
 * Label translation key for a permission category.
 *
 * @param category - A category value, including one with no declared mapping.
 * @returns The `admin-pages` key holding its display label.
 */
export const categoryTranslationKey = (category: string): TranslationKey =>
    `admin-pages.access.permissions.categories.${category}` as TranslationKey;

/**
 * Every permission category, mapped to the domain group it renders under.
 *
 * Total by construction: adding a member to `PermissionCategoryEnum` without
 * adding it here fails `pnpm typecheck`.
 */
export const CATEGORY_GROUP: Record<PermissionCategoryEnum, PermissionCategoryGroup> = {
    // ---- Content Management ------------------------------------------------
    [PermissionCategoryEnum.ACCOMMODATION]: 'Content Management',
    [PermissionCategoryEnum.ACCOMMODATION_REVIEW]: 'Content Management',
    [PermissionCategoryEnum.DESTINATION]: 'Content Management',
    [PermissionCategoryEnum.DESTINATION_REVIEW]: 'Content Management',
    [PermissionCategoryEnum.EVENT]: 'Content Management',
    [PermissionCategoryEnum.EVENT_COMMENT]: 'Content Management',
    [PermissionCategoryEnum.POST]: 'Content Management',
    [PermissionCategoryEnum.POST_COMMENT]: 'Content Management',
    [PermissionCategoryEnum.ATTRACTION]: 'Content Management',
    [PermissionCategoryEnum.POINT_OF_INTEREST]: 'Content Management',
    [PermissionCategoryEnum.POI_CATEGORY]: 'Content Management',
    [PermissionCategoryEnum.MEDIA]: 'Content Management',
    [PermissionCategoryEnum.MODERATION]: 'Content Management',
    [PermissionCategoryEnum.RECOMMENDATION]: 'Content Management',

    // ---- User & Access -----------------------------------------------------
    [PermissionCategoryEnum.USER]: 'User & Access',
    // Private messaging between users, not editorial content: the family holds
    // `conversation.view.any`, `.delete.any` and `.block.any` — reading,
    // deleting and blocking any user's messages. Filing that beside Posts and
    // Events would read as a content chore.
    [PermissionCategoryEnum.CONVERSATION]: 'User & Access',
    [PermissionCategoryEnum.USER_BOOKMARK]: 'User & Access',
    [PermissionCategoryEnum.USER_BOOKMARK_COLLECTION]: 'User & Access',
    [PermissionCategoryEnum.PERMISSION]: 'User & Access',
    [PermissionCategoryEnum.CLIENT_ACCESS_RIGHT]: 'User & Access',

    // ---- Commerce & Billing ------------------------------------------------
    [PermissionCategoryEnum.INVOICE]: 'Commerce & Billing',
    [PermissionCategoryEnum.INVOICE_LINE]: 'Commerce & Billing',
    [PermissionCategoryEnum.PAYMENT]: 'Commerce & Billing',
    [PermissionCategoryEnum.PAYMENT_METHOD]: 'Commerce & Billing',
    [PermissionCategoryEnum.PURCHASE]: 'Commerce & Billing',
    [PermissionCategoryEnum.REFUND]: 'Commerce & Billing',
    [PermissionCategoryEnum.CREDIT_NOTE]: 'Commerce & Billing',
    [PermissionCategoryEnum.SUBSCRIPTION]: 'Commerce & Billing',
    [PermissionCategoryEnum.SUBSCRIPTION_ITEM]: 'Commerce & Billing',
    [PermissionCategoryEnum.PRODUCT]: 'Commerce & Billing',
    [PermissionCategoryEnum.CLIENT]: 'Commerce & Billing',
    [PermissionCategoryEnum.BILLING]: 'Commerce & Billing',
    [PermissionCategoryEnum.EXCHANGE_RATE]: 'Commerce & Billing',

    // ---- Marketing & Advertising -------------------------------------------
    [PermissionCategoryEnum.CAMPAIGN]: 'Marketing & Advertising',
    [PermissionCategoryEnum.PROMOTION]: 'Marketing & Advertising',
    [PermissionCategoryEnum.OWNER_PROMOTION]: 'Marketing & Advertising',
    [PermissionCategoryEnum.DISCOUNT_CODE]: 'Marketing & Advertising',
    [PermissionCategoryEnum.DISCOUNT_CODE_USAGE]: 'Marketing & Advertising',
    [PermissionCategoryEnum.AD_PRICING_CATALOG]: 'Marketing & Advertising',
    [PermissionCategoryEnum.POST_SPONSOR]: 'Marketing & Advertising',
    [PermissionCategoryEnum.POST_SPONSORSHIP]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SPONSORSHIP]: 'Marketing & Advertising',
    [PermissionCategoryEnum.FEATURED_ACCOMMODATION]: 'Marketing & Advertising',
    [PermissionCategoryEnum.NEWSLETTER_CAMPAIGN]: 'Marketing & Advertising',
    [PermissionCategoryEnum.NEWSLETTER_SUBSCRIBER]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_POST]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_HASHTAG]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_CAMPAIGN]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_BATCH]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_AUDIENCE]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_PLATFORM]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_FOOTER]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_SETTINGS]: 'Marketing & Advertising',
    [PermissionCategoryEnum.SOCIAL_AUDIT]: 'Marketing & Advertising',

    // ---- Services & Listings -----------------------------------------------
    [PermissionCategoryEnum.ACCOMMODATION_LISTING]: 'Services & Listings',
    [PermissionCategoryEnum.ACCOMMODATION_LISTING_PLAN]: 'Services & Listings',
    [PermissionCategoryEnum.SERVICE_LISTING]: 'Services & Listings',
    [PermissionCategoryEnum.SERVICE_LISTING_PLAN]: 'Services & Listings',
    [PermissionCategoryEnum.SERVICE_ORDER]: 'Services & Listings',
    [PermissionCategoryEnum.BENEFIT_LISTING]: 'Services & Listings',
    [PermissionCategoryEnum.BENEFIT_LISTING_PLAN]: 'Services & Listings',
    [PermissionCategoryEnum.BENEFIT_PARTNER]: 'Services & Listings',
    [PermissionCategoryEnum.TOURIST_SERVICE]: 'Services & Listings',
    [PermissionCategoryEnum.PROFESSIONAL_SERVICE]: 'Services & Listings',
    [PermissionCategoryEnum.PROFESSIONAL_SERVICE_ORDER]: 'Services & Listings',
    [PermissionCategoryEnum.COMMERCE]: 'Services & Listings',
    [PermissionCategoryEnum.GASTRONOMY]: 'Services & Listings',
    [PermissionCategoryEnum.EXPERIENCE]: 'Services & Listings',
    [PermissionCategoryEnum.HOST_TRADE]: 'Services & Listings',
    [PermissionCategoryEnum.PARTNER]: 'Services & Listings',
    [PermissionCategoryEnum.ALLIANCE_LEAD]: 'Services & Listings',

    // ---- System & Configuration --------------------------------------------
    [PermissionCategoryEnum.NOTIFICATION]: 'System & Configuration',
    [PermissionCategoryEnum.EVENT_LOCATION]: 'System & Configuration',
    [PermissionCategoryEnum.EVENT_ORGANIZER]: 'System & Configuration',
    [PermissionCategoryEnum.PUBLIC]: 'System & Configuration',
    [PermissionCategoryEnum.SYSTEM]: 'System & Configuration',
    [PermissionCategoryEnum.ACCESS]: 'System & Configuration',
    [PermissionCategoryEnum.QR_CODE]: 'System & Configuration',
    [PermissionCategoryEnum.METRICS]: 'System & Configuration',
    [PermissionCategoryEnum.REVALIDATION]: 'System & Configuration',
    [PermissionCategoryEnum.INTEGRATION]: 'System & Configuration'
};

/**
 * Arranges permission categories into their display groups.
 *
 * Every input category comes out in exactly one group: one with no declared
 * mapping lands in {@link UNGROUPED_CATEGORY_GROUP} rather than being dropped.
 * Groups that end up empty are omitted, and the remaining ones keep the order
 * of {@link PERMISSION_CATEGORY_GROUPS}.
 *
 * @param categories - Category values to arrange, normally every enum member.
 * @returns Non-empty groups in display order, each holding its categories in
 *   the order they were supplied.
 */
export const groupPermissionCategories = (
    categories: readonly string[]
): ReadonlyArray<readonly [PermissionCategoryGroup, readonly string[]]> => {
    const groups = new Map<PermissionCategoryGroup, string[]>(
        PERMISSION_CATEGORY_GROUPS.map((group) => [group, []])
    );

    for (const category of categories) {
        // The lookup is by VALUE, and the enum's values are its keys, so this
        // is a plain string index rather than a cast that would let an
        // unmapped value through as though it had been placed.
        const group =
            CATEGORY_GROUP[category as PermissionCategoryEnum] ?? UNGROUPED_CATEGORY_GROUP;
        groups.get(group)?.push(category);
    }

    return [...groups.entries()].filter(([, items]) => items.length > 0);
};
