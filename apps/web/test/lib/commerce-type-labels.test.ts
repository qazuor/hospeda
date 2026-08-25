/**
 * @file commerce-type-labels.test.ts
 * @description The owner form and the public listing page name a listing type
 * from ONE source (HOS-822).
 *
 * The reported symptom was a single word: the form's category selector offered
 * "Alquiler de kayaks" while the published listing said "Alquiler de kayak".
 * The cause was two hand-maintained label tables for the same 23 enum values —
 * `commerce.owner.editor.typeOption.*` for the form, `gastronomy.types.*` /
 * `experience.type.*` for the public pages — and at the time of the fix they
 * had drifted in TEN places across the three locales, not one.
 *
 * These tests are written against that cause rather than that symptom: equal
 * strings would pass a comparison test while leaving both tables alive to
 * diverge again on the next edit. What is asserted instead is that the form
 * resolves the PUBLIC key, and that the duplicate no longer exists to be read.
 *
 * Deliberately not a structural key-presence check: "the key exists in es, en
 * and pt" is exactly the assertion that lets an untranslated string through, so
 * the coverage test below resolves each label and inspects its VALUE.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExperienceTypeEnum, GastronomyTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildCommerceTypeLabelKey,
    resolveCommerceTypeLabel
} from '../../src/lib/commerce-type-labels';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

const GASTRONOMY_TYPES = Object.values(GastronomyTypeEnum);
const EXPERIENCE_TYPES = Object.values(ExperienceTypeEnum);

const SRC = join(__dirname, '../../src');

describe('buildCommerceTypeLabelKey', () => {
    it('points the experience vertical at the public experience namespace', () => {
        expect(buildCommerceTypeLabelKey({ vertical: 'experience', type: 'KAYAK_RENTAL' })).toBe(
            'experience.type.KAYAK_RENTAL'
        );
    });

    it('points the gastronomy vertical at the public gastronomy namespace', () => {
        expect(buildCommerceTypeLabelKey({ vertical: 'gastronomy', type: 'RESTAURANT' })).toBe(
            'gastronomy.types.RESTAURANT'
        );
    });

    it('never rebuilds the retired editor-private namespace', () => {
        const keys = [
            ...EXPERIENCE_TYPES.map((type) =>
                buildCommerceTypeLabelKey({ vertical: 'experience', type })
            ),
            ...GASTRONOMY_TYPES.map((type) =>
                buildCommerceTypeLabelKey({ vertical: 'gastronomy', type })
            )
        ];

        for (const key of keys) {
            expect(key).not.toContain('typeOption');
        }
    });
});

describe('resolveCommerceTypeLabel — the form reads what the listing prints', () => {
    // The reported divergence, pinned by value in the locale that reported it.
    it('resolves KAYAK_RENTAL to the singular the public listing uses (es)', () => {
        const { t } = createTranslations('es');

        const label = resolveCommerceTypeLabel({ t, vertical: 'experience', type: 'KAYAK_RENTAL' });

        expect(label).toBe('Alquiler de kayak');
        expect(label).not.toBe('Alquiler de kayaks');
    });

    // The two divergences the issue did not report, in the same locale.
    it('resolves QUAD_RENTAL and TOUR_GUIDE to the public wording (es)', () => {
        const { t } = createTranslations('es');

        expect(resolveCommerceTypeLabel({ t, vertical: 'experience', type: 'QUAD_RENTAL' })).toBe(
            'Alquiler de cuadriciclos'
        );
        expect(resolveCommerceTypeLabel({ t, vertical: 'experience', type: 'TOUR_GUIDE' })).toBe(
            'Guía turístico'
        );
    });

    it.each(LOCALES)('resolves every enum member to a real translated label in %s', (locale) => {
        const { t } = createTranslations(locale);

        const cases = [
            ...EXPERIENCE_TYPES.map((type) => ({ vertical: 'experience' as const, type })),
            ...GASTRONOMY_TYPES.map((type) => ({ vertical: 'gastronomy' as const, type }))
        ];

        for (const { vertical, type } of cases) {
            const label = resolveCommerceTypeLabel({ t, vertical, type });

            // A missing key degrades to the raw enum value. Asserting the
            // label differs from it is what makes this a CONTENT check:
            // a key present-but-empty, or one that fell back, fails here
            // while a structural "does the key exist" test would pass.
            expect(label, `${vertical}/${type} in ${locale} has no label`).not.toBe(type);
            expect(
                label.trim().length,
                `${vertical}/${type} in ${locale} is blank`
            ).toBeGreaterThan(0);
            expect(label, `${vertical}/${type} in ${locale} looks like a raw key`).not.toContain(
                '.'
            );
        }
    });

    it('degrades to the raw enum value for a type with no translation', () => {
        const { t } = createTranslations('es');

        expect(
            resolveCommerceTypeLabel({ t, vertical: 'experience', type: 'NOT_A_REAL_TYPE' })
        ).toBe('NOT_A_REAL_TYPE');
    });
});

describe('the duplicate label table is gone (HOS-822)', () => {
    const FORMS = [
        'components/commerce/CommerceCreateForm.client.tsx',
        'components/commerce/editor/BasicInfoSection.client.tsx'
    ];

    it.each(FORMS)('%s resolves the type label through the shared source', (relPath) => {
        const source = readFileSync(join(SRC, relPath), 'utf-8');

        expect(source).toContain('resolveCommerceTypeLabel(');
    });

    it.each(FORMS)('%s no longer reads the editor-private namespace', (relPath) => {
        const source = readFileSync(join(SRC, relPath), 'utf-8');

        // Anchored on the i18n key, not the local `typeOptions` array variable
        // (which is the enum option list and legitimately stays).
        expect(source).not.toContain('editor.typeOption');
    });

    it.each(LOCALES)('the typeOption block is removed from the %s locale', (locale) => {
        const raw = readFileSync(
            join(__dirname, `../../../../packages/i18n/src/locales/${locale}/commerce.json`),
            'utf-8'
        );

        expect(JSON.parse(raw).owner.editor).not.toHaveProperty('typeOption');
    });
});
