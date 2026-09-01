/**
 * @file billing-i18n-plan-card.test.ts
 * @description Unit tests for the plan-card i18n helpers added by HOS-943:
 * the per-plan "recommended for" profile (AC-12), the per-limit explanation
 * (AC-13) and the limit value formatter.
 *
 * These are pure functions over an injected translator, so unlike the `.astro`
 * component they can actually be executed. The translator fixture mimics the
 * real `resolve()` contract on the ONE behaviour that matters here: a missing
 * key with a fallback returns the FALLBACK, and a missing key with no fallback
 * returns the raw dotted key (never an empty string — that is what makes the
 * `t(key, '')` idiom used elsewhere in this app quietly ship `a.b.c` to users).
 */

import { describe, expect, it } from 'vitest';
import {
    formatLimitValue,
    getLimitHelp,
    getLimitName,
    getPlanRecommendedFor
} from '@/lib/billing-i18n';

/**
 * Build a translator over a fixed dictionary, matching `resolve()`'s real
 * fallback semantics.
 */
function translatorOver(dict: Record<string, string>) {
    return (key: string, fallback?: string): string => {
        const hit = dict[key];
        if (hit) return hit;
        return fallback ? fallback : key;
    };
}

const PLAN = { slug: 'owner-pro', name: 'Professional', description: 'desc' };

describe('getPlanRecommendedFor', () => {
    it('returns the curated per-slug profile when one exists', () => {
        const t = translatorOver({
            'pricing.recommendedFor.plan.owner-pro': 'quien maneja varias propiedades',
            'pricing.recommendedFor.default.owner': 'quien publica su alojamiento'
        });

        expect(getPlanRecommendedFor({ plan: PLAN, audience: 'owner', t })).toBe(
            'quien maneja varias propiedades'
        );
    });

    it('falls back to the audience profile for a slug nobody has written copy for', () => {
        // AC-12: EVERY card must carry a profile. A plan created in admin has no
        // curated key, and the one thing that must never happen is the card
        // rendering the raw dotted key as its audience line.
        const t = translatorOver({
            'pricing.recommendedFor.default.owner': 'quien publica su alojamiento'
        });

        const result = getPlanRecommendedFor({
            plan: { slug: 'owner-brand-new', name: 'New', description: '' },
            audience: 'owner',
            t
        });

        expect(result).toBe('quien publica su alojamiento');
        expect(result).not.toContain('pricing.recommendedFor');
    });

    it('reads the generic profile from the audience, so tourist and owner differ', () => {
        const t = translatorOver({
            'pricing.recommendedFor.default.owner': 'perfil anfitrión',
            'pricing.recommendedFor.default.tourist': 'perfil viajero'
        });
        const unknown = { slug: 'unknown', name: 'X', description: '' };

        expect(getPlanRecommendedFor({ plan: unknown, audience: 'owner', t })).toBe(
            'perfil anfitrión'
        );
        expect(getPlanRecommendedFor({ plan: unknown, audience: 'tourist', t })).toBe(
            'perfil viajero'
        );
    });

    it('never returns an empty string', () => {
        // An empty profile line reads on the page exactly like a missing one.
        const t = translatorOver({});

        expect(getPlanRecommendedFor({ plan: PLAN, audience: 'owner', t }).length).toBeGreaterThan(
            0
        );
    });
});

describe('getLimitHelp', () => {
    it('returns the localized explanation for a known limit key', () => {
        const t = translatorOver({
            'billing.limitHelp.max_photos_per_accommodation': 'Cuántas fotos podés subir.'
        });

        expect(getLimitHelp({ key: 'max_photos_per_accommodation', t })).toBe(
            'Cuántas fotos podés subir.'
        );
    });

    it('falls back to the catalogue description rather than to an empty string', () => {
        // AC-13 is "every numeric cap carries an explanation". Degrading to ''
        // would satisfy the type and defeat the requirement.
        const result = getLimitHelp({ key: 'max_accommodations', t: translatorOver({}) });

        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toBe('billing.limitHelp.max_accommodations');
    });

    it('degrades to a humanized key for a limit the catalogue does not know', () => {
        const result = getLimitHelp({ key: 'max_something_new', t: translatorOver({}) });

        expect(result).toBe('Max Something New');
    });

    it('is a DIFFERENT string from the limit label, not a repeat of it', () => {
        // A card that renders "Fotos por alojamiento: 30" twice explains nothing.
        const t = translatorOver({});

        expect(getLimitHelp({ key: 'max_accommodations', t })).not.toBe(
            getLimitName({ key: 'max_accommodations', t })
        );
    });
});

describe('formatLimitValue', () => {
    const t = translatorOver({ 'billing.comparison.unlimited': 'Ilimitado' });

    it('renders the unlimited label instead of the raw sentinel', () => {
        expect(formatLimitValue({ value: -1, isUnlimited: true, intlLocale: 'es-AR', t })).toBe(
            'Ilimitado'
        );
    });

    it('formats a finite value for the locale', () => {
        expect(formatLimitValue({ value: 1250, isUnlimited: false, intlLocale: 'es-AR', t })).toBe(
            new Intl.NumberFormat('es-AR').format(1250)
        );
    });

    it('never leaks -1 to the page', () => {
        expect(formatLimitValue({ value: -1, isUnlimited: true, intlLocale: 'es-AR', t })).not.toBe(
            '-1'
        );
    });

    it('falls back to the plain number when the locale tag is invalid', () => {
        expect(
            formatLimitValue({ value: 30, isUnlimited: false, intlLocale: 'not a locale', t })
        ).toBe('30');
    });
});
