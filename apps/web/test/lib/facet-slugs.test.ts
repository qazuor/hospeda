/**
 * @file facet-slugs.test.ts
 * @description Unit tests for the canonical Spanish facet-landing slug maps
 * (H-110). Asserts every enum value against the OWNER-APPROVED slug list
 * (hardcoded here, not re-derived from the module under test — a
 * self-referential assertion would stay green even if the module's map
 * silently drifted from the approved list), the reverse resolution, an
 * unknown-slug miss, and a static guard that fails the suite if an enum grows
 * without its corresponding slug map growing to match.
 */

import { AccommodationTypeEnum, EventCategoryEnum, PostCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS,
    ACCOMMODATION_TYPE_SLUG_BY_ENUM,
    EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS,
    EVENT_CATEGORY_SLUG_BY_ENUM,
    POST_CATEGORY_LEGACY_ENGLISH_SLUGS,
    POST_CATEGORY_SLUG_BY_ENUM,
    resolveAccommodationTypeSlug,
    resolveEventCategorySlug,
    resolvePostCategorySlug,
    slugForAccommodationType,
    slugForEventCategory,
    slugForPostCategory
} from '../../src/lib/facet-slugs';

/** Owner-approved slug list, verbatim from the H-110 task spec. */
const APPROVED_ACCOMMODATION_TYPE_SLUGS: Readonly<Record<AccommodationTypeEnum, string>> = {
    [AccommodationTypeEnum.APARTMENT]: 'departamento',
    [AccommodationTypeEnum.HOUSE]: 'casa',
    [AccommodationTypeEnum.COUNTRY_HOUSE]: 'casa-de-campo',
    [AccommodationTypeEnum.CABIN]: 'cabana',
    [AccommodationTypeEnum.HOTEL]: 'hotel',
    [AccommodationTypeEnum.HOSTEL]: 'hostel',
    [AccommodationTypeEnum.CAMPING]: 'camping',
    [AccommodationTypeEnum.ROOM]: 'habitacion',
    [AccommodationTypeEnum.MOTEL]: 'motel',
    [AccommodationTypeEnum.RESORT]: 'complejo-turistico',
    [AccommodationTypeEnum.APART_HOTEL]: 'apart-hotel',
    [AccommodationTypeEnum.ESTANCIA]: 'estancia',
    [AccommodationTypeEnum.BED_AND_BREAKFAST]: 'bed-and-breakfast'
};

/** Owner-approved slug list, verbatim from the H-110 task spec. */
const APPROVED_EVENT_CATEGORY_SLUGS: Readonly<Record<EventCategoryEnum, string>> = {
    [EventCategoryEnum.MUSIC]: 'musica',
    [EventCategoryEnum.CULTURE]: 'cultura',
    [EventCategoryEnum.SPORTS]: 'deportes',
    [EventCategoryEnum.GASTRONOMY]: 'gastronomia',
    [EventCategoryEnum.FESTIVAL]: 'festival',
    [EventCategoryEnum.NATURE]: 'naturaleza',
    [EventCategoryEnum.THEATER]: 'teatro',
    [EventCategoryEnum.WORKSHOP]: 'taller',
    [EventCategoryEnum.OTHER]: 'otros'
};

/** Owner-approved slug list, verbatim from the H-110 task spec. */
const APPROVED_POST_CATEGORY_SLUGS: Readonly<Record<PostCategoryEnum, string>> = {
    [PostCategoryEnum.EVENTS]: 'eventos',
    [PostCategoryEnum.CULTURE]: 'cultura',
    [PostCategoryEnum.GASTRONOMY]: 'gastronomia',
    [PostCategoryEnum.NATURE]: 'naturaleza',
    [PostCategoryEnum.TOURISM]: 'turismo',
    [PostCategoryEnum.GENERAL]: 'general',
    [PostCategoryEnum.SPORT]: 'deportes',
    [PostCategoryEnum.CARNIVAL]: 'carnaval',
    [PostCategoryEnum.NIGHTLIFE]: 'noche',
    [PostCategoryEnum.HISTORY]: 'historia',
    [PostCategoryEnum.TRADITIONS]: 'tradiciones',
    [PostCategoryEnum.WELLNESS]: 'bienestar',
    [PostCategoryEnum.FAMILY]: 'familia',
    [PostCategoryEnum.TIPS]: 'consejos',
    [PostCategoryEnum.ART]: 'arte',
    [PostCategoryEnum.BEACH]: 'playa',
    [PostCategoryEnum.RURAL]: 'rural',
    [PostCategoryEnum.FESTIVALS]: 'festivales'
};

