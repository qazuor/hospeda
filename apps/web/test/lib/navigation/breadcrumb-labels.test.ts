import en from '@repo/i18n/locales/en/nav.json';
import es from '@repo/i18n/locales/es/nav.json';
import pt from '@repo/i18n/locales/pt/nav.json';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createT } from '../../../src/lib/i18n';
import {
    BREADCRUMB_LABEL_KEYS,
    type BreadcrumbLabelKey,
    breadcrumbLabel
} from '../../../src/lib/navigation/breadcrumb-labels';

describe('breadcrumb label registry', () => {
    it('exposes exactly the JSON keys as its typed union', () => {
        expectTypeOf<BreadcrumbLabelKey>().toEqualTypeOf<keyof typeof es.breadcrumbLabels>();
        expectTypeOf<BreadcrumbLabelKey>().toEqualTypeOf<keyof typeof en.breadcrumbLabels>();
        expectTypeOf<BreadcrumbLabelKey>().toEqualTypeOf<keyof typeof pt.breadcrumbLabels>();
        for (const nav of [es, en, pt]) {
            expect([...BREADCRUMB_LABEL_KEYS].sort()).toEqual(
                Object.keys(nav.breadcrumbLabels).sort()
            );
        }
    });

    it.each([
        ['es', es],
        ['en', en],
        ['pt', pt]
    ] as const)('keeps all %s labels nonempty and within 24 characters', (_locale, nav) => {
        for (const [key, label] of Object.entries(nav.breadcrumbLabels)) {
            expect(label.trim(), key).not.toBe('');
            expect([...label].length, key).toBeLessThanOrEqual(24);
        }
    });

    it('uses the registry namespace with the provided translator', () => {
        expect(breadcrumbLabel({ t: createT('es'), key: 'plansHosts' })).toBe('Anfitriones');
        expect(breadcrumbLabel({ t: createT('en'), key: 'accommodations' })).toBe('Stays');
        expect(breadcrumbLabel({ t: createT('pt'), key: 'menu' })).toBe('Cardápio');
    });
});
