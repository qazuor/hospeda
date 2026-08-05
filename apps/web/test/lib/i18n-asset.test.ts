/**
 * @file i18n-asset.test.ts
 * @description Unit tests for the hashed, immutable i18n asset builder
 * (HOS-369 Wave D).
 *
 * `getInlineLocaleMessages` is mocked rather than exercised for real. Under
 * vitest `import.meta.env.SSR` is false, so the real function deliberately
 * returns `{}` (that guard is what keeps the full catalog out of the client
 * bundle) — every assertion about serialization, escaping and per-locale
 * distinctness would then be made against an empty object. The fixtures below
 * carry the two things that actually matter: distinct content per locale, and a
 * value containing `<`.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
    getI18nAssetBody,
    I18N_ASSET_PATH_PREFIX,
    i18nAssetUrl,
    resolveI18nAssetLocale
} from '@/lib/i18n-asset';

/**
 * Distinct per locale, and carrying a `<` that must survive as an escape.
 *
 * Both keys sit under `nav`, which is a CLIENT namespace: since HOS-369 W3-2
 * `buildBody` narrows the dictionary to `CLIENT_I18N_NAMESPACES`, so a fixture
 * under an unreachable namespace would be pruned before the escaping assertion
 * ever saw it, and this test would fail for a reason that has nothing to do
 * with escaping.
 *
 * `vi.hoisted` because the mock factory below is hoisted above every
 * declaration in this file; a plain `const` would not exist yet when it runs.
 */
const FIXTURES = vi.hoisted<Record<string, Record<string, string>>>(() => ({
    es: { 'nav.home': 'Inicio', 'nav.terms': 'Ver <b>términos</b>', 'faq.q1': 'Pregunta' },
    en: { 'nav.home': 'Home', 'nav.terms': 'See <b>terms</b>', 'faq.q1': 'Question' },
    pt: { 'nav.home': 'Início', 'nav.terms': 'Ver <b>termos</b>', 'faq.q1': 'Pergunta' }
}));

vi.mock('@/lib/i18n', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getInlineLocaleMessages: (locale: string) => FIXTURES[locale] ?? {}
    };
});

/** The 8 hex chars embedded in a locale's current URL. */
function hashOf(locale: 'es' | 'en' | 'pt'): string {
    return i18nAssetUrl(locale).slice(`/i18n/${locale}.`.length, -'.js'.length);
}

describe('i18nAssetUrl', () => {
    it('has the content-addressed shape /i18n/<locale>.<8 hex>.js', () => {
        expect(i18nAssetUrl('es')).toMatch(/^\/i18n\/es\.[0-9a-f]{8}\.js$/);
    });

    it('is stable across calls — the hash is computed once, not per call', () => {
        expect(i18nAssetUrl('es')).toBe(i18nAssetUrl('es'));
    });

    it('gives a different URL to every locale', () => {
        const urls = [i18nAssetUrl('es'), i18nAssetUrl('en'), i18nAssetUrl('pt')];

        expect(new Set(urls).size).toBe(3);
    });

    it('is built from the exported prefix, so the endpoint route cannot drift', () => {
        // `/i18n/`, never `/_i18n/`: Astro drops every `src/pages/_*` path from
        // the route manifest, so an underscored directory would serve nothing.
        expect(I18N_ASSET_PATH_PREFIX).toBe('/i18n/');
        expect(i18nAssetUrl('en').startsWith(I18N_ASSET_PATH_PREFIX)).toBe(true);
    });

    it('names the exact bytes the body getter returns', () => {
        // Recomputed with an independent call to node:crypto: this is what
        // makes it impossible for the endpoint to serve one body under a hash
        // that describes another.
        const hash = createHash('sha256')
            .update(getI18nAssetBody('es'), 'utf8')
            .digest('hex')
            .slice(0, 8);

        expect(i18nAssetUrl('es')).toBe(`/i18n/es.${hash}.js`);
    });
});

describe('getI18nAssetBody', () => {
    it('assigns the locale-keyed global, so the reader stays synchronous', () => {
        // The reader (`getClientLocaleDict`) runs while islands render. A body
        // that does anything other than assign this global synchronously hands
        // the first islands an empty dictionary.
        expect(getI18nAssetBody('es')).toContain('(window.__HOSPEDA_I18N__||={})["es"]=');
    });

    it('keys each locale under its own slot so several can coexist', () => {
        expect(getI18nAssetBody('pt')).toContain('["pt"]=');
        expect(getI18nAssetBody('pt')).not.toContain('["es"]=');
    });

    it('carries the actual dictionary content', () => {
        expect(getI18nAssetBody('en')).toContain('"nav.home":"Home"');
    });

    it('escapes every `<` as a unicode escape', () => {
        const body = getI18nAssetBody('es');

        // `>` is deliberately left alone — `<` is the only character that can
        // start a closing tag in an embedding document.
        expect(body).toContain('Ver \\u003cb>t');
        expect(body.includes('<'), 'a raw `<` survived into the served body').toBe(false);
    });

    it('drops namespaces the browser cannot reach, and keeps the ones it can', () => {
        // The fixture deliberately carries BOTH a client namespace (`nav`) and
        // one no client-reachable module names (`faq`). Asserting only the
        // absence of `faq` would pass even with the narrowing removed if the
        // fixture had no `faq` key to begin with — the pair is what makes this
        // sensitive to `buildBody` losing its `pickClientNamespaces` call.
        const body = getI18nAssetBody('es');

        expect(body, 'a non-client namespace was serialized into the asset').not.toContain('"faq.');
        expect(body, 'a client namespace was pruned by mistake').toContain('"nav.home"');
    });
});

describe('resolveI18nAssetLocale', () => {
    it('accepts the filename this deployment currently serves', () => {
        const file = i18nAssetUrl('pt').replace('/i18n/', '');

        expect(resolveI18nAssetLocale(file)).toBe('pt');
    });

    it('rejects a stale hash', () => {
        // The whole reason the endpoint 404s instead of serving fresh content:
        // the response is `immutable` for a year, so answering a stale URL
        // would pin the wrong dictionary in every cache that asked for it.
        expect(resolveI18nAssetLocale('es.deadbeef.js')).toBeNull();
    });

    it('rejects an unknown locale even with a well-formed, current hash', () => {
        expect(resolveI18nAssetLocale(`fr.${hashOf('es')}.js`)).toBeNull();
    });

    it("rejects one locale's filename carrying another locale's hash", () => {
        expect(resolveI18nAssetLocale(`es.${hashOf('en')}.js`)).toBeNull();
    });

    it('rejects anything that is not the exact filename shape', () => {
        const hash = hashOf('es');

        for (const file of [
            '',
            'es.js',
            `es.${hash}`,
            `es.${hash}.mjs`,
            `es.${hash.toUpperCase()}.js`,
            `../es.${hash}.js`,
            `es.${hash}.js/`
        ]) {
            expect(resolveI18nAssetLocale(file), file).toBeNull();
        }
    });
});
