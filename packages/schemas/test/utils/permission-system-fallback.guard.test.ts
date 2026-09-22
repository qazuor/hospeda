/**
 * Guard: no NEW permission may land in the `SYSTEM` catch-all unnoticed
 * (HOS-1124).
 *
 * `deriveCategory` assigns a permission its category by longest-prefix match on
 * the permission's KEY and falls back to `SYSTEM` when nothing matches. The
 * fallback is silent: a permission whose family has no category of its own
 * produces no error, no warning and no red test — it just quietly joins a
 * category it has nothing to do with, and in the admin's categorized picker it
 * becomes near-impossible to find.
 *
 * Making the fallback throw was considered and rejected on evidence: 101 of the
 * 712 permissions rely on it TODAY, and they are not mistakes. Whole live
 * families sit there — `AMENITY_*`, `FEATURE_*`, `TAG_*`, `AD_SLOT_*`,
 * `AD_MEDIA_ASSET_*`, `PRICING_PLAN_*`, `PRICING_TIER_*` — and giving each one a
 * category is a taxonomy decision about how the permissions screen should read,
 * not a bug fix. Breaking the build would mean breaking it for all 101 at once.
 *
 * So the fallback stays, and this list makes it loud instead: the 101 that
 * already depend on it are named, and the 102nd fails CI. The failure message
 * says what to do — declare a category, or add the key here on purpose.
 *
 * Retiring an entry is expected and good: it means that family got a category.
 */
import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/index.js';
import { PERMISSION_TO_CATEGORY } from '../../src/utils/permission-grouping.js';

/**
 * Permission KEYS that resolve to `SYSTEM` only because no category prefixes
 * them. Sorted; keys whose family genuinely IS `SYSTEM_*` are excluded, since
 * those match a real prefix and are not using the fallback at all.
 */
const KNOWN_SYSTEM_FALLBACK_KEYS: readonly string[] = [
    'AD_MEDIA_ASSET_CREATE',
    'AD_MEDIA_ASSET_DELETE',
    'AD_MEDIA_ASSET_HARD_DELETE',
    'AD_MEDIA_ASSET_PERFORMANCE_VIEW',
    'AD_MEDIA_ASSET_RESTORE',
    'AD_MEDIA_ASSET_SOFT_DELETE_VIEW',
    'AD_MEDIA_ASSET_STATUS_MANAGE',
    'AD_MEDIA_ASSET_UPDATE',
    'AD_MEDIA_ASSET_VIEW',
    'AD_SLOT_AVAILABILITY_MANAGE',
    'AD_SLOT_CREATE',
    'AD_SLOT_DELETE',
    'AD_SLOT_HARD_DELETE',
    'AD_SLOT_PERFORMANCE_VIEW',
    'AD_SLOT_PRICING_MANAGE',
    'AD_SLOT_RESERVATION_CREATE',
    'AD_SLOT_RESERVATION_DELETE',
    'AD_SLOT_RESERVATION_HARD_DELETE',
    'AD_SLOT_RESERVATION_RESTORE',
    'AD_SLOT_RESERVATION_SOFT_DELETE_VIEW',
    'AD_SLOT_RESERVATION_STATUS_MANAGE',
    'AD_SLOT_RESERVATION_UPDATE',
    'AD_SLOT_RESERVATION_VIEW',
    'AD_SLOT_RESTORE',
    'AD_SLOT_SOFT_DELETE_VIEW',
    'AD_SLOT_STATUS_MANAGE',
    'AD_SLOT_UPDATE',
    'AD_SLOT_VIEW',
    'AI_SETTINGS_MANAGE',
    'AMENITY_CREATE',
    'AMENITY_DELETE',
    'AMENITY_FEATURED_TOGGLE',
    'AMENITY_LIFECYCLE_CHANGE',
    'AMENITY_UPDATE',
    'AMENITY_VIEW',
    'ANALYTICS_VIEW',
    'AUDIT_LOG_VIEW',
    'DASHBOARD_BASE_VIEW',
    'DASHBOARD_FULL_VIEW',
    'DEBUG_TOOLS_ACCESS',
    'ENTITIES_BULK_EXPORT',
    'ENTITIES_BULK_IMPORT',
    'ERRORS_VIEW',
    'FEATURE_CREATE',
    'FEATURE_DELETE',
    'FEATURE_FEATURED_TOGGLE',
    'FEATURE_FLAG_MANAGE',
    'FEATURE_LIFECYCLE_CHANGE',
    'FEATURE_UPDATE',
    'FEATURE_VIEW',
    'HOMEPAGE_LAYOUT_CONFIGURE',
    'HOST_CONTACT_VIEW',
    'HOST_MESSAGE_SEND',
    'LOGS_VIEW_ALL',
    'MAINTENANCE_MODE_WRITE',
    'MANAGE_CLIENTS',
    'MANAGE_CONTENT',
    'MANAGE_PRODUCTS',
    'MANAGE_PURCHASES',
    'MANAGE_SUBSCRIPTIONS',
    'MANAGE_USERS',
    'MULTILANGUAGE_CONTENT_EDIT',
    'PRICING_PLAN_CREATE',
    'PRICING_PLAN_DELETE',
    'PRICING_PLAN_UPDATE',
    'PRICING_PLAN_VIEW',
    'PRICING_TIER_CREATE',
    'PRICING_TIER_DELETE',
    'PRICING_TIER_UPDATE',
    'PRICING_TIER_VIEW',
    'SECURITY_LOG_VIEW',
    'SEO_MANAGE',
    'SETTINGS_GENERAL_VIEW',
    'SETTINGS_GENERAL_WRITE',
    'SETTINGS_MANAGE',
    'SOCIAL_ASSET_MANAGE',
    'SOCIAL_ASSET_VIEW',
    'SOCIAL_DISPATCH_MANAGE',
    'SOCIAL_PUBLISH_LOG_VIEW',
    'STATS_VIEW',
    'TAG_ASSIGN_ADD',
    'TAG_ASSIGN_REMOVE',
    'TAG_ASSIGN_VIEW',
    'TAG_INTERNAL_ASSIGN',
    'TAG_INTERNAL_CREATE',
    'TAG_INTERNAL_DELETE',
    'TAG_INTERNAL_UPDATE',
    'TAG_INTERNAL_VIEW',
    'TAG_SYSTEM_CREATE',
    'TAG_SYSTEM_DELETE',
    'TAG_SYSTEM_UPDATE',
    'TAG_SYSTEM_VIEW',
    'TAG_USER_CREATE',
    'TAG_USER_DELETE_ANY',
    'TAG_USER_DELETE_OWN',
    'TAG_USER_UPDATE_OWN',
    'TAG_USER_VIEW_OWN',
    'TAG_VIEW_ALL_ASSIGNMENTS',
    'TAG_VIEW_ALL_USER_TAGS',
    'THEME_EDIT',
    'TRANSLATIONS_MANAGE'
];

