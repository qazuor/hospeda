/**
 * @file i18n-asset.test.ts
 * @description Unit tests for the hashed, immutable i18n asset builder
 * (HOS-369 Wave D), split into a critical and a rest part by HOS-2572.
 *
 * `getInlineLocaleMessages` is mocked rather than exercised for real. Under
 * vitest `import.meta.env.SSR` is false, so the real function deliberately
 * returns `{}` (that guard is what keeps the full catalog out of the client
 * bundle) — every assertion about serialization, escaping and per-locale
 * distinctness would then be made against an empty object. The fixtures below
 * carry what actually matters: distinct content per locale, a value containing
 * `<`, one key per part, and one key in no part.
 */

import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
    buildI18nAssetBodies,
    getI18nAssetBody,
    I18N_ASSET_PARTS,
    I18N_ASSET_PATH_PREFIX,
    type I18nAssetPart,
    i18nAssetUrl,
    resolveI18nAsset
} from '@/lib/i18n-asset';

/**
 * Distinct per locale, and carrying a `<` that must survive as an escape.
 *
 *  - `nav.signIn`, `nav.mobileMenu.label` — under CRITICAL prefixes.
 *  - `billing.addonPurchase.chooseOffer` — a client prefix that is NOT critical,
 *    so it must land in the rest part.
 *  - `faq.q1` — no client module names `faq`, so it must land in neither.
 *
 * `vi.hoisted` because the mock factory below is hoisted above every
 * declaration in this file; a plain `const` would not exist yet when it runs.
 */
const FIXTURES = vi.hoisted<Record<string, Record<string, string>>>(() => ({
    es: {
        'nav.signIn': 'Inicio',
        'nav.mobileMenu.label': 'Ver <b>términos</b>',
        'billing.addonPurchase.chooseOffer': 'Elegí un complemento',
        'faq.q1': 'Pregunta'
    },
    en: {
        'nav.signIn': 'Home',
        'nav.mobileMenu.label': 'See <b>terms</b>',
        'billing.addonPurchase.chooseOffer': 'Choose an add-on',
        'faq.q1': 'Question'
    },
    pt: {
        'nav.signIn': 'Início',
        'nav.mobileMenu.label': 'Ver <b>termos</b>',
        'billing.addonPurchase.chooseOffer': 'Escolha um complemento',
        'faq.q1': 'Pergunta'
    }
}));

vi.mock('@/lib/i18n', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getInlineLocaleMessages: (locale: string) => FIXTURES[locale] ?? {}
    };
});

type Locale = 'es' | 'en' | 'pt';

/** The 8 hex chars embedded in a part's current URL. */
function hashOf(locale: Locale, part: I18nAssetPart): string {
    return i18nAssetUrl({ locale, part }).slice(`/i18n/${locale}.${part}.`.length, -'.js'.length);
}

/**
 * Runs asset bodies, in order, against a minimal browser global and returns
 * what they left in `window.__HOSPEDA_I18N__`. The critical body carries the
 * hydration gate, which needs `document`; a parsed document is enough here.
 */
function runBodies(bodies: readonly string[]): Record<string, Record<string, string>> {
    const sandbox: Record<string, unknown> = {
        document: { readyState: 'complete', addEventListener: () => undefined }
    };
    sandbox.window = sandbox;
    for (const body of bodies) runInNewContext(body, sandbox);
    return JSON.parse(JSON.stringify(sandbox.__HOSPEDA_I18N__));
}

describe('i18nAssetUrl', () => {
    it('has the content-addressed shape /i18n/<locale>.<part>.<8 hex>.js', () => {
        expect(i18nAssetUrl({ locale: 'es', part: 'critical' })).toMatch(
            /^\/i18n\/es\.critical\.[0-9a-f]{8}\.js$/
        );
        expect(i18nAssetUrl({ locale: 'es', part: 'rest' })).toMatch(
            /^\/i18n\/es\.rest\.[0-9a-f]{8}\.js$/
        );
    });

    it('is stable across calls — the hash is computed once, not per call', () => {
        expect(i18nAssetUrl({ locale: 'es', part: 'rest' })).toBe(
            i18nAssetUrl({ locale: 'es', part: 'rest' })
        );
    });

    it('gives a different URL to every locale and part', () => {
        const urls = (['es', 'en', 'pt'] as const).flatMap((locale) =>
            I18N_ASSET_PARTS.map((part) => i18nAssetUrl({ locale, part }))
        );

        expect(new Set(urls).size).toBe(6);
    });

    it('is built from the exported prefix, so the endpoint route cannot drift', () => {
        // `/i18n/`, never `/_i18n/`: Astro drops every `src/pages/_*` path from
        // the route manifest, so an underscored directory would serve nothing.
        expect(I18N_ASSET_PATH_PREFIX).toBe('/i18n/');
        expect(
            i18nAssetUrl({ locale: 'en', part: 'rest' }).startsWith(I18N_ASSET_PATH_PREFIX)
        ).toBe(true);
    });

    it('names the exact bytes the body getter returns, per part', () => {
        // Recomputed with an independent call to node:crypto: this is what
        // makes it impossible for the endpoint to serve one body under a hash
        // that describes another.
        for (const part of I18N_ASSET_PARTS) {
            const hash = createHash('sha256')
                .update(getI18nAssetBody({ locale: 'es', part }), 'utf8')
                .digest('hex')
                .slice(0, 8);

            expect(i18nAssetUrl({ locale: 'es', part })).toBe(`/i18n/es.${part}.${hash}.js`);
        }
    });
});

