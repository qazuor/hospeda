/**
 * @file legal-pages-copy.test.ts
 * @description HOS-2681: the privacy, terms and cookie pages say what the
 * product does, in es/en/pt, and read every word from `@repo/i18n`.
 *
 * Astro pages do not render in Vitest, so the keys each page resolves are
 * extracted from its source (the section tables) and looked up in the locale
 * JSON files. That makes a renamed key, a forgotten locale or a section added
 * to a page without its copy fail here instead of shipping an empty heading.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const PAGES = resolve(__dirname, '../../src/pages/[lang]/legal');
const LOCALE_DIR = resolve(__dirname, '../../../../packages/i18n/src/locales');

const pageSource = (page: string) => readFileSync(resolve(PAGES, page, 'index.astro'), 'utf8');
const catalog = (locale: Locale, file: string) =>
    JSON.parse(readFileSync(resolve(LOCALE_DIR, locale, `${file}.json`), 'utf8')) as Record<
        string,
        unknown
    >;

/** Resolves a dotted path inside a namespace file; `undefined` when any segment is missing. */
function lookup({ locale, key }: { locale: Locale; key: string }): unknown {
    const [namespace = '', ...path] = key.split('.');
    return path.reduce<unknown>(
        (node, segment) =>
            node && typeof node === 'object'
                ? (node as Record<string, unknown>)[segment]
                : undefined,
        catalog(locale, namespace)
    );
}

const text = ({ locale, key }: { locale: Locale; key: string }) => {
    const value = lookup({ locale, key });
    return typeof value === 'string' ? value : '';
};

const privacySrc = pageSource('privacidad');
const termsSrc = pageSource('terminos');
const cookiesSrc = pageSource('cookies');

const PRIVACY_SECTIONS = [
    ...privacySrc.matchAll(/\{ id: '([a-z-]+)', key: '(\w+)'(?:, items: \[([^\]]*)\])? \}/g)
].map(([, id = '', key = '', items]) => ({
    id,
    key,
    items: items ? [...items.matchAll(/'(\w+)'/g)].map((match) => match[1] ?? '') : []
}));

const TERMS_IDS = [
    ...(termsSrc.match(/const ids = \[([\s\S]*?)\] as const/)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)
].map((match) => match[1] ?? '');

const COOKIE_SECTIONS = [
    ...(cookiesSrc.match(/const sections = \{([\s\S]*?)\} as const/)?.[1] ?? '').matchAll(
        /'?([a-z-]+)'?: '(\w+)'/g
    )
].map(([, id = '', key = '']) => ({ id, key }));

/** Every heading/body key the three pages resolve, plus page-level keys. */
const ARTICLE_KEYS: readonly { readonly title: string; readonly body: string }[] = [
    ...PRIVACY_SECTIONS.map(({ key }) => ({
        title: `privacy.sections.${key}.title`,
        body: `privacy.sections.${key}.body`
    })),
    ...TERMS_IDS.map((id) => ({
        title: `terms.articles.${id}.title`,
        body: `terms.articles.${id}.body`
    })),
    ...COOKIE_SECTIONS.map(({ key }) => ({
        title: `cookies.sections.${key}.title`,
        body: `cookies.sections.${key}.body`
    }))
];

const EXTRA_KEYS: readonly string[] = [
    'privacy.title',
    'privacy.description',
    'privacy.links.cookiePolicy',
    'privacy.links.contact',
    'terms.title',
    'terms.description',
    'cookies.title',
    'cookies.description',
    'cookies.recording.association',
    'cookies.recording.masking',
    'cookies.recording.retention',
    'cookies.recording.sentry',
    ...PRIVACY_SECTIONS.flatMap(({ key, items }) =>
        items.map((item) => `privacy.sections.${key}.items.${item}`)
    )
];