const KEY_BY_VALUE = new Map(Object.entries(PermissionEnum).map(([key, value]) => [value, key]));

/** Keys that reach `SYSTEM` through the fallback rather than a real prefix. */
const currentFallbackKeys = (): string[] =>
    Object.values(PermissionEnum)
        .filter(
            (permission) => PERMISSION_TO_CATEGORY[permission] === PermissionCategoryEnum.SYSTEM
        )
        .map((permission) => KEY_BY_VALUE.get(permission) as string)
        .filter((key) => key !== 'SYSTEM' && !key.startsWith('SYSTEM_'))
        .sort();

describe('the silent SYSTEM fallback is frozen to its known users (HOS-1124)', () => {
    it('adds no permission to the catch-all without saying so', () => {
        const known = new Set(KNOWN_SYSTEM_FALLBACK_KEYS);
        const added = currentFallbackKeys().filter((key) => !known.has(key));

        expect(
            added,
            `These permissions fall back to the SYSTEM category because no PermissionCategoryEnum value prefixes their key: ${added.join(', ')}. That fallback is silent — in the admin's categorized picker they are filed under "System" alongside settings and logs, which is where a permission goes to be never found. Either add a category to PermissionCategoryEnum for the family (and map it in apps/admin/src/lib/permission-category-groups.ts), or add the key to KNOWN_SYSTEM_FALLBACK_KEYS to say the placement is deliberate.`
        ).toEqual([]);
    });

    it('lists no key that has since been given a category', () => {
        const current = new Set(currentFallbackKeys());
        const stale = KNOWN_SYSTEM_FALLBACK_KEYS.filter((key) => !current.has(key));

        expect(
            stale,
            `These keys no longer use the SYSTEM fallback — they were renamed, removed, or given a category of their own: ${stale.join(', ')}. Drop them from KNOWN_SYSTEM_FALLBACK_KEYS so the list keeps meaning what it says.`
        ).toEqual([]);
    });

    it('keeps the list sorted and free of duplicates so its diffs stay readable', () => {
        const sorted = [...KNOWN_SYSTEM_FALLBACK_KEYS].sort();
        expect(KNOWN_SYSTEM_FALLBACK_KEYS).toEqual(sorted);
        expect(new Set(KNOWN_SYSTEM_FALLBACK_KEYS).size).toBe(KNOWN_SYSTEM_FALLBACK_KEYS.length);
    });

    it('names only keys that still exist in PermissionEnum', () => {
        const allKeys = new Set(Object.keys(PermissionEnum));
        const unknown = KNOWN_SYSTEM_FALLBACK_KEYS.filter((key) => !allKeys.has(key));

        expect(unknown, `unknown permission keys in the list: ${unknown.join(', ')}`).toEqual([]);
    });
});