/**
 * Naive lowercase-hyphenate transform, reproduced here (independent of the
 * module under test) so the "identical slug" set below is computed, not
 * hand-picked. A hand-picked list is easy to leave incomplete — e.g. an
 * earlier version of this test only listed `hotel`/`hostel`/`camping`/`motel`
 * as identical for accommodation type and silently missed `apart-hotel`,
 * `estancia`, and `bed-and-breakfast`, which are ALSO spelled identically.
 */
function naiveSlug(value: string): string {
    return value.toLowerCase().replace(/_/g, '-');
}

/** Every slug spelled identically in English and Spanish for a facet — the loop-safety case — computed from the approved list itself. */
function computeIdenticalSlugs(approved: Readonly<Record<string, string>>): readonly string[] {
    return Object.entries(approved)
        .filter(([enumValue, spanishSlug]) => naiveSlug(enumValue) === spanishSlug)
        .map(([, spanishSlug]) => spanishSlug);
}

const IDENTICAL_ACCOMMODATION_TYPE_SLUGS = computeIdenticalSlugs(APPROVED_ACCOMMODATION_TYPE_SLUGS);
const IDENTICAL_EVENT_CATEGORY_SLUGS = computeIdenticalSlugs(APPROVED_EVENT_CATEGORY_SLUGS);
const IDENTICAL_POST_CATEGORY_SLUGS = computeIdenticalSlugs(APPROVED_POST_CATEGORY_SLUGS);

describe('facet-slugs — accommodation type (H-110)', () => {
    it.each(
        Object.entries(APPROVED_ACCOMMODATION_TYPE_SLUGS)
    )('maps %s -> %s (forward)', (enumValue, expectedSlug) => {
        expect(ACCOMMODATION_TYPE_SLUG_BY_ENUM[enumValue as AccommodationTypeEnum]).toBe(
            expectedSlug
        );
        expect(slugForAccommodationType({ type: enumValue as AccommodationTypeEnum })).toBe(
            expectedSlug
        );
    });

    it.each(
        Object.entries(APPROVED_ACCOMMODATION_TYPE_SLUGS)
    )('resolves %s <- %s (reverse)', (enumValue, slug) => {
        expect(resolveAccommodationTypeSlug({ slug })).toBe(enumValue);
    });

    it('resolves case-insensitively', () => {
        expect(resolveAccommodationTypeSlug({ slug: 'CABANA' })).toBe(AccommodationTypeEnum.CABIN);
    });

    it('returns undefined for an invalid slug', () => {
        expect(resolveAccommodationTypeSlug({ slug: 'not-a-real-type' })).toBeUndefined();
    });

    it('returns undefined for an undefined slug', () => {
        expect(resolveAccommodationTypeSlug({ slug: undefined })).toBeUndefined();
    });

    it('returns undefined for the legacy English slug — it is not a valid Spanish slug', () => {
        expect(resolveAccommodationTypeSlug({ slug: 'cabin' })).toBeUndefined();
        expect(resolveAccommodationTypeSlug({ slug: 'country-house' })).toBeUndefined();
    });

    it('GUARD: the slug map has exactly one entry per enum member (fails if the enum grows without the map)', () => {
        const enumValues = new Set(Object.values(AccommodationTypeEnum));
        const mapKeys = new Set(Object.keys(ACCOMMODATION_TYPE_SLUG_BY_ENUM));
        expect(mapKeys.size).toBe(enumValues.size);
        expect(mapKeys).toEqual(enumValues);
    });

    it('the legacy-English-slug map omits every slug identical to its Spanish form (loop-safety) — 7 of 13 types are identical: hotel, hostel, camping, motel, apart-hotel, estancia, bed-and-breakfast', () => {
        expect(IDENTICAL_ACCOMMODATION_TYPE_SLUGS).toEqual(
            expect.arrayContaining([
                'hotel',
                'hostel',
                'camping',
                'motel',
                'apart-hotel',
                'estancia',
                'bed-and-breakfast'
            ])
        );
        expect(IDENTICAL_ACCOMMODATION_TYPE_SLUGS).toHaveLength(7);
        for (const identical of IDENTICAL_ACCOMMODATION_TYPE_SLUGS) {
            expect(ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS[identical]).toBeUndefined();
        }
        // And every entry present really does differ from its target.
        for (const [englishSlug, spanishSlug] of Object.entries(
            ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS
        )) {
            expect(englishSlug).not.toBe(spanishSlug);
        }
    });

    it('no canonical Spanish slug is ALSO a legacy-English key (would redirect a working canonical URL away from itself)', () => {
        const canonicalSlugs = new Set(Object.values(ACCOMMODATION_TYPE_SLUG_BY_ENUM));
        for (const legacyKey of Object.keys(ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS)) {
            expect(canonicalSlugs.has(legacyKey)).toBe(false);
        }
    });
});

