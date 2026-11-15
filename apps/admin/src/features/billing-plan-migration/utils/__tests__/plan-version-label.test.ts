import { type Locale, trans } from '@repo/i18n';
import { describe, expect, it } from 'vitest';
import { planVersionLabel } from '../plan-version-label';

/** Translator reading the REAL catalog for one locale. */
function translator(locale: Locale) {
    return (key: string, params?: Record<string, unknown>) =>
        Object.entries(params ?? {}).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
            trans[locale][key] ?? ''
        );
}

describe('HOS-1616 O-3 the plan version label', () => {
    it('appends the derived ordinal to the plan name in every locale', () => {
        const args = { name: 'Succession plan', versionNumber: 2 };
        expect(planVersionLabel({ t: translator('es'), ...args })).toBe(
            'Succession plan · versión 2'
        );
        expect(planVersionLabel({ t: translator('en'), ...args })).toBe(
            'Succession plan · version 2'
        );
        expect(planVersionLabel({ t: translator('pt'), ...args })).toBe(
            'Succession plan · versão 2'
        );
    });

    it('gives two versions of the same plan different labels', () => {
        const t = translator('es');
        expect(planVersionLabel({ t, name: 'Succession plan', versionNumber: 1 })).not.toBe(
            planVersionLabel({ t, name: 'Succession plan', versionNumber: 2 })
        );
    });
});
