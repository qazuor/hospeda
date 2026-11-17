/**
 * @file location-field-validation-copy.guard.test.ts
 * @description Regression guard for HOS-2317. The postal-address validation
 * messages (`zodError.accommodation.location.*`, reused by venue and the
 * experience editors, and `zodError.eventLocation.*`) were bulk-generated with
 * the raw English field identifier spliced into Spanish copy, so a one-character
 * street rendered «El street debe tener al menos 2 caracteres» in every locale.
 *
 * Asserts the human field label is used instead and that `en`/`pt` no longer
 * carry Spanish copy for these keys.
 */

import { describe, expect, it } from 'vitest';

const LOCALE_MODULES = import.meta.glob<Record<string, unknown>>(
    '../src/locales/*/validation.json',
    {
        eager: true,
        import: 'default'
    }
);

type Tree = { readonly [key: string]: string | Tree };

const load = (locale: string): Tree => {
    const entry = Object.entries(LOCALE_MODULES).find(([path]) =>
        path.includes(`/locales/${locale}/`)
    );
    return (entry?.[1] ?? {}) as Tree;
};

const collect = ({ node, prefix }: { node: string | Tree; prefix: string }): [string, string][] =>
    typeof node === 'string'
        ? [[prefix, node]]
        : Object.entries(node).flatMap(([k, v]) =>
              collect({ node: v, prefix: prefix ? `${prefix}.${k}` : k })
          );

const RAW_FIELD_RE = /\b(street|number|floor|apartment|neighborhood|department|place name)\b/;

describe('postal address validation copy (HOS-2317)', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
        const tree = load(locale);
        const accommodationLocation = (tree.accommodation as Tree)?.location as Tree;
        const eventLocation = tree.eventLocation as Tree;
        const entries = [
            ...collect({ node: accommodationLocation, prefix: 'accommodation.location' }),
            ...collect({ node: eventLocation, prefix: 'eventLocation' })
        ].filter(([key]) =>
            /\.(street|number|floor|apartment|neighborhood|department|placeName)\./.test(key)
        );

        it(`${locale}: has entries to check`, () => {
            expect(entries.length).toBeGreaterThan(0);
        });

        it(`${locale}: never splices a raw English field identifier into non-English copy`, () => {
            const offenders = entries.filter(([, v]) => locale !== 'en' && RAW_FIELD_RE.test(v));
            expect(offenders).toEqual([]);
        });

        if (locale !== 'es') {
            it(`${locale}: carries no Spanish copy`, () => {
                const offenders = entries.filter(([, v]) => /^(El|La) /.test(v));
                expect(offenders).toEqual([]);
            });
        }
    }

    it('es street.min reads as a fully Spanish sentence', () => {
        const es = load('es');
        const street = ((es.accommodation as Tree).location as Tree).street as Tree;
        expect(street.min).toBe('La calle debe tener al menos {{min}} caracteres');
    });
});

/** Raw English field identifiers that must never follow a Spanish article in `es` copy. */
const RAW_TOKEN_AFTER_ARTICLE_RE =
    /^(El|La|Los|Las) (street|number|floor|apartment|lat|lng|long|neighborhood|department|placeName|place name)\b/;

/** Key paths that belong to postal-address / coordinate copy. */
const LOCATION_KEY_RE =
    /(^|\.)(location|eventLocation|approximateLocation|coordinates|lat|lng|long)(\.|$)/;

describe('whole-file scan of validation.json (HOS-2317)', () => {
    const all = (locale: string) => collect({ node: load(locale), prefix: '' });

    it('es: no entry puts a raw English field token after an article', () => {
        const offenders = all('es').filter(([, v]) => RAW_TOKEN_AFTER_ARTICLE_RE.test(v));
        expect(offenders).toEqual([]);
    });

    for (const locale of ['en', 'pt'] as const) {
        it(`${locale}: location and coordinate entries carry no Spanish article copy`, () => {
            const offenders = all(locale).filter(
                ([key, v]) => LOCATION_KEY_RE.test(key) && /^(El|La|Los|Las) /.test(v)
            );
            expect(offenders).toEqual([]);
        });
    }

    it('keeps {{placeholders}} identical across locales for coordinate entries', () => {
        const ph = (v: string) => (v.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
        const es = new Map(all('es'));
        for (const locale of ['en', 'pt'] as const) {
            const bad = all(locale).filter(
                ([key, v]) =>
                    LOCATION_KEY_RE.test(key) && es.has(key) && ph(v) !== ph(es.get(key) ?? '')
            );
            expect(bad).toEqual([]);
        }
    });
});