describe('facet-slugs — event category (H-110)', () => {
    it.each(
        Object.entries(APPROVED_EVENT_CATEGORY_SLUGS)
    )('maps %s -> %s (forward)', (enumValue, expectedSlug) => {
        expect(EVENT_CATEGORY_SLUG_BY_ENUM[enumValue as EventCategoryEnum]).toBe(expectedSlug);
        expect(slugForEventCategory({ category: enumValue as EventCategoryEnum })).toBe(
            expectedSlug
        );
    });

    it.each(
        Object.entries(APPROVED_EVENT_CATEGORY_SLUGS)
    )('resolves %s <- %s (reverse)', (enumValue, slug) => {
        expect(resolveEventCategorySlug({ slug })).toBe(enumValue);
    });

    it('resolves case-insensitively', () => {
        expect(resolveEventCategorySlug({ slug: 'MUSICA' })).toBe(EventCategoryEnum.MUSIC);
    });

    it('returns undefined for an invalid slug', () => {
        expect(resolveEventCategorySlug({ slug: 'not-a-real-category' })).toBeUndefined();
    });

    it('returns undefined for an undefined slug', () => {
        expect(resolveEventCategorySlug({ slug: undefined })).toBeUndefined();
    });

    it('returns undefined for the legacy English slug — it is not a valid Spanish slug', () => {
        expect(resolveEventCategorySlug({ slug: 'gastronomy' })).toBeUndefined();
        expect(resolveEventCategorySlug({ slug: 'music' })).toBeUndefined();
    });

    it('GUARD: the slug map has exactly one entry per enum member (fails if the enum grows without the map)', () => {
        const enumValues = new Set(Object.values(EventCategoryEnum));
        const mapKeys = new Set(Object.keys(EVENT_CATEGORY_SLUG_BY_ENUM));
        expect(mapKeys.size).toBe(enumValues.size);
        expect(mapKeys).toEqual(enumValues);
    });

    it('the legacy-English-slug map omits every slug identical to its Spanish form (loop-safety) — only "festival" is identical', () => {
        expect(IDENTICAL_EVENT_CATEGORY_SLUGS).toEqual(['festival']);
        for (const identical of IDENTICAL_EVENT_CATEGORY_SLUGS) {
            expect(EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS[identical]).toBeUndefined();
        }
        for (const [englishSlug, spanishSlug] of Object.entries(
            EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS
        )) {
            expect(englishSlug).not.toBe(spanishSlug);
        }
    });

    it('no canonical Spanish slug is ALSO a legacy-English key (would redirect a working canonical URL away from itself)', () => {
        const canonicalSlugs = new Set(Object.values(EVENT_CATEGORY_SLUG_BY_ENUM));
        for (const legacyKey of Object.keys(EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS)) {
            expect(canonicalSlugs.has(legacyKey)).toBe(false);
        }
    });
});

