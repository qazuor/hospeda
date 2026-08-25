/**
 * @file catalog-categories.test.ts
 * @description The amenity-category headings the owner editors group by
 * (HOS-823).
 *
 * `GENERAL_APPLIANCES` is a catch-all: it holds parking, bikes, the pet policy
 * and an experience's included gear, none of which is an appliance. Under the
 * old "Electrodomésticos" heading that was merely odd on an accommodation and
 * actively misleading on an experience, where "Equipo incluido" — the kayak,
 * the life vest, the rod — is among the things a visitor most needs to see.
 *
 * The heading is ONE string shared by both verticals, deliberately: a
 * per-vertical key would add a resolution layer to solve a naming problem.
 * "Equipamiento" covers a fridge and a kayak alike.
 *
 * These assertions are on resolved VALUES, not key presence — a heading that
 * exists in all three locales but still says "Electrodomésticos" is exactly the
 * defect, and a structural check would pass on it.
 */

import { describe, expect, it } from 'vitest';
import {
    AMENITY_CATEGORY_LABELS,
    AMENITY_CATEGORY_ORDER,
    groupAmenitiesByCategory
} from '../../src/lib/catalog-categories';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

/** The heading key under test. */
const KEY = 'accommodations.amenityCategories.generalAppliances';

describe('the catch-all amenity heading (HOS-823)', () => {
    it('reads "Equipamiento" in es, not "Electrodomésticos"', () => {
        const { t } = createTranslations('es');

        expect(t(KEY)).toBe('Equipamiento');
    });

    it.each(LOCALES)('no longer says "appliances" in %s', (locale) => {
        const { t } = createTranslations(locale);

        const label = t(KEY);

        expect(label.toLowerCase()).not.toContain('electrodom');
        expect(label.toLowerCase()).not.toContain('eletrodom');
        expect(label.toLowerCase()).not.toContain('appliance');
    });

    it.each(LOCALES)('resolves to a real translated heading in %s', (locale) => {
        const { t } = createTranslations(locale);

        const label = t(KEY);

        expect(label).not.toBe(KEY);
        expect(label.trim().length).toBeGreaterThan(0);
    });

    it('keeps the inline fallback in step with the translation', () => {
        // A stale fallback is invisible until a translation goes missing, and
        // then it silently reintroduces the wording this issue removed.
        expect(AMENITY_CATEGORY_LABELS.GENERAL_APPLIANCES?.fallback).toBe('Equipamiento');
        expect(AMENITY_CATEGORY_LABELS.GENERAL_APPLIANCES?.i18nKey).toBe('generalAppliances');
    });

    it('renders the new heading when grouping a real catch-all amenity', () => {
        // End-to-end through the function the two editors actually call, so
        // this fails if the label stops being read from the key as well as if
        // the key's value regresses.
        const { t } = createTranslations('es');

        const groups = groupAmenitiesByCategory({
            amenities: [{ id: 'a1', slug: 'bicycles', category: 'GENERAL_APPLIANCES' }] as never,
            t
        });

        expect(groups).toHaveLength(1);
        expect(groups[0]?.label).toBe('Equipamiento');
    });

    it('still lists the catch-all last, after every named category', () => {
        // The rename is a copy change only — it must not reorder the accordions.
        expect(AMENITY_CATEGORY_ORDER.at(-1)).toBe('GENERAL_APPLIANCES');
    });
});
