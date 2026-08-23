/**
 * Regression suite for `buildAddonManagementUrl` (HOS-722).
 *
 * WHY THIS FILE EXISTS
 *
 * The add-on expiration-warning and expired emails pointed their CTA button
 * at `${baseUrl}/es/mi-cuenta/suscripcion` — the wrong page (subscription,
 * not add-ons) AND a locale hardcoded to Spanish regardless of the
 * recipient's actual preference. That email goes out to someone who already
 * bought the add-on and is three days from losing it — the point of highest
 * repurchase intent in the product — so a broken/mislocalized link there
 * costs more than most.
 *
 * Per the issue's explicit instruction: email template rendering is broken
 * in local dev for an unrelated reason (HOS-580, "React is not defined"
 * under `tsx`), so this suite asserts on the CONSTRUCTED URL directly via
 * the pure `buildAddonManagementUrl` helper — never on rendered HTML. This
 * keeps the assertion valid regardless of whether rendering works in a given
 * environment.
 *
 * MUTATION CHECK: reverting `buildAddonManagementUrl` to hardcode `/es/` and
 * `mi-cuenta/suscripcion` (the pre-fix shape) fails every locale test below
 * and the destination test — confirmed manually before committing.
 */

import { describe, expect, it } from 'vitest';
import {
    buildAddonManagementUrl,
    DEFAULT_ADDON_LINK_LOCALE
} from '../../src/templates/utils/addon-links';

const BASE_URL = 'https://hospeda.com.ar';

describe('buildAddonManagementUrl', () => {
    it('points at mi-cuenta/addons, never mi-cuenta/suscripcion', () => {
        const url = buildAddonManagementUrl({ baseUrl: BASE_URL, locale: 'es' });

        expect(url).toContain('/mi-cuenta/addons/');
        expect(url).not.toContain('suscripcion');
    });

    it.each([
        [
            'es',
            `${BASE_URL}/es/mi-cuenta/addons/?focus=visibility-boost-7d#addon-visibility-boost-7d`
        ],
        [
            'en',
            `${BASE_URL}/en/mi-cuenta/addons/?focus=visibility-boost-7d#addon-visibility-boost-7d`
        ],
        [
            'pt',
            `${BASE_URL}/pt/mi-cuenta/addons/?focus=visibility-boost-7d#addon-visibility-boost-7d`
        ]
    ] as const)('builds a %s-locale URL focused on the expiring add-on', (locale, expected) => {
        const url = buildAddonManagementUrl({
            baseUrl: BASE_URL,
            locale,
            addonSlug: 'visibility-boost-7d'
        });

        expect(url).toBe(expected);
    });

    it('falls back to the default locale when none is provided', () => {
        const url = buildAddonManagementUrl({ baseUrl: BASE_URL, addonSlug: 'priority-support' });

        expect(url).toBe(
            `${BASE_URL}/${DEFAULT_ADDON_LINK_LOCALE}/mi-cuenta/addons/?focus=priority-support#addon-priority-support`
        );
    });

    it('falls back to the default locale for an unsupported/garbage value', () => {
        // Defends against a stored `languageWeb` value outside the three
        // supported locales ever reaching the URL unescaped/unvalidated.
        const url = buildAddonManagementUrl({
            baseUrl: BASE_URL,
            // @ts-expect-error — deliberately passing an unsupported locale to prove the guard
            locale: 'fr',
            addonSlug: 'priority-support'
        });

        expect(url).toBe(
            `${BASE_URL}/es/mi-cuenta/addons/?focus=priority-support#addon-priority-support`
        );
    });

    it('omits the focus param entirely when no addonSlug is given', () => {
        const url = buildAddonManagementUrl({ baseUrl: BASE_URL, locale: 'en' });

        expect(url).toBe(`${BASE_URL}/en/mi-cuenta/addons/`);
        expect(url).not.toContain('focus=');
    });

    it('never uses `addon` as the query param name (reserved for the MP return-URL banner)', () => {
        const url = buildAddonManagementUrl({
            baseUrl: BASE_URL,
            locale: 'es',
            addonSlug: 'visibility-boost-30d'
        });

        expect(url).not.toMatch(/[?&]addon=/);
        expect(url).toContain('?focus=visibility-boost-30d');
    });

    it('carries the HOS-729 `#addon-<slug>` fragment, not just the focus param', () => {
        // The fragment is the half of the contract native browser scroll uses:
        // `?focus=` reorders and highlights the card, `#addon-<slug>` is what
        // actually lands the viewport on it. Emitting only the param (the
        // helper's original shape) left the deep link depending on the focused
        // card happening to render first, which is a rendering coincidence.
        // Full contract: apps/web/src/lib/billing/addon-focus.ts.
        const url = buildAddonManagementUrl({
            baseUrl: BASE_URL,
            locale: 'es',
            addonSlug: 'extra-photos-20'
        });

        expect(url).toBe(
            `${BASE_URL}/es/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20`
        );
    });

    it('emits no fragment at all when there is no addonSlug to focus', () => {
        const url = buildAddonManagementUrl({ baseUrl: BASE_URL, locale: 'pt' });

        expect(url).toBe(`${BASE_URL}/pt/mi-cuenta/addons/`);
        expect(url).not.toContain('#');
    });

    it('URL-encodes an addon slug with characters that need escaping', () => {
        const url = buildAddonManagementUrl({
            baseUrl: BASE_URL,
            locale: 'es',
            addonSlug: 'weird slug/with?chars'
        });

        expect(url).toBe(
            `${BASE_URL}/es/mi-cuenta/addons/?focus=weird%20slug%2Fwith%3Fchars#addon-weird%20slug%2Fwith%3Fchars`
        );
    });
});