describe('facet-slugs — post category (H-110)', () => {
    it.each(
        Object.entries(APPROVED_POST_CATEGORY_SLUGS)
    )('maps %s -> %s (forward)', (enumValue, expectedSlug) => {
        expect(POST_CATEGORY_SLUG_BY_ENUM[enumValue as PostCategoryEnum]).toBe(expectedSlug);
        expect(slugForPostCategory({ category: enumValue as PostCategoryEnum })).toBe(expectedSlug);
    });

    it.each(
        Object.entries(APPROVED_POST_CATEGORY_SLUGS)
    )('resolves %s <- %s (reverse)', (enumValue, slug) => {
        expect(resolvePostCategorySlug({ slug })).toBe(enumValue);
    });

    it('resolves case-insensitively', () => {
        expect(resolvePostCategorySlug({ slug: 'GASTRONOMIA' })).toBe(PostCategoryEnum.GASTRONOMY);
    });

    it('returns undefined for an invalid slug', () => {
        expect(resolvePostCategorySlug({ slug: 'not-a-real-category' })).toBeUndefined();
    });

    it('returns undefined for an undefined slug', () => {
        expect(resolvePostCategorySlug({ slug: undefined })).toBeUndefined();
    });

    it('returns undefined for the legacy English slug — it is not a valid Spanish slug', () => {
        expect(resolvePostCategorySlug({ slug: 'gastronomy' })).toBeUndefined();
        expect(resolvePostCategorySlug({ slug: 'nightlife' })).toBeUndefined();
    });

    it('GUARD: the slug map has exactly one entry per enum member (fails if the enum grows without the map)', () => {
        const enumValues = new Set(Object.values(PostCategoryEnum));
        const mapKeys = new Set(Object.keys(POST_CATEGORY_SLUG_BY_ENUM));
        expect(mapKeys.size).toBe(enumValues.size);
        expect(mapKeys).toEqual(enumValues);
    });

    it('the legacy-English-slug map omits every slug identical to its Spanish form (loop-safety) — "general" and "rural" are identical', () => {
        expect(IDENTICAL_POST_CATEGORY_SLUGS).toEqual(expect.arrayContaining(['general', 'rural']));
        expect(IDENTICAL_POST_CATEGORY_SLUGS).toHaveLength(2);
        for (const identical of IDENTICAL_POST_CATEGORY_SLUGS) {
            expect(POST_CATEGORY_LEGACY_ENGLISH_SLUGS[identical]).toBeUndefined();
        }
        for (const [englishSlug, spanishSlug] of Object.entries(
            POST_CATEGORY_LEGACY_ENGLISH_SLUGS
        )) {
            expect(englishSlug).not.toBe(spanishSlug);
        }
    });

    it('no canonical Spanish slug is ALSO a legacy-English key (would redirect a working canonical URL away from itself)', () => {
        const canonicalSlugs = new Set(Object.values(POST_CATEGORY_SLUG_BY_ENUM));
        for (const legacyKey of Object.keys(POST_CATEGORY_LEGACY_ENGLISH_SLUGS)) {
            expect(canonicalSlugs.has(legacyKey)).toBe(false);
        }
    });
});

describe('facet-slugs — immutability', () => {
    it('every forward map is frozen at runtime', () => {
        expect(Object.isFrozen(ACCOMMODATION_TYPE_SLUG_BY_ENUM)).toBe(true);
        expect(Object.isFrozen(EVENT_CATEGORY_SLUG_BY_ENUM)).toBe(true);
        expect(Object.isFrozen(POST_CATEGORY_SLUG_BY_ENUM)).toBe(true);
    });

    it('every legacy-English-slug map is frozen at runtime', () => {
        expect(Object.isFrozen(ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS)).toBe(true);
        expect(Object.isFrozen(EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS)).toBe(true);
        expect(Object.isFrozen(POST_CATEGORY_LEGACY_ENGLISH_SLUGS)).toBe(true);
    });
});
