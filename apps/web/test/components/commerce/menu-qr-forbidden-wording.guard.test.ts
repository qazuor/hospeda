/**
 * @file menu-qr-forbidden-wording.guard.test.ts
 * @description Guard: the gastronomy menu QR panel must NEVER promise
 * location/origin/country data (HOS-1044 §8, NG-3/NG-4).
 *
 * HOS-1141 decided against recording a country for a scanned QR: a table QR
 * is scanned from inside the venue, so the column would read "Argentina"
 * almost always — including for the tourists the metric exists to count. A
 * "where from" referrer cannot even be captured (a camera scan opens the URL
 * directly with no `Referer` header). Only **device** and **language** are
 * real signals, and the wording must say exactly that.
 *
 * This is a cheap, static guard specifically so the promise cannot creep back
 * in through a copy edit: it scans BOTH the widget's own source (its
 * hardcoded Spanish fallback strings) and the three i18n locale files' actual
 * `commerce.owner.list.menuQr` subtree, per language.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WIDGET_SOURCE_PATH = path.resolve(
    __dirname,
    '../../../src/components/commerce/GastronomyMenuQrWidget.client.tsx'
);

const I18N_LOCALES_DIR = path.resolve(__dirname, '../../../../../packages/i18n/src/locales');

/** Forbidden terms per language — location/origin/"where from"/country. */
const FORBIDDEN_TERMS_BY_LOCALE: Readonly<Record<'es' | 'en' | 'pt', readonly string[]>> = {
    es: ['ubicación', 'ubicacion', 'origen', 'desde dónde', 'desde donde', 'país', 'pais'],
    en: ['location', 'origin', 'where from', 'country'],
    pt: ['localização', 'localizacao', 'origem', 'de onde', 'país', 'pais']
};

/** Every forbidden term across every locale — used to sweep the widget's own source. */
const ALL_FORBIDDEN_TERMS = Object.values(FORBIDDEN_TERMS_BY_LOCALE).flat();

/** Recursively collects every string leaf value from a nested object. */
function collectStringValues(obj: unknown): string[] {
    if (typeof obj === 'string') {
        return [obj];
    }
    if (obj && typeof obj === 'object') {
        return Object.values(obj as Record<string, unknown>).flatMap(collectStringValues);
    }
    return [];
}

function loadMenuQrStrings(locale: 'es' | 'en' | 'pt'): string[] {
    const filePath = path.join(I18N_LOCALES_DIR, locale, 'commerce.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
        owner?: { list?: { menuQr?: unknown } };
    };
    const menuQr = content.owner?.list?.menuQr;
    return menuQr ? collectStringValues(menuQr) : [];
}

function findForbiddenHits(input: { text: string; terms: readonly string[] }): string[] {
    const lower = input.text.toLowerCase();
    return input.terms.filter((term) => lower.includes(term.toLowerCase()));
}

/**
 * Extracts the fallback-text argument of every `t('key', 'fallback', ...)`
 * call in a source file — i.e. the actual RENDERED strings, as opposed to
 * doc comments, which legitimately explain what NOT to say (this widget's
 * own module doc names "location"/"where from" precisely to document the
 * decision against them).
 */
function extractTranslationFallbacks(source: string): string[] {
    const pattern = /\bt\(\s*'[a-zA-Z0-9_.]+',\s*'((?:\\.|[^'\\])*)'/g;
    const fallbacks: string[] = [];
    for (const match of source.matchAll(pattern)) {
        const fallback = match[1];
        if (fallback) {
            fallbacks.push(fallback);
        }
    }
    return fallbacks;
}

describe('GastronomyMenuQrWidget forbidden wording (HOS-1044 NG-3/NG-4)', () => {
    it('every rendered fallback string carries no location/origin/country wording', () => {
        const source = fs.readFileSync(WIDGET_SOURCE_PATH, 'utf-8');
        const fallbacks = extractTranslationFallbacks(source);
        expect(fallbacks.length).toBeGreaterThan(0);

        const hits = fallbacks.flatMap((text) =>
            findForbiddenHits({ text, terms: ALL_FORBIDDEN_TERMS }).map(
                (term) => `"${term}" in "${text}"`
            )
        );

        expect(
            hits,
            `Forbidden terms found in widget's rendered fallback strings: ${hits.join(', ')}`
        ).toEqual([]);
    });

    for (const locale of ['es', 'en', 'pt'] as const) {
        it(`the ${locale} commerce.json menuQr strings carry no location/origin/country wording`, () => {
            const strings = loadMenuQrStrings(locale);
            expect(
                strings.length,
                `menuQr keys missing in ${locale}/commerce.json`
            ).toBeGreaterThan(0);

            const hits = strings.flatMap((text) =>
                findForbiddenHits({ text, terms: FORBIDDEN_TERMS_BY_LOCALE[locale] }).map(
                    (term) => `"${term}" in "${text}"`
                )
            );

            expect(hits, `Forbidden terms found in ${locale}/commerce.json menuQr`).toEqual([]);
        });
    }

    it('the panel DOES mention device and language — the two real signals', () => {
        const esStrings = loadMenuQrStrings('es').join(' ').toLowerCase();
        expect(esStrings).toContain('dispositivo');
        expect(esStrings).toContain('idioma');
    });
});
