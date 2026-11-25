/**
 * @file plan-name-list.hos2544.test.ts
 * @description HOS-2544: the collections gate names the plans the catalog supplies
 * (the promotion audience hint was removed by HOS-2589), never a hardcoded "Plus y VIP", in every locale.
 */
import { describe, expect, it } from 'vitest';
import { resolveCollectionsGateMessage } from '../../../src/lib/billing/plan-name-list';
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
