/**
 * @file type-labels.test.ts
 * @description The gastronomy owner form and the public listing page name a
 * listing type from ONE source (HOS-822).
 *
 * Written against the cause of the original drift (two hand-maintained label
 * tables), not its symptom: what is asserted is that the form resolves the
 * PUBLIC key and that every enum member resolves to a real translated value.
 */

import { GastronomyTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildGastronomyTypeLabelKey,
    resolveGastronomyTypeLabel
} from '../../../src/lib/gastronomy/type-labels';
import { createTranslations, type SupportedLocale } from '../../../src/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];
const GASTRONOMY_TYPES = Object.values(GastronomyTypeEnum);

describe('buildGastronomyTypeLabelKey', () => {
    it('points at the public gastronomy namespace', () => {
        expect(buildGastronomyTypeLabelKey({ type: 'RESTAURANT' })).toBe(
            'gastronomy.types.RESTAURANT'
        );
    });

    it('never rebuilds the retired editor-private namespace', () => {
        for (const type of GASTRONOMY_TYPES) {
            expect(buildGastronomyTypeLabelKey({ type })).not.toContain('typeOption');
        }
    });
});

describe('resolveGastronomyTypeLabel: the form reads what the listing prints', () => {
    it.each(LOCALES)('resolves every enum member to a real translated label in %s', (locale) => {
        const { t } = createTranslations(locale);

        for (const type of GASTRONOMY_TYPES) {
            const label = resolveGastronomyTypeLabel({ t, type });

            // A missing key degrades to the raw enum value, so asserting the
            // label differs from it makes this a CONTENT check.
            expect(label, `${type} in ${locale} has no label`).not.toBe(type);
            expect(label.trim().length, `${type} in ${locale} is blank`).toBeGreaterThan(0);
            expect(label, `${type} in ${locale} looks like a raw key`).not.toContain('.');
        }
    });

    it('degrades to the raw enum value for a type with no translation', () => {
        const { t } = createTranslations('es');

        expect(resolveGastronomyTypeLabel({ t, type: 'NOT_A_REAL_TYPE' })).toBe('NOT_A_REAL_TYPE');
    });
});
