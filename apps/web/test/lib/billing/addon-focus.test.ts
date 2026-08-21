/**
 * @file addon-focus.test.ts
 * @description Unit tests for the add-on focus contract (HOS-729).
 *
 * The load-bearing property under test is the DEGRADATION one: whatever the
 * query string says, `rest` must always contain every add-on that is not the
 * focused one — a focus that matches nothing returns the WHOLE catalog. A
 * regression here turns "focus" into the hard filter the owner rejected.
 */

import { describe, expect, it } from 'vitest';
import {
    ADDON_FOCUS_FALLBACK_HEADING_KEY,
    ADDON_FOCUS_HEADING_KEY_BY_SLUG,
    ADDON_FOCUS_PARAM,
    addonFocusHeadingKey,
    buildAddonFocusUrl,
    splitAddonsByFocus
} from '../../../src/lib/billing/addon-focus';

/** Minimal catalog: only the field the split reads. */
const CATALOG = [
    { slug: 'visibility-boost-7d' },
    { slug: 'extra-photos-20' },
    { slug: 'extra-accommodations-5' }
] as const;

describe('ADDON_FOCUS_PARAM', () => {
    it('is `focus`, not `addon` (which MercadoPago already uses for the return banner)', () => {
        expect(ADDON_FOCUS_PARAM).toBe('focus');
        expect(ADDON_FOCUS_PARAM).not.toBe('addon');
    });
});

describe('buildAddonFocusUrl', () => {
    it('carries both the focus param and the pre-existing anchor', () => {
        const url = buildAddonFocusUrl({ locale: 'es', slug: 'extra-photos-20' });

        expect(url).toBe('/es/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20');
    });

    it('keeps the locale segment of the requested locale', () => {
        expect(buildAddonFocusUrl({ locale: 'en', slug: 'extra-photos-20' })).toMatch(
            /^\/en\/mi-cuenta\/addons\/\?focus=/
        );
        expect(buildAddonFocusUrl({ locale: 'pt', slug: 'extra-photos-20' })).toMatch(
            /^\/pt\/mi-cuenta\/addons\/\?focus=/
        );
    });

    it('parses back into the same slug through URL/URLSearchParams', () => {
        const url = new URL(
            buildAddonFocusUrl({ locale: 'es', slug: 'visibility-boost-30d' }),
            'https://hospeda.test'
        );

        expect(url.searchParams.get(ADDON_FOCUS_PARAM)).toBe('visibility-boost-30d');
        expect(url.hash).toBe('#addon-visibility-boost-30d');
    });
});

describe('addonFocusHeadingKey', () => {
    it('returns the slug-specific key when one exists', () => {
        expect(addonFocusHeadingKey('extra-photos-20')).toBe(
            'account.addons.focus.headings.extra-photos-20'
        );
    });

    it('falls back to the generic key for an unmapped slug', () => {
        expect(addonFocusHeadingKey('brand-new-addon')).toBe(ADDON_FOCUS_FALLBACK_HEADING_KEY);
    });

    it('never returns the fallback key for a slug that IS mapped', () => {
        for (const slug of Object.keys(ADDON_FOCUS_HEADING_KEY_BY_SLUG)) {
            expect(addonFocusHeadingKey(slug)).not.toBe(ADDON_FOCUS_FALLBACK_HEADING_KEY);
        }
    });
});

describe('splitAddonsByFocus', () => {
    it('pulls out the matching add-on and keeps every other one in `rest`', () => {
        const { focused, rest } = splitAddonsByFocus({
            addons: CATALOG,
            focusSlug: 'extra-photos-20'
        });

        expect(focused?.slug).toBe('extra-photos-20');
        expect(rest.map((addon) => addon.slug)).toEqual([
            'visibility-boost-7d',
            'extra-accommodations-5'
        ]);
    });

    it('preserves the original order of the remaining add-ons', () => {
        const { rest } = splitAddonsByFocus({
            addons: CATALOG,
            focusSlug: 'visibility-boost-7d'
        });

        expect(rest.map((addon) => addon.slug)).toEqual([
            'extra-photos-20',
            'extra-accommodations-5'
        ]);
    });

    it('returns the WHOLE catalog when the slug matches nothing', () => {
        const { focused, rest } = splitAddonsByFocus({
            addons: CATALOG,
            focusSlug: 'does-not-exist'
        });

        expect(focused).toBeNull();
        expect(rest.map((addon) => addon.slug)).toEqual(CATALOG.map((addon) => addon.slug));
    });

    it('returns the WHOLE catalog when no slug is requested', () => {
        for (const focusSlug of [undefined, null, '']) {
            const { focused, rest } = splitAddonsByFocus({ addons: CATALOG, focusSlug });

            expect(focused).toBeNull();
            expect(rest).toHaveLength(CATALOG.length);
        }
    });

    it('never drops an add-on: focused + rest always covers the catalog', () => {
        for (const focusSlug of [
            'extra-photos-20',
            'visibility-boost-7d',
            'extra-accommodations-5',
            'nope',
            undefined
        ]) {
            const { focused, rest } = splitAddonsByFocus({ addons: CATALOG, focusSlug });

            const rendered = new Set([
                ...(focused ? [focused.slug] : []),
                ...rest.map((addon) => addon.slug)
            ]);

            expect([...rendered].sort()).toEqual(CATALOG.map((addon) => addon.slug).sort());
        }
    });
});
