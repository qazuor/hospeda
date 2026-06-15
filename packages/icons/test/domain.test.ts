/**
 * Tests for all domain mapper modules.
 *
 * Covers the exported functions that were 0% covered (functions not called in
 * any prior test file). Each suite calls every exported getter with:
 *  - known / valid inputs (hits the map lookup)
 *  - unknown / fallback inputs (hits the ?? fallback branch)
 *  - both 'subtle' and 'contrast' color-scheme variants
 *
 * No React rendering needed — these are pure TS functions that return
 * ComponentType references or plain CSS strings.
 */

import { describe, expect, it } from 'vitest';

// ---------- accommodation-type ----------
import {
    ACCOMMODATION_TYPE_FALLBACK_VISUAL,
    ACCOMMODATION_TYPE_VISUALS,
    getAccommodationTypeColorScheme,
    getAccommodationTypeColorTokens,
    getAccommodationTypeIcon,
    getAccommodationTypeVisual
} from '../src/domain/accommodation-type';

// ---------- amenity-type ----------
import {
    AMENITY_TYPE_FALLBACK_VISUAL,
    AMENITY_TYPE_VISUALS,
    getAmenityTypeColorScheme,
    getAmenityTypeIcon,
    getAmenityTypeVisual
} from '../src/domain/amenity-type';

// ---------- attraction-icon ----------
import { getAttractionIcon } from '../src/domain/attraction-icon';

// ---------- auth-provider ----------
import {
    AUTH_PROVIDER_FALLBACK_VISUAL,
    AUTH_PROVIDER_VISUALS,
    getAuthProviderColorScheme,
    getAuthProviderIcon,
    getAuthProviderVisual
} from '../src/domain/auth-provider';

// ---------- event-category ----------
import {
    EVENT_CATEGORY_FALLBACK_VISUAL,
    EVENT_CATEGORY_VISUALS,
    getEventCategoryColorScheme,
    getEventCategoryIcon,
    getEventCategoryVisual
} from '../src/domain/event-category';

// ---------- post-category ----------
import {
    POST_CATEGORY_FALLBACK_VISUAL,
    POST_CATEGORY_VISUALS,
    getPostCategoryColorScheme,
    getPostCategoryIcon,
    getPostCategoryVisual
} from '../src/domain/post-category';

// ---------- sponsor-type ----------
import {
    SPONSOR_TYPE_FALLBACK_VISUAL,
    SPONSOR_TYPE_VISUALS,
    getSponsorTypeColorScheme,
    getSponsorTypeIcon,
    getSponsorTypeVisual
} from '../src/domain/sponsor-type';

// ---------- user-role ----------
import {
    USER_ROLE_FALLBACK_VISUAL,
    USER_ROLE_VISUALS,
    getUserRoleColorScheme,
    getUserRoleIcon,
    getUserRoleVisual
} from '../src/domain/user-role';

