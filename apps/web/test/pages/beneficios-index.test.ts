/**
 * @file beneficios-index.test.ts
 * @description Source-read tests for the benefits page. Mirrors the pattern
 * used by `publicar-experiencia-index.test.ts` and its siblings (Astro
 * components cannot be rendered in Vitest, so wiring is asserted against the
 * source).
 *
 * What these guard, specifically: the page addresses five audiences, and three
 * of them (experience, gastronomy, partner) render copy that LIVES IN ANOTHER
 * PAGE'S NAMESPACE on purpose — `commerce.landing.*` for the two verticals
 * whose landings already publish the same claims, `alliance-leads.partner.*`
 * for the ally sentences. Two distinct regressions are possible there and
 * neither is caught by an existing guard:
 *
 *  1. A section is dropped. `check:i18n-keys` only proves that every key a
 *     file references resolves — delete the whole partner block and its keys
 *     stop being referenced, so that guard stays green.
 *  2. Someone "fixes" the indirection by pasting the sentences inline. The
 *     copy then silently forks from the landing it was meant to track.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/beneficios/index.astro'),
    'utf8'
);

const LOCALES = ['es', 'en', 'pt'] as const;

const readLocale = (locale: string, namespace: string): Record<string, unknown> =>
    JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/${namespace}.json`),
            'utf8'
        )
    );

/** Walk a dotted path, minus its leading namespace segment. */
const lookup = (tree: Record<string, unknown>, dottedPath: string): unknown =>
    dottedPath
        .split('.')
        .slice(1)
        .reduce<unknown>(
            (node, key) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[key]
                    : undefined,
            tree
        );

describe('beneficios/index.astro — the five audience sections', () => {
    // `class="benefits-section benefits-section--x"` appears only in the
    // markup. Matching the bare modifier would also hit the <style> block, so
    // deleting a section would leave its CSS behind and keep the test green.
    it.each([
        'tourist',
        'owner',
        'experience',
        'gastronomy',
        'partner'
    ])('renders the %s section', (variant) => {
        expect(src).toContain(`class="benefits-section benefits-section--${variant}`);
    });

    it("gives every section a CTA pointing at that audience's own page", () => {
        // HOS-985 retired `/suscriptores/propietarios/`; the owner section now
        // points at the sales page that replaced it. HOS-1032 retired
        // `/publicar-experiencia/` and `/publicar-restaurante/` the same way —
        // both are now 301s (see `test/pages/publicar-experiencia-index.test.ts`
        // / `publicar-restaurante-index.test.ts`) — so the gastronomy and
        // experience sections were repointed at their own sales pages directly,
        // rather than at a URL that immediately forwards them there.
        expect(src).toContain("path: 'planes/anfitriones'");
        expect(src).toContain("path: 'planes/experiencias'");
        expect(src).toContain("path: 'planes/gastronomia'");
        expect(src).toContain("path: 'sumate/partner'");
    });
});

