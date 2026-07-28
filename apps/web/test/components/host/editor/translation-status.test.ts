/**
 * @file translation-status.test.ts
 * @description Pure state rules behind the host TranslationPanel (HOS-317).
 *
 * The panel's own tests drive everything through the Spanish source locale, which
 * is the common path but not the interesting one: for `es` the plain column is the
 * source, for `en`/`pt` only that locale's i18n value is. Getting that backwards
 * means either promising translations the backend will never attempt, or hiding
 * the button from an accommodation that genuinely needs one.
 *
 * Locale and field names are written out as literals on purpose. Deriving them
 * from the same `SUPPORTED_LOCALES` / `TRANSLATABLE_FIELDS` constants the code
 * reads would make the assertions restate the implementation instead of pinning
 * it: rename a locale in the constant and the test would happily follow.
 */

import { describe, expect, it } from 'vitest';
import {
    anyTranslationPersisted,
    fieldsWithMissingTranslations,
    hasSourceContent,
    missingLocalesFor,
    pendingOutcomes,
    summarizeOutcomes
} from '../../../../src/components/host/editor/translation-status';
import type { AccommodationTranslationData } from '../../../../src/lib/api/types';

const SPANISH_ONLY = {
    locales: { es: null, en: null, pt: null },
    plain: 'Texto en español que nunca se tradujo'
};

const ENGLISH_ONLY_I18N = {
    locales: { es: null, en: 'English source text', pt: null },
    plain: null
};

describe('hasSourceContent', () => {
    it('accepts the plain column as the Spanish source', () => {
        // The never-translated case. `locales.es` is empty, but the text exists —
        // it lives in the plain column until `persistTranslations` first runs.
        expect(hasSourceContent({ status: SPANISH_ONLY, sourceLocale: 'es' })).toBe(true);
    });

    it('accepts the es i18n value as the Spanish source', () => {
        expect(
            hasSourceContent({
                status: { locales: { es: 'Desde i18n', en: null, pt: null }, plain: null },
                sourceLocale: 'es'
            })
        ).toBe(true);
    });

    it('ignores the plain column for a non-Spanish source locale', () => {
        // The plain column IS Spanish. A host editing in English cannot translate
        // out of it — `loadTranslatableFields` reads `richDescriptionI18n.en` and
        // finds nothing, so the run would skip the field entirely.
        expect(hasSourceContent({ status: SPANISH_ONLY, sourceLocale: 'en' })).toBe(false);
        expect(hasSourceContent({ status: ENGLISH_ONLY_I18N, sourceLocale: 'en' })).toBe(true);
        expect(hasSourceContent({ status: ENGLISH_ONLY_I18N, sourceLocale: 'pt' })).toBe(false);
    });

    it('treats whitespace-only content as absent', () => {
        // The API trims before deciding, so a whitespace-only column must not make
        // the panel promise a translation the backend will refuse to attempt.
        expect(
            hasSourceContent({
                status: { locales: { es: '   ', en: null, pt: null }, plain: '  \n ' },
                sourceLocale: 'es'
            })
        ).toBe(false);
    });
});

describe('missingLocalesFor', () => {
    it('lists every locale but the source that has no content', () => {
        expect(missingLocalesFor({ status: SPANISH_ONLY, sourceLocale: 'es' })).toEqual([
            'en',
            'pt'
        ]);
    });

    it('excludes the source locale even when it is empty', () => {
        expect(missingLocalesFor({ status: ENGLISH_ONLY_I18N, sourceLocale: 'en' })).toEqual([
            'es',
            'pt'
        ]);
    });

    it('returns nothing for a field with no source content', () => {
        // Not "missing" — unreachable. There is nothing to translate FROM.
        expect(
            missingLocalesFor({
                status: { locales: { es: null, en: null, pt: null }, plain: null },
                sourceLocale: 'es'
            })
        ).toEqual([]);
    });
});