// ---------------------------------------------------------------------------
// Helper: assert a color scheme object has the three expected CSS keys
// ---------------------------------------------------------------------------
function expectColorScheme(scheme: { bg: string; text: string; border: string }): void {
    expect(typeof scheme.bg).toBe('string');
    expect(typeof scheme.text).toBe('string');
    expect(typeof scheme.border).toBe('string');
    expect(scheme.bg.length).toBeGreaterThan(0);
    expect(scheme.text.length).toBeGreaterThan(0);
    expect(scheme.border.length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// accommodation-type
// ---------------------------------------------------------------------------
describe('accommodation-type', () => {
    describe('getAccommodationTypeVisual', () => {
        it('should return the correct visual for a known type (apartment)', () => {
            // Arrange / Act
            const visual = getAccommodationTypeVisual({ type: 'apartment' });

            // Assert
            expect(visual).toBe(ACCOMMODATION_TYPE_VISUALS.apartment);
            expect(visual.icon).toBeDefined();
            expect(visual.colorToken).toBe('accommodation-type-apartment');
        });

        it('should match regardless of case (HOTEL → hotel)', () => {
            const visual = getAccommodationTypeVisual({ type: 'HOTEL' });
            expect(visual).toBe(ACCOMMODATION_TYPE_VISUALS.hotel);
        });

        it('should return fallback for an unknown type', () => {
            const visual = getAccommodationTypeVisual({ type: 'unknown_xyz' });
            expect(visual).toBe(ACCOMMODATION_TYPE_FALLBACK_VISUAL);
        });

        it('should cover all known type slugs', () => {
            const knownTypes = [
                'apartment',
                'house',
                'country_house',
                'cabin',
                'hotel',
                'hostel',
                'camping',
                'room',
                'motel',
                'resort',
                'apart_hotel',
                'estancia',
                'bed_and_breakfast'
            ];
            for (const type of knownTypes) {
                const visual = getAccommodationTypeVisual({ type });
                expect(visual).toBe(ACCOMMODATION_TYPE_VISUALS[type]);
            }
        });
    });

    describe('getAccommodationTypeIcon', () => {
        it('should return an icon component for a known type', () => {
            const icon = getAccommodationTypeIcon({ type: 'house' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown type', () => {
            const icon = getAccommodationTypeIcon({ type: 'nonexistent' });
            expect(icon).toBe(ACCOMMODATION_TYPE_FALLBACK_VISUAL.icon);
        });
    });

    describe('getAccommodationTypeColorTokens', () => {
        it('should return colorToken for a known type', () => {
            const tokens = getAccommodationTypeColorTokens({ type: 'cabin' });
            expect(tokens.colorToken).toBe('accommodation-type-cabin');
        });

        it('should return colorToken for fallback on unknown type', () => {
            const tokens = getAccommodationTypeColorTokens({ type: 'nope' });
            expect(tokens.colorToken).toBe(ACCOMMODATION_TYPE_FALLBACK_VISUAL.colorToken);
        });
    });

    describe('getAccommodationTypeColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            // Arrange / Act — exercises the default variant='subtle' branch
            const scheme = getAccommodationTypeColorScheme({ type: 'hotel' });

            // Assert
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 210-219)
            const scheme = getAccommodationTypeColorScheme({ type: 'hotel', variant: 'contrast' });

            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
            expect(scheme.text).toContain('oklch');
            expect(scheme.border).toContain('oklch');
        });

        it('should return subtle fallback scheme for unknown type', () => {
            const scheme = getAccommodationTypeColorScheme({ type: 'unknown_type' });
            expectColorScheme(scheme);
        });

        it('should return contrast fallback scheme for unknown type', () => {
            const scheme = getAccommodationTypeColorScheme({
                type: 'unknown_type',
                variant: 'contrast'
            });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});

// ---------------------------------------------------------------------------
// amenity-type
// ---------------------------------------------------------------------------
describe('amenity-type', () => {
    describe('getAmenityTypeVisual', () => {
        it('should return correct visual for a known type (KITCHEN)', () => {
            const visual = getAmenityTypeVisual({ type: 'KITCHEN' });
            expect(visual).toBe(AMENITY_TYPE_VISUALS.KITCHEN);
            expect(visual.colorToken).toBe('amenity-type-kitchen');
        });

        it('should be case-insensitive (kitchen → KITCHEN)', () => {
            const visual = getAmenityTypeVisual({ type: 'kitchen' });
            expect(visual).toBe(AMENITY_TYPE_VISUALS.KITCHEN);
        });

        it('should return fallback for unknown type', () => {
            const visual = getAmenityTypeVisual({ type: 'NONEXISTENT' });
            expect(visual).toBe(AMENITY_TYPE_FALLBACK_VISUAL);
        });

        it('should cover all known amenity types', () => {
            const knownTypes = [
                'CLIMATE_CONTROL',
                'CONNECTIVITY',
                'ENTERTAINMENT',
                'KITCHEN',
                'BED_AND_BATH',
                'OUTDOORS',
                'ACCESSIBILITY',
                'SERVICES',
                'SAFETY',
                'FAMILY_FRIENDLY',
                'WORK_FRIENDLY',
                'GENERAL_APPLIANCES'
            ];
            for (const type of knownTypes) {
                const visual = getAmenityTypeVisual({ type });
                expect(visual).toBe(AMENITY_TYPE_VISUALS[type]);
            }
        });
    });

    describe('getAmenityTypeIcon', () => {
        it('should return an icon component for a known type', () => {
            const icon = getAmenityTypeIcon({ type: 'SAFETY' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown type', () => {
            const icon = getAmenityTypeIcon({ type: 'UNKNOWN' });
            expect(icon).toBe(AMENITY_TYPE_FALLBACK_VISUAL.icon);
        });
    });

    describe('getAmenityTypeColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            const scheme = getAmenityTypeColorScheme({ type: 'CONNECTIVITY' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 84-89)
            const scheme = getAmenityTypeColorScheme({ type: 'CONNECTIVITY', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });

        it('should return subtle scheme for unknown type (uses fallback token)', () => {
            const scheme = getAmenityTypeColorScheme({ type: 'UNKNOWN_TYPE' });
            expectColorScheme(scheme);
        });

        it('should return contrast scheme for unknown type', () => {
            const scheme = getAmenityTypeColorScheme({ type: 'UNKNOWN_TYPE', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});

// ---------------------------------------------------------------------------
// attraction-icon
// ---------------------------------------------------------------------------
describe('attraction-icon', () => {
    describe('getAttractionIcon', () => {
        it('should return a component for a known Material Symbols slug', () => {
            const icon = getAttractionIcon({ icon: 'museum' });
            expect(typeof icon).toBe('function');
        });

        it('should be case-insensitive (MUSEUM → museum)', () => {
            const lower = getAttractionIcon({ icon: 'museum' });
            const upper = getAttractionIcon({ icon: 'MUSEUM' });
            expect(lower).toBe(upper);
        });

        it('should return MapIcon as fallback for unknown slug', () => {
            // Exercises the ?? MapIcon branch (line 187)
            const icon = getAttractionIcon({ icon: 'nonexistent_slug_xyz' });
            expect(typeof icon).toBe('function');
        });

        it('should return MapIcon when icon is undefined', () => {
            // Exercises the if (!icon) return MapIcon branch (line 186)
            const icon = getAttractionIcon({ icon: undefined });
            expect(typeof icon).toBe('function');
        });

        it('should return MapIcon when icon is null', () => {
            const icon = getAttractionIcon({ icon: null });
            expect(typeof icon).toBe('function');
        });

        it('should return MapIcon when icon is empty string', () => {
            // Empty string is falsy — hits the !icon guard
            const icon = getAttractionIcon({ icon: '' });
            expect(typeof icon).toBe('function');
        });

        it('should cover a sample of known slugs', () => {
            const knownSlugs = [
                'account_balance',
                'casino',
                'fishing',
                'hiking',
                'museum',
                'park',
                'restaurant',
                'sports_soccer',
                'beach',
                'camping',
                'coffee',
                'bird',
                'gallery',
                'users'
            ];
            for (const slug of knownSlugs) {
                const icon = getAttractionIcon({ icon: slug });
                expect(typeof icon).toBe('function');
            }
        });
    });
});

// ---------------------------------------------------------------------------
// auth-provider
// ---------------------------------------------------------------------------
describe('auth-provider', () => {
    describe('getAuthProviderVisual', () => {
        it('should return correct visual for google', () => {
            const visual = getAuthProviderVisual({ provider: 'google' });
            expect(visual).toBe(AUTH_PROVIDER_VISUALS.google);
            expect(visual.colorToken).toBe('auth-provider-google');
        });

        it('should be case-insensitive (GOOGLE → google)', () => {
            const visual = getAuthProviderVisual({ provider: 'GOOGLE' });
            expect(visual).toBe(AUTH_PROVIDER_VISUALS.google);
        });

        it('should return fallback for unknown provider', () => {
            const visual = getAuthProviderVisual({ provider: 'unknown_provider' });
            expect(visual).toBe(AUTH_PROVIDER_FALLBACK_VISUAL);
        });

        it('should cover all known providers', () => {
            for (const provider of ['local', 'google', 'facebook', 'github', 'better_auth']) {
                const visual = getAuthProviderVisual({ provider });
                expect(visual).toBe(AUTH_PROVIDER_VISUALS[provider]);
            }
        });
    });

    describe('getAuthProviderIcon', () => {
        it('should return an icon component for a known provider', () => {
            const icon = getAuthProviderIcon({ provider: 'github' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown provider', () => {
            const icon = getAuthProviderIcon({ provider: 'twitterauth' });
            expect(icon).toBe(AUTH_PROVIDER_FALLBACK_VISUAL.icon);
        });
    });

    describe('getAuthProviderColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            // Exercises the default variant='subtle' path (lines 80-85)
            const scheme = getAuthProviderColorScheme({ provider: 'google' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 71-76)
            const scheme = getAuthProviderColorScheme({ provider: 'google', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });

        it('should return subtle scheme for unknown provider (uses fallback token)', () => {
            const scheme = getAuthProviderColorScheme({ provider: 'unknown' });
            expectColorScheme(scheme);
        });

        it('should return contrast scheme for unknown provider', () => {
            const scheme = getAuthProviderColorScheme({ provider: 'unknown', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});

// ---------------------------------------------------------------------------
// event-category
// ---------------------------------------------------------------------------
describe('event-category', () => {
    describe('getEventCategoryVisual', () => {
        it('should return correct visual for a known category (music)', () => {
            const visual = getEventCategoryVisual({ category: 'music' });
            expect(visual).toBe(EVENT_CATEGORY_VISUALS.music);
            expect(visual.colorToken).toBe('event-category-music');
        });

        it('should be case-insensitive (MUSIC → music)', () => {
            const visual = getEventCategoryVisual({ category: 'MUSIC' });
            expect(visual).toBe(EVENT_CATEGORY_VISUALS.music);
        });

        it('should return fallback for unknown category', () => {
            const visual = getEventCategoryVisual({ category: 'nonexistent' });
            expect(visual).toBe(EVENT_CATEGORY_FALLBACK_VISUAL);
        });

        it('should cover all known event categories', () => {
            for (const category of [
                'culture',
                'sports',
                'festival',
                'workshop',
                'music',
                'gastronomy',
                'nature',
                'other'
            ]) {
                const visual = getEventCategoryVisual({ category });
                expect(visual).toBe(EVENT_CATEGORY_VISUALS[category]);
            }
        });
    });

    describe('getEventCategoryIcon', () => {
        it('should return an icon component for a known category', () => {
            const icon = getEventCategoryIcon({ category: 'festival' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown category', () => {
            const icon = getEventCategoryIcon({ category: 'unknown_cat' });
            expect(icon).toBe(EVENT_CATEGORY_FALLBACK_VISUAL.icon);
        });
    });

    describe('getEventCategoryColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            // Exercises default subtle path (lines 146-150)
            const scheme = getEventCategoryColorScheme({ category: 'music' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 136-140)
            const scheme = getEventCategoryColorScheme({ category: 'music', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });

        it('should return subtle scheme for unknown category', () => {
            const scheme = getEventCategoryColorScheme({ category: 'nope' });
            expectColorScheme(scheme);
        });

        it('should return contrast scheme for unknown category', () => {
            const scheme = getEventCategoryColorScheme({ category: 'nope', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});

// ---------------------------------------------------------------------------
// post-category
// ---------------------------------------------------------------------------
describe('post-category', () => {
    describe('getPostCategoryVisual', () => {
        it('should return correct visual for a known category (culture)', () => {
            const visual = getPostCategoryVisual({ category: 'culture' });
            expect(visual).toBe(POST_CATEGORY_VISUALS.culture);
            expect(visual.colorToken).toBe('post-category-culture');
        });

        it('should be case-insensitive (CULTURE → culture)', () => {
            const visual = getPostCategoryVisual({ category: 'CULTURE' });
            expect(visual).toBe(POST_CATEGORY_VISUALS.culture);
        });

        it('should return fallback for unknown category', () => {
            const visual = getPostCategoryVisual({ category: 'nonexistent_post' });
            expect(visual).toBe(POST_CATEGORY_FALLBACK_VISUAL);
        });

        it('should cover all known post categories', () => {
            const knownCategories = [
                'events',
                'culture',
                'gastronomy',
                'nature',
                'tourism',
                'general',
                'sport',
                'carnival',
                'nightlife',
                'history',
                'traditions',
                'wellness',
                'family',
                'tips',
                'art',
                'beach',
                'rural',
                'festivals'
            ];
            for (const category of knownCategories) {
                const visual = getPostCategoryVisual({ category });
                expect(visual).toBe(POST_CATEGORY_VISUALS[category]);
            }
        });
    });

    describe('getPostCategoryIcon', () => {
        it('should return an icon component for a known category', () => {
            const icon = getPostCategoryIcon({ category: 'gastronomy' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown category', () => {
            const icon = getPostCategoryIcon({ category: 'unknown_cat_xyz' });
            expect(icon).toBe(POST_CATEGORY_FALLBACK_VISUAL.icon);
        });
    });

    describe('getPostCategoryColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            // Exercises default subtle path (lines 148-153)
            const scheme = getPostCategoryColorScheme({ category: 'culture' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 139-143)
            const scheme = getPostCategoryColorScheme({ category: 'culture', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });

        it('should return subtle scheme for unknown category', () => {
            const scheme = getPostCategoryColorScheme({ category: 'nope' });
            expectColorScheme(scheme);
        });

        it('should return contrast scheme for unknown category', () => {
            const scheme = getPostCategoryColorScheme({ category: 'nope', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});

// ---------------------------------------------------------------------------
// sponsor-type
// ---------------------------------------------------------------------------
describe('sponsor-type', () => {
    describe('getSponsorTypeVisual', () => {
        it('should return correct visual for POST_SPONSOR', () => {
            const visual = getSponsorTypeVisual({ type: 'POST_SPONSOR' });
            expect(visual).toBe(SPONSOR_TYPE_VISUALS.POST_SPONSOR);
            expect(visual.colorToken).toBe('sponsor-type-post-sponsor');
        });

        it('should be case-insensitive (post_sponsor → POST_SPONSOR)', () => {
            const visual = getSponsorTypeVisual({ type: 'post_sponsor' });
            expect(visual).toBe(SPONSOR_TYPE_VISUALS.POST_SPONSOR);
        });

        it('should return fallback for unknown type', () => {
            const visual = getSponsorTypeVisual({ type: 'UNKNOWN_SPONSOR' });
            expect(visual).toBe(SPONSOR_TYPE_FALLBACK_VISUAL);
        });

        it('should cover all known sponsor types', () => {
            for (const type of ['POST_SPONSOR', 'ADVERTISER', 'HOST']) {
                const visual = getSponsorTypeVisual({ type });
                expect(visual).toBe(SPONSOR_TYPE_VISUALS[type]);
            }
        });
    });

    describe('getSponsorTypeIcon', () => {
        it('should return an icon component for a known type', () => {
            const icon = getSponsorTypeIcon({ type: 'ADVERTISER' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown type', () => {
            const icon = getSponsorTypeIcon({ type: 'NOPE' });
            expect(icon).toBe(SPONSOR_TYPE_FALLBACK_VISUAL.icon);
        });
    });

    describe('getSponsorTypeColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            // Exercises default subtle path (lines 76-80)
            const scheme = getSponsorTypeColorScheme({ type: 'HOST' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 67-71)
            const scheme = getSponsorTypeColorScheme({ type: 'HOST', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });

        it('should return subtle scheme for unknown type', () => {
            const scheme = getSponsorTypeColorScheme({ type: 'unknown_sponsor' });
            expectColorScheme(scheme);
        });

        it('should return contrast scheme for unknown type', () => {
            const scheme = getSponsorTypeColorScheme({
                type: 'unknown_sponsor',
                variant: 'contrast'
            });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});

// ---------------------------------------------------------------------------
// user-role
// ---------------------------------------------------------------------------
describe('user-role', () => {
    describe('getUserRoleVisual', () => {
        it('should return correct visual for admin role', () => {
            const visual = getUserRoleVisual({ role: 'admin' });
            expect(visual).toBe(USER_ROLE_VISUALS.admin);
            expect(visual.colorToken).toBe('user-role-admin');
        });

        it('should be case-insensitive (ADMIN → admin)', () => {
            const visual = getUserRoleVisual({ role: 'ADMIN' });
            expect(visual).toBe(USER_ROLE_VISUALS.admin);
        });

        it('should return fallback for unknown role', () => {
            const visual = getUserRoleVisual({ role: 'not_a_real_role' });
            expect(visual).toBe(USER_ROLE_FALLBACK_VISUAL);
        });

        it('should cover all known user roles', () => {
            const knownRoles = [
                'super_admin',
                'admin',
                'editor',
                'host',
                'user',
                'guest',
                'system'
            ];
            for (const role of knownRoles) {
                const visual = getUserRoleVisual({ role });
                expect(visual).toBe(USER_ROLE_VISUALS[role]);
            }
        });
    });

    describe('getUserRoleIcon', () => {
        it('should return an icon component for a known role', () => {
            const icon = getUserRoleIcon({ role: 'super_admin' });
            expect(typeof icon).toBe('function');
        });

        it('should return fallback icon for unknown role', () => {
            const icon = getUserRoleIcon({ role: 'unknown_role' });
            expect(icon).toBe(USER_ROLE_FALLBACK_VISUAL.icon);
        });
    });

    describe('getUserRoleColorScheme', () => {
        it('should return subtle color scheme by default', () => {
            // Exercises default subtle path (lines 83-87)
            const scheme = getUserRoleColorScheme({ role: 'admin' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('a15');
        });

        it('should return contrast color scheme when variant is "contrast"', () => {
            // Exercises the if (variant === 'contrast') branch (lines 74-78)
            const scheme = getUserRoleColorScheme({ role: 'admin', variant: 'contrast' });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });

        it('should return subtle scheme for unknown role', () => {
            const scheme = getUserRoleColorScheme({ role: 'unknown_role_xyz' });
            expectColorScheme(scheme);
        });

        it('should return contrast scheme for unknown role', () => {
            const scheme = getUserRoleColorScheme({
                role: 'unknown_role_xyz',
                variant: 'contrast'
            });
            expectColorScheme(scheme);
            expect(scheme.bg).toContain('oklch');
        });
    });
});