describe('beneficios/index.astro — copy stays single-sourced', () => {
    const REUSED_KEYS = [
        'commerce.landing.experience.benefits.title',
        'commerce.landing.experience.benefits.item1.title',
        'commerce.landing.experience.benefits.item1.desc',
        'commerce.landing.experience.benefits.item2.title',
        'commerce.landing.experience.benefits.item2.desc',
        'commerce.landing.experience.benefits.item3.title',
        'commerce.landing.experience.benefits.item3.desc',
        'commerce.landing.gastronomy.benefits.title',
        'commerce.landing.gastronomy.benefits.item1.title',
        'commerce.landing.gastronomy.benefits.item1.desc',
        'commerce.landing.gastronomy.benefits.item2.title',
        'commerce.landing.gastronomy.benefits.item2.desc',
        'commerce.landing.gastronomy.benefits.item3.title',
        'commerce.landing.gastronomy.benefits.item3.desc',
        // `item1` retired by HOS-1228 (HOS-941 D-13): it promised access to a
        // network of verified stays and businesses, which nothing implements.
        // The survivors keep their original numbers — they pair with
        // `benefits.partner.N.title` by array position, not by suffix.
        'alliance-leads.partner.benefits.item2',
        'alliance-leads.partner.benefits.item3',
        'alliance-leads.partner.benefits.item4'
    ] as const;

    it.each(REUSED_KEYS)('reads %s from the owning namespace', (key) => {
        expect(src).toContain(key);
    });

    it.each(LOCALES)('resolves every reused key in %s', (locale) => {
        const trees = {
            commerce: readLocale(locale, 'commerce'),
            'alliance-leads': readLocale(locale, 'alliance-leads')
        };
        for (const key of REUSED_KEYS) {
            const namespace = key.startsWith('commerce.') ? 'commerce' : 'alliance-leads';
            const value = lookup(trees[namespace], key);
            expect(typeof value, `${locale}: ${key}`).toBe('string');
            expect((value as string).length, `${locale}: ${key} is empty`).toBeGreaterThan(0);
        }
    });

    it('does not inline the sentences it is supposed to be tracking', () => {
        // One distinctive fragment per source namespace. If either landing's
        // copy gets pasted in here, the indirection above is decorative.
        expect(src).not.toContain('Aparecé donde miles de viajeros');
        expect(src).not.toContain('Acceso a una red de alojamientos');
    });

    it.each(LOCALES)('does not promise a verified partner network in %s (HOS-1228)', (locale) => {
        // The claim HOS-941 D-13 retired, checked in the LOCALE FILES rather
        // than in this page's source — it lived in three keys across two
        // namespaces, and the surviving danger is a translator or a future
        // author putting one of them back.
        //
        // Substrings, not whole sentences: the point is the CLAIM, and the
        // wording varied between the two copies that carried it ("Acceso a una
        // red…" vs "Acceso a la red…"). An exact-sentence assertion would pass
        // on the third rewording of the same promise.
        const needles: Readonly<Record<string, readonly string[]>> = {
            es: ['red de alojamientos y comercios verificados', 'Red verificada'],
            en: ['network of verified', 'Verified network'],
            pt: ['rede de hospedagens e comércios verificados', 'Rede verificada']
        };

        const haystack = [
            JSON.stringify(readLocale(locale, 'alliance-leads')),
            JSON.stringify(readLocale(locale, 'benefits')),
            JSON.stringify(readLocale(locale, 'pricing'))
        ].join('\n');

        for (const needle of needles[locale] ?? []) {
            expect(haystack, `${locale}: "${needle}" is back`).not.toContain(needle);
        }
    });

    it('is checking locales that actually exist', () => {
        // Guards the guard: a `readLocale` that silently returned `{}` would
        // make every assertion above vacuously true.
        expect(JSON.stringify(readLocale('es', 'pricing'))).toContain(
            'Condiciones comerciales a medida'
        );
    });
});

describe('beneficios/index.astro — section chrome lives in benefits.*', () => {
    const CHROME_KEYS = [
        'benefits.experience.tagline',
        'benefits.experience.cta',
        'benefits.gastronomy.tagline',
        'benefits.gastronomy.cta',
        'benefits.partner.tagline',
        'benefits.partner.title',
        'benefits.partner.cta',
        // `1.title` ("Red verificada") retired with its sentence — same claim,
        // said short. See the note in REUSED_KEYS above.
        'benefits.partner.2.title',
        'benefits.partner.3.title',
        'benefits.partner.4.title'
    ] as const;

    it.each(CHROME_KEYS)('references %s', (key) => {
        expect(src).toContain(key);
    });

    it.each(LOCALES)('defines every chrome key in %s', (locale) => {
        const tree = readLocale(locale, 'benefits');
        for (const key of CHROME_KEYS) {
            const value = lookup(tree, key);
            expect(typeof value, `${locale}: ${key}`).toBe('string');
            expect((value as string).length, `${locale}: ${key} is empty`).toBeGreaterThan(0);
        }
    });
});
