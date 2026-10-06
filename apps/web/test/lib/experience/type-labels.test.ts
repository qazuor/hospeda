/**
 * @file type-labels.test.ts
 * @description The experience owner form and the public listing page name a
 * listing type from ONE source (HOS-822).
 *
 * The reported symptom was a single word: the form's category selector offered
 * "Alquiler de kayaks" while the published listing said "Alquiler de kayak".
 * The cause was two hand-maintained label tables for the same enum values, so
 * these tests assert the mechanism (the form resolves the PUBLIC key) and the
 * VALUE of each label, never mere key presence.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExperienceTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildExperienceTypeLabelKey,
    resolveExperienceTypeLabel
} from '../../../src/lib/experience/type-labels';
import { createTranslations, type SupportedLocale } from '../../../src/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];
const EXPERIENCE_TYPES = Object.values(ExperienceTypeEnum);

describe('buildExperienceTypeLabelKey', () => {
    it('points at the public experience namespace', () => {
        expect(buildExperienceTypeLabelKey({ type: 'KAYAK_RENTAL' })).toBe(
            'experience.type.KAYAK_RENTAL'
        );
    });

    it('never rebuilds the retired editor-private namespace', () => {
        for (const type of EXPERIENCE_TYPES) {
            expect(buildExperienceTypeLabelKey({ type })).not.toContain('typeOption');
        }
    });
});

describe('resolveExperienceTypeLabel: the form reads what the listing prints', () => {
    it('resolves KAYAK_RENTAL to the singular the public listing uses (es)', () => {
        const { t } = createTranslations('es');

        const label = resolveExperienceTypeLabel({ t, type: 'KAYAK_RENTAL' });

        expect(label).toBe('Alquiler de kayak');
        expect(label).not.toBe('Alquiler de kayaks');
    });

    it('resolves QUAD_RENTAL and TOUR_GUIDE to the public wording (es)', () => {
        const { t } = createTranslations('es');

        expect(resolveExperienceTypeLabel({ t, type: 'QUAD_RENTAL' })).toBe(
            'Alquiler de cuadriciclos'
        );
        expect(resolveExperienceTypeLabel({ t, type: 'TOUR_GUIDE' })).toBe('Guía turístico');
    });

    it.each(LOCALES)('resolves every enum member to a real translated label in %s', (locale) => {
        const { t } = createTranslations(locale);

        for (const type of EXPERIENCE_TYPES) {
            const label = resolveExperienceTypeLabel({ t, type });

            expect(label, `${type} in ${locale} has no label`).not.toBe(type);
            expect(label.trim().length, `${type} in ${locale} is blank`).toBeGreaterThan(0);
            expect(label, `${type} in ${locale} looks like a raw key`).not.toContain('.');
        }
    });

    it('degrades to the raw enum value for a type with no translation', () => {
        const { t } = createTranslations('es');

        expect(resolveExperienceTypeLabel({ t, type: 'NOT_A_REAL_TYPE' })).toBe('NOT_A_REAL_TYPE');
    });
});

describe('the duplicate label table is gone (HOS-822)', () => {
    it.each(LOCALES)('the typeOption block is removed from the %s locale', (locale) => {
        const raw = readFileSync(
            join(__dirname, `../../../../../packages/i18n/src/locales/${locale}/listing.json`),
            'utf-8'
        );

        expect(JSON.parse(raw).owner.editor).not.toHaveProperty('typeOption');
    });
});
