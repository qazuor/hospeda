/**
 * @file plan-name-list.hos2544.test.ts
 * @description HOS-2544: the collections gate and the promotion audience hint name the plans
 * the catalog supplies, never a hardcoded "Plus y VIP", in every locale.
 */
import { describe, expect, it } from 'vitest';
import {
    resolveCollectionsGateMessage,
    resolvePromotionAudienceHint
} from '../../../src/lib/billing/plan-name-list';
import { createT, type SupportedLocale } from '../../../src/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

describe('resolveCollectionsGateMessage (HOS-2544)', () => {
    it.each(LOCALES)('%s: names the catalog plan it receives, never Plus', (locale) => {
        // Arrange
        const t = createT(locale);

        // Act
        const message = resolveCollectionsGateMessage({ locale, planNames: ['Explorador'], t });

        // Assert
        expect(message).toContain('Explorador');
        expect(message).not.toMatch(/Plus|VIP/);
    });

    it('es: lists several catalog plans', () => {
        const message = resolveCollectionsGateMessage({
            locale: 'es',
            planNames: ['Explorador', 'Aventurero'],
            t: createT('es')
        });
        expect(message).toContain('Explorador y Aventurero');
        expect(message).toContain('planes');
    });

    it.each(LOCALES)('%s: names no plan when the catalog was unreadable', (locale) => {
        const message = resolveCollectionsGateMessage({
            locale,
            planNames: [],
            t: createT(locale)
        });
        expect(message).not.toMatch(/Plus|VIP|account\.favorites/);
        expect(message.length).toBeGreaterThan(10);
    });
});

describe('resolvePromotionAudienceHint (HOS-2544)', () => {
    it.each(LOCALES)('%s: names the catalog plan it receives, never Plus', (locale) => {
        const message = resolvePromotionAudienceHint({
            locale,
            planNames: ['Explorador'],
            t: createT(locale)
        });
        expect(message).toContain('Explorador');
        expect(message).not.toContain('Plus');
    });

    it.each(LOCALES)('%s: names no Plus plan when the catalog was unreadable', (locale) => {
        const message = resolvePromotionAudienceHint({ locale, planNames: [], t: createT(locale) });
        expect(message).not.toContain('Plus');
        expect(message).not.toContain('host.promotions');
    });
});