describe('legal pages read real i18n keys (HOS-2681)', () => {
    it('extracts the section tables from the page sources', () => {
        expect(PRIVACY_SECTIONS.length).toBe(16);
        expect(TERMS_IDS.length).toBe(11);
        expect(COOKIE_SECTIONS.length).toBe(8);
    });

    it('keeps every anchor that existed before HOS-2681, so external links keep working', () => {
        const privacyIds = PRIVACY_SECTIONS.map(({ id }) => id);
        for (const id of [
            'recopilacion',
            'uso',
            'compartir',
            'cookies',
            'grabaciones',
            'email-y-campanas',
            'seguridad',
            'derechos',
            'datos-google',
            'asistentes-ia',
            'contacto'
        ]) {
            expect(privacyIds).toContain(id);
        }
        for (const id of [
            'aceptacion',
            'uso-servicio',
            'registro',
            'publicacion',
            'reservas',
            'cancelaciones',
            'propiedad-intelectual',
            'limitacion',
            'modificaciones',
            'contacto'
        ]) {
            expect(TERMS_IDS).toContain(id);
        }
        expect(COOKIE_SECTIONS.map(({ id }) => id)).toEqual([
            'que-son',
            'cuales-usamos',
            'grabaciones',
            'listado',
            'gestionar',
            'terceros',
            'cambios',
            'contacto'
        ]);
    });

    it('declares no inline Spanish fallback on any legal page', () => {
        for (const src of [privacySrc, termsSrc, cookiesSrc]) {
            expect(src).not.toMatch(/\w+Fb:/);
            expect(src).not.toMatch(/t\('[\w.]+', '/);
        }
    });

    it.each(LOCALES)('resolves every key to non-empty copy in %s', (locale) => {
        const missing = [
            ...ARTICLE_KEYS.flatMap(({ title, body }) => [title, body]),
            ...EXTRA_KEYS
        ].filter((key) => text({ locale, key }).trim() === '');
        expect(missing).toEqual([]);
    });

    it.each(
        LOCALES
    )('carries no hand-written number in any heading in %s (the layout numbers them)', (locale) => {
        const numbered = ARTICLE_KEYS.map(({ title }) => text({ locale, key: title })).filter(
            (title) => /^\d+\.\s/.test(title)
        );
        expect(numbered).toEqual([]);
    });

    it.each(['en', 'pt'] as const)('does not serve the Spanish copy in %s', (locale) => {
        const untranslated = ARTICLE_KEYS.flatMap(({ title, body }) => [title, body]).filter(
            (key) => text({ locale, key }) === text({ locale: 'es', key })
        );
        expect(untranslated).toEqual([]);
    });

    it('drops the dead legacy blocks and the JSON last-updated dates', () => {
        for (const locale of LOCALES) {
            expect(lookup({ locale, key: 'terms.sections' })).toBeUndefined();
            for (const file of ['privacy', 'terms', 'cookies']) {
                expect(lookup({ locale, key: `${file}.lastUpdated` })).toBeUndefined();
                expect(lookup({ locale, key: `${file}.heading` })).toBeUndefined();
            }
        }
    });
});

describe('legal copy states what the product does (HOS-2681)', () => {
    const PRIVACY_TEXT = (locale: Locale) => JSON.stringify(catalog(locale, 'privacy'));

    it.each([
        ['es', 'Hospeda no procesa reservas', /procesar reservas/i],
        ['en', 'Hospeda does not process reservations', /to process reservations/i],
        ['pt', 'A Hospeda não processa reservas', /processar reservas/i]
    ] as const)('never claims Hospeda processes reservations (%s)', (locale, negation, claim) => {
        expect(text({ locale, key: 'privacy.sections.dataUse.body' })).toContain(negation);
        expect(PRIVACY_TEXT(locale)).not.toMatch(claim);
    });

    it.each([
        ['es', 'solo lectura', 'revoque', 'hasta que las liberes'],
        ['en', 'read-only', 'revoke', 'until you release them'],
        ['pt', 'somente de leitura', 'revogue', 'até que você as libere']
    ] as const)('describes the Google Calendar disconnect the code performs (%s)', (locale, readOnly, revoke, kept) => {
        const body = text({ locale, key: 'privacy.sections.googleData.body' });
        expect(body).toContain(readOnly);
        expect(body).toContain(revoke);
        expect(body).toContain(kept);
        // The disconnect keeps the row and the synced dates: no deletion promise.
        expect(body).not.toMatch(/token/i);
    });

    it.each([
        ['es', 'Si aceptás la analítica'],
        ['en', 'If you accept analytics'],
        ['pt', 'Se você aceitar a análise']
    ] as const)('places Umami after analytics consent and keeps Cloudflare cookieless (%s)', (locale, consent) => {
        const body = text({ locale, key: 'privacy.sections.usageMeasurement.body' });
        expect(body).toContain('Cloudflare Web Analytics');
        expect(body.indexOf('Umami')).toBeGreaterThan(body.indexOf(consent));
        expect(body.indexOf(consent)).toBeGreaterThan(-1);
        const cookiesBody = text({ locale, key: 'cookies.sections.cookiesWeUse.body' });
        expect(cookiesBody).toContain('Cloudflare Web Analytics');
    });

    it.each(
        LOCALES
    )('never calls the consented analytics anonymous in the banner (%s)', (locale) => {
        const banner = text({ locale, key: 'cookieConsent.categories.analytics.description' });
        expect(banner).not.toMatch(/an[oó]nim|anonym|an[oô]nim/i);
        expect(banner).toContain('Umami');
    });

    it.each(LOCALES)('promises a trial only to providers, never to tourists (%s)', (locale) => {
        const trial = text({ locale, key: 'terms.articles.prueba.body' });
        expect(trial).not.toMatch(/viajer|turist|travel|tourist|viajante/i);
        for (const file of ['terms', 'privacy', 'cookies', 'cookieConsent']) {
            expect(JSON.stringify(catalog(locale, file))).not.toMatch(
                /(VIP|viajer|turist|travel|tourist|viajante)[^."]{0,60}(prueba|trial|teste)/i
            );
        }
    });

    it('never refers to another article by number', () => {
        for (const locale of LOCALES) {
            expect(JSON.stringify(catalog(locale, 'terms'))).not.toMatch(
                /(art[ií]culo|article|artigo|secci[oó]n|section|seção) \d+/i
            );
        }
    });
});
