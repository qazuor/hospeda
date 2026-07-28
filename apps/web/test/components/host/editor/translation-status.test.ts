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
    anyFieldFailed,
    anyTranslationPersisted,
    applyRunToTranslations,
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

    it('does NOT accept the es i18n value when the plain column is empty', () => {
        // The backend falls back to `i18n.es` only when the plain read is
        // `undefined`, which for an accommodation never happens — that fallback
        // exists for `pointOfInterest.name`, the one entity with no plain column.
        // An empty `richDescription` is `null`, so the service drops the field.
        //
        // Accepting it here was an over-promise with teeth: clear a
        // `richDescription` (admin PATCH, import overwrite) and its
        // `richDescriptionI18n.es` survives, so the panel would offer to translate
        // a field the backend silently skips — and if it were the only gap, the run
        // comes back empty and the button never goes away. BETA-199's symptom,
        // through a different door.
        expect(
            hasSourceContent({
                status: { locales: { es: 'Desde i18n', en: null, pt: null }, plain: null },
                sourceLocale: 'es'
            })
        ).toBe(false);
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

describe('anyFieldFailed', () => {
    // The distinction this function exists for: "nothing was persisted" is not
    // the same as "something failed". A run where every requested pair was
    // SKIPPED (already filled between the render and the click) persists nothing
    // and fails nothing, and reporting it as a failure invents one.
    it('is true when a field reports a failed locale', () => {
        expect(anyFieldFailed({ name: { status: 'failed', failedLocales: ['pt'] } })).toBe(true);
    });

    it('is false when every field was merely untouched', () => {
        expect(
            anyFieldFailed({
                name: { status: 'untouched', failedLocales: [] },
                summary: { status: 'untouched', failedLocales: [] }
            })
        ).toBe(false);
    });

    it('is false for a fully translated run', () => {
        expect(anyFieldFailed({ name: { status: 'translated', failedLocales: [] } })).toBe(false);
    });

    it('is false for an empty map', () => {
        expect(anyFieldFailed({})).toBe(false);
    });

    it('is true even when the failing locale could not be named', () => {
        // `failedLocales` is empty when the backend reports a locale the client
        // does not recognise. The failure still stands.
        expect(anyFieldFailed({ name: { status: 'failed', failedLocales: [] } })).toBe(true);
    });
});

describe('applyRunToTranslations', () => {
    const NEVER = {
        locales: { es: null, en: null, pt: null },
        plain: 'Texto en español'
    };

    it('marks a succeeded locale as present', () => {
        const next = applyRunToTranslations({
            translations: {
                name: NEVER,
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [{ fieldType: 'name', locale: 'en', success: true }]
        });

        expect(next.name.locales.en).toBeTruthy();
        // Untouched locales and fields are left alone.
        expect(next.name.locales.pt).toBeNull();
        expect(next.summary.locales.en).toBeNull();
    });

    it('leaves a failed locale as the gap it still is', () => {
        const next = applyRunToTranslations({
            translations: {
                name: NEVER,
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [
                { fieldType: 'name', locale: 'en', success: true },
                { fieldType: 'name', locale: 'pt', success: false, error: 'provider' }
            ]
        });

        expect(next.name.locales.en).toBeTruthy();
        expect(next.name.locales.pt).toBeNull();
    });

    it('marks a whitespace-only locale as present', () => {
        // The one input the fold used to get wrong. `'   '` is non-null, so a
        // `??` kept it — but every reader trims, so the badge stayed on a dash and
        // the field stayed "missing" under a note reading "Traducido". The button
        // never retired and the next run came back empty, which is the exact loop
        // this function exists to break.
        const next = applyRunToTranslations({
            translations: {
                name: { locales: { es: 'Nombre', en: '   ', pt: null }, plain: 'Nombre' },
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [{ fieldType: 'name', locale: 'en', success: true }]
        });

        expect(next.name.locales.en?.trim()).toBeTruthy();
        expect(missingLocalesFor({ status: next.name, sourceLocale: 'es' })).not.toContain('en');
    });

    it('is idempotent over an already-folded state', () => {
        // A second run folds over the first run's output. The marker must read as
        // present on the way back in, or the fold would undo itself.
        const once = applyRunToTranslations({
            translations: {
                name: NEVER,
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [{ fieldType: 'name', locale: 'en', success: true }]
        });
        const twice = applyRunToTranslations({
            translations: once,
            results: [{ fieldType: 'name', locale: 'en', success: true }]
        });

        expect(twice.name.locales.en).toBe(once.name.locales.en);
    });

    it('ignores a locale the client cannot name', () => {
        const next = applyRunToTranslations({
            translations: {
                name: NEVER,
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [{ fieldType: 'name', locale: 'fr', success: true }]
        });

        expect(next.name.locales).toEqual({ es: null, en: null, pt: null });
    });

    it('never overwrites content that was already there', () => {
        const existing = {
            locales: { es: 'ES', en: 'Real EN text', pt: null },
            plain: 'ES'
        };
        const next = applyRunToTranslations({
            translations: {
                name: existing,
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [{ fieldType: 'name', locale: 'en', success: true }]
        });

        expect(next.name.locales.en).toBe('Real EN text');
    });

    it('returns the input untouched when nothing succeeded', () => {
        const translations = {
            name: NEVER,
            summary: NEVER,
            description: NEVER,
            richDescription: null
        };
        const next = applyRunToTranslations({
            translations,
            results: [{ fieldType: 'name', locale: 'en', success: false }]
        });

        expect(next).toBe(translations);
    });

    it('skips a field the plan excludes rather than resurrecting it', () => {
        // `richDescription: null` means the API withheld the premium pair. A
        // success for it (the backend translates it regardless of entitlement)
        // must not turn the row back on.
        const next = applyRunToTranslations({
            translations: {
                name: NEVER,
                summary: NEVER,
                description: NEVER,
                richDescription: null
            },
            results: [{ fieldType: 'richDescription', locale: 'en', success: true }]
        });

        expect(next.richDescription).toBeNull();
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