describe('fieldsWithMissingTranslations', () => {
    const base: AccommodationTranslationData = {
        name: {
            locales: { es: 'N', en: 'N', pt: 'N' },
            plain: 'N'
        },
        summary: SPANISH_ONLY,
        description: {
            locales: { es: 'D', en: 'D', pt: 'D' },
            plain: 'D'
        },
        richDescription: null
    };

    it('returns only fields that have both source content and a gap', () => {
        expect(fieldsWithMissingTranslations({ translations: base, sourceLocale: 'es' })).toEqual([
            'summary'
        ]);
    });

    it('skips richDescription entirely when the plan excludes it', () => {
        expect(
            fieldsWithMissingTranslations({
                translations: { ...base, summary: base.name },
                sourceLocale: 'es'
            })
        ).toEqual([]);
    });

    it('includes richDescription when it is present with a gap', () => {
        expect(
            fieldsWithMissingTranslations({
                translations: {
                    ...base,
                    summary: base.name,
                    richDescription: {
                        locales: { es: '<p>R</p>', en: null, pt: null },
                        plain: '<p>R</p>'
                    }
                },
                sourceLocale: 'es'
            })
        ).toEqual(['richDescription']);
    });

    it('preserves display order', () => {
        expect(
            fieldsWithMissingTranslations({
                translations: {
                    name: SPANISH_ONLY,
                    summary: SPANISH_ONLY,
                    description: SPANISH_ONLY,
                    richDescription: SPANISH_ONLY
                },
                sourceLocale: 'es'
            })
        ).toEqual(['name', 'summary', 'description', 'richDescription']);
    });
});

describe('summarizeOutcomes', () => {
    it('marks a field translated when every attempted locale succeeded', () => {
        expect(
            summarizeOutcomes({
                requested: ['name'],
                results: [
                    { fieldType: 'name', locale: 'en', success: true },
                    { fieldType: 'name', locale: 'pt', success: true }
                ]
            })
        ).toEqual({ name: { status: 'translated', failedLocales: [] } });
    });

    it('marks a field failed and names the locales that failed', () => {
        expect(
            summarizeOutcomes({
                requested: ['summary'],
                results: [
                    { fieldType: 'summary', locale: 'en', success: true },
                    { fieldType: 'summary', locale: 'pt', success: false, error: 'timeout' }
                ]
            })
        ).toEqual({ summary: { status: 'failed', failedLocales: ['pt'] } });
    });

    it('marks a requested field with no results as untouched, not translated', () => {
        // The backend skips pairs that are already filled, so an empty result set
        // means nothing was attempted. Calling that "translated" would report work
        // that never happened.
        expect(summarizeOutcomes({ requested: ['description'], results: [] })).toEqual({
            description: { status: 'untouched', failedLocales: [] }
        });
    });

    it('ignores results for fields that were not requested', () => {
        const outcomes = summarizeOutcomes({
            requested: ['name'],
            results: [
                { fieldType: 'name', locale: 'en', success: true },
                { fieldType: 'summary', locale: 'en', success: false }
            ]
        });
        expect(Object.keys(outcomes)).toEqual(['name']);
    });

    it('keeps the failure while dropping a locale the client cannot name', () => {
        // `locale` crosses an HTTP boundary, so an unrecognised value is kept out
        // of the rendered list (it would print as `undefined`). Dropping it must
        // NOT drop the failure with it — that would report an unnameable error to
        // the host as a successful translation.
        expect(
            summarizeOutcomes({
                requested: ['name'],
                results: [{ fieldType: 'name', locale: 'fr', success: false }]
            })
        ).toEqual({ name: { status: 'failed', failedLocales: [] } });
    });
});

describe('pendingOutcomes', () => {
    it('marks every requested field in flight', () => {
        expect(pendingOutcomes(['name', 'summary'])).toEqual({
            name: { status: 'pending', failedLocales: [] },
            summary: { status: 'pending', failedLocales: [] }
        });
    });

    it('is empty for an empty request', () => {
        expect(pendingOutcomes([])).toEqual({});
    });
});

describe('anyTranslationPersisted', () => {
    it('is true when at least one requested pair succeeded', () => {
        expect(
            anyTranslationPersisted({
                requested: ['name'],
                results: [
                    { fieldType: 'name', locale: 'en', success: false },
                    { fieldType: 'name', locale: 'pt', success: true }
                ]
            })
        ).toBe(true);
    });

    it('is false when every requested pair failed', () => {
        expect(
            anyTranslationPersisted({
                requested: ['name'],
                results: [{ fieldType: 'name', locale: 'en', success: false }]
            })
        ).toBe(false);
    });

    it('ignores a success for a field the panel never asked for', () => {
        // The request body carries no field selection — the endpoint always walks
        // every translatable field of the entity. So a run started for `summary`
        // alone also translates `richDescription`, and for a non-entitled host that
        // field is neither shown nor theirs to use. Counting it told them "some
        // translations were generated" about content they cannot see, while
        // offering no way to reach any of it.
        expect(
            anyTranslationPersisted({
                requested: ['summary'],
                results: [
                    { fieldType: 'summary', locale: 'en', success: false },
                    { fieldType: 'richDescription', locale: 'en', success: true }
                ]
            })
        ).toBe(false);
    });

    it('is false for an empty run', () => {
        expect(anyTranslationPersisted({ requested: ['name'], results: [] })).toBe(false);
    });
});