describe('getI18nAssetBody', () => {
    it('merges into the locale-keyed global, never replaces it', () => {
        // Merge is what lets the two parts share one object, in either order.
        for (const part of I18N_ASSET_PARTS) {
            const body = getI18nAssetBody({ locale: 'es', part });
            expect(body, part).toContain('Object.assign(d[l]||(d[l]={}),m)');
            expect(body, part).toContain(
                '(window.__HOSPEDA_I18N__||(window.__HOSPEDA_I18N__={}),"es",'
            );
        }
    });

    it('keys each locale under its own slot so several can coexist', () => {
        const body = getI18nAssetBody({ locale: 'pt', part: 'rest' });

        expect(body).toContain('"pt",');
        expect(body).not.toContain('"es",');
    });

    it('puts critical keys in the critical part and every other client key in the rest', () => {
        const critical = getI18nAssetBody({ locale: 'en', part: 'critical' });
        const rest = getI18nAssetBody({ locale: 'en', part: 'rest' });

        expect(critical).toContain('"nav.signIn":"Home"');
        expect(critical).not.toContain('billing.addonPurchase');
        expect(rest).toContain('"billing.addonPurchase.chooseOffer":"Choose an add-on"');
        expect(rest, 'a key was shipped twice').not.toContain('nav.signIn');
    });

    it('only the critical part carries the hydration gate', () => {
        expect(getI18nAssetBody({ locale: 'es', part: 'critical' })).toContain(
            '__HOSPEDA_HYDRATION_GATE__'
        );
        expect(getI18nAssetBody({ locale: 'es', part: 'rest' })).not.toContain(
            '__HOSPEDA_HYDRATION_GATE__'
        );
    });

    it('escapes every `<` as a unicode escape', () => {
        const body = getI18nAssetBody({ locale: 'es', part: 'critical' });

        // `>` is deliberately left alone — `<` is the only character that can
        // start a closing tag in an embedding document.
        expect(body).toContain('Ver \\u003cb>t');
        expect(body.includes('<'), 'a raw `<` survived into the served body').toBe(false);
    });

    it('drops namespaces the browser cannot reach from BOTH parts', () => {
        // The fixture carries a client key in each part and one non-client key.
        // Asserting only the absence of `faq` would pass with the narrowing
        // removed if the fixture had no `faq` key — the trio is what makes this
        // sensitive to the narrowing being lost.
        for (const part of I18N_ASSET_PARTS) {
            expect(getI18nAssetBody({ locale: 'es', part }), part).not.toContain('"faq.');
        }
    });
});

describe('buildI18nAssetBodies', () => {
    it('both parts together rebuild the whole client dictionary, in either order', () => {
        const { critical, rest } = buildI18nAssetBodies({
            locale: 'pt',
            messages: FIXTURES.pt ?? {}
        });
        const expected = {
            pt: {
                'nav.signIn': 'Início',
                'nav.mobileMenu.label': 'Ver <b>termos</b>',
                'billing.addonPurchase.chooseOffer': 'Escolha um complemento'
            }
        };

        expect(runBodies([critical, rest])).toEqual(expected);
        // A deferred script never runs first, but a soft navigation can insert
        // them in any order — the merge must not care.
        expect(runBodies([rest, critical])).toEqual(expected);
    });

    it('the critical part alone exposes only the critical keys', () => {
        const { critical } = buildI18nAssetBodies({ locale: 'es', messages: FIXTURES.es ?? {} });

        expect(runBodies([critical])).toEqual({
            es: { 'nav.signIn': 'Inicio', 'nav.mobileMenu.label': 'Ver <b>términos</b>' }
        });
    });
});

describe('resolveI18nAsset', () => {
    it('accepts the filenames this deployment currently serves', () => {
        for (const part of I18N_ASSET_PARTS) {
            const file = i18nAssetUrl({ locale: 'pt', part }).replace('/i18n/', '');

            expect(resolveI18nAsset(file)).toEqual({ locale: 'pt', part });
        }
    });

    it('rejects a stale hash', () => {
        // The whole reason the endpoint 404s instead of serving fresh content:
        // the response is `immutable` for a year, so answering a stale URL
        // would pin the wrong dictionary in every cache that asked for it.
        expect(resolveI18nAsset('es.rest.deadbeef.js')).toBeNull();
    });

    it('rejects an unknown locale even with a well-formed, current hash', () => {
        expect(resolveI18nAsset(`fr.rest.${hashOf('es', 'rest')}.js`)).toBeNull();
    });

    it("rejects one locale's filename carrying another locale's hash", () => {
        expect(resolveI18nAsset(`es.rest.${hashOf('en', 'rest')}.js`)).toBeNull();
    });

    it("rejects one part's filename carrying the other part's hash", () => {
        expect(resolveI18nAsset(`es.rest.${hashOf('es', 'critical')}.js`)).toBeNull();
        expect(resolveI18nAsset(`es.critical.${hashOf('es', 'rest')}.js`)).toBeNull();
    });

    it('rejects anything that is not the exact filename shape', () => {
        const hash = hashOf('es', 'rest');

        for (const file of [
            '',
            'es.js',
            `es.${hash}.js`,
            `es.full.${hash}.js`,
            `es.rest.${hash}`,
            `es.rest.${hash}.mjs`,
            `es.rest.${hash.toUpperCase()}.js`,
            `../es.rest.${hash}.js`,
            `es.rest.${hash}.js/`
        ]) {
            expect(resolveI18nAsset(file), file).toBeNull();
        }
    });
});
