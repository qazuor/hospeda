/**
 * @file TrafficStatsCards.i18n.test.ts
 * @description Resolves the dynamic device keys built by TrafficStatsCards with
 * the REAL translations (no `t` mock), so a missing key or a renamed locale
 * entry fails here instead of showing the Spanish fallback in production.
 */

import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../../src/lib/i18n';

describe('TrafficStatsCards device translations (HOS-2119)', () => {
    it.each([
        ['es', 'Notebook'],
        ['en', 'Laptop'],
        ['pt', 'Notebook']
    ] as const)('resolves the laptop label in %s', (locale, expected) => {
        const { t } = createTranslations(locale);
        expect(t('listing.owner.traffic.devices.laptop')).toBe(expected);
    });

    it.each([
        'desktop',
        'laptop',
        'tablet',
        'mobile',
        'other'
    ])('has a real es translation for devices.%s', (device) => {
        const { t } = createTranslations('es');
        const key = `listing.owner.traffic.devices.${device}`;
        expect(t(key)).not.toBe(key);
    });
});

describe('TrafficStatsCards unavailable message (HOS-2346)', () => {
    it.each([
        ['es', 'Estadísticas no disponibles en este momento. Intentá nuevamente más tarde.'],
        ['en', 'Statistics are not available right now. Please try again later.'],
        ['pt', 'Estatísticas indisponíveis no momento. Tente novamente mais tarde.']
    ] as const)('resolves the unavailable message in %s', (locale, expected) => {
        const { t } = createTranslations(locale);
        expect(t('listing.owner.traffic.unavailable')).toBe(expected);
    });
});
