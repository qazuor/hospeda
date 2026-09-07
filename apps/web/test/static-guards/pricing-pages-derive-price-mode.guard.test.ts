/**
 * @file pricing-pages-derive-price-mode.guard.test.ts
 * @description Static guard (HOS-1212): no `/planes/<audiencia>/precios/` page
 * may decide for itself whether it prints an amount.
 *
 * ## The incident this holds
 *
 * `/planes/aliados/precios/` passed the literal `priceMode="consult"`. That was
 * correct — aliados is quoted in a conversation and publishes no figure — but a
 * literal on one page is invisible to every other surface. The plan INDEX at
 * `/suscriptores/planes/` therefore went on advertising "Desde $ 15.000 /mes"
 * on its aliados card, read correctly from `billing_plans` where
 * `partner-silver` really does sit at ARS 15.000, and sent the visitor who
 * clicked BECAUSE of that number to a page telling them to ask. Measured on
 * staging 2026-09-07 (`d81df29cf`): the index printed the amount, and neither
 * `/planes/aliados/` nor `/planes/aliados/precios/` contained a single `$`.
 *
 * That is HOS-985's AC-43 — "ninguna tarjeta del índice promete algo que su
 * destino no entregue" — failing in the most literal way available, and no
 * reader of any one of the three files could have seen it.
 *
 * ## What is checked, and why it is these two things
 *
 * 1. **Every pricing page passes `priceMode`**, derived from
 *    `resolvePricingPageContent`. Four of the five used to omit the prop and
 *    live off the component's `'amount'` default. That default is right today
 *    and it is a fail-OPEN: an audience added to `PRICE_ON_REQUEST_AUDIENCES`
 *    would be withheld on the index and still printed here, which is the same
 *    contradiction pointing the other way.
 * 2. **No page passes a literal.** `priceMode="consult"` and
 *    `priceMode="amount"` are both rejected — the second just as firmly, since a
 *    page hardcoding `'amount'` is a page that has opted out of the predicate
 *    and will keep printing a figure after the decision changes.
 *
 * The regex is anchored on the prop NAME rather than on the component's, so
 * renaming `AudiencePricingSections` does not silently retire this guard. The
 * page list is discovered from the filesystem and its size asserted, so a sixth
 * audience's page is covered the day it lands instead of the day someone
 * remembers to add it here.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(__dirname, '../..');
const PLANES_DIR = 'src/pages/[lang]/planes';

/**
 * Every `/planes/<audiencia>/precios/` page, discovered rather than listed.
 *
 * Read off the directory instead of glob-matched: `[lang]` is a literal
 * directory name whose brackets are glob syntax, and the escaping that needs is
 * exactly the kind of detail that silently matches nothing.
 */
const PRICING_PAGES = readdirSync(resolve(WEB_ROOT, PLANES_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${PLANES_DIR}/${entry.name}/precios/index.astro`)
    .filter((page) => existsSync(resolve(WEB_ROOT, page)))
    .sort();

/**
 * `priceMode` handed a string literal, in any spelling a human would write.
 *
 * The braces are OPTIONAL in this pattern and that is the whole point: an
 * earlier version required a quote immediately after the `=`, so it rejected
 * `priceMode="consult"` and waved through `priceMode={'consult'}` and
 * `priceMode={`consult`}` — the same hardcoding, one brace away. A guard that
 * forbids one syntactic form and accepts its variants is a guard whose next
 * violation is written by autocomplete.
 */
const LITERAL_PRICE_MODE = /priceMode\s*=\s*\{?\s*['"`]/;

/** `priceMode` passed as an expression — the only accepted form. */
const DERIVED_PRICE_MODE = /priceMode\s*=\s*\{/;

/**
 * The destructuring that binds `priceMode`, whatever order its keys are in.
 *
 * Captures the whole brace group instead of anchoring on `priceMode }` — that
 * anchor demanded `priceMode` be the LAST key, so adding a sixth field to
 * `PricingPageContent`, or simply reordering, would have failed the guard on
 * five correct pages. A guard that breaks under a legitimate refactor gets
 * loosened rather than obeyed.
 */
const RESOLVER_DESTRUCTURING = /const\s*\{([^}]*)\}\s*=\s*resolvePricingPageContent\s*\(/;

/** The keys a page destructures off `resolvePricingPageContent`, in any order. */
const destructuredKeys = (src: string): readonly string[] =>
    (RESOLVER_DESTRUCTURING.exec(src)?.[1] ?? '')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);

/**
 * Drop block comments before matching.
 *
 * Not a nicety: the aliados page's own docblock explains this guard by QUOTING
 * the literal it forbids ("it used to be `priceMode=\"consult\"` written here"),
 * and Astro's `{/* … *\/}` template comments can carry the same. A guard that
 * reads the whole file cannot tell a rendered prop from prose about one, and the
 * first version of this file failed on its own documentation — which is the
 * cheap version of the expensive failure: banning the string would have pushed
 * the explanation out of the file that most needs it.
 *
 * Block comments only. Line comments are left alone deliberately — stripping
 * `//` would have to reason about `https://`, and no line comment can carry a
 * JSX prop.
 */
const stripBlockComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '');

describe('pricing pages derive their price mode (HOS-1212)', () => {
    it('finds the five audience pricing pages', () => {
        // Guards the guard: a glob that silently matched nothing would make
        // every assertion below vacuously true.
        expect(PRICING_PAGES).toHaveLength(5);
    });

    it.each(PRICING_PAGES)('%s passes priceMode', (page) => {
        const src = stripBlockComments(readFileSync(resolve(WEB_ROOT, page), 'utf8'));

        expect(DERIVED_PRICE_MODE.test(src)).toBe(true);
    });

    it.each(PRICING_PAGES)('%s never hardcodes the mode', (page) => {
        const src = stripBlockComments(readFileSync(resolve(WEB_ROOT, page), 'utf8'));

        expect(LITERAL_PRICE_MODE.test(src)).toBe(false);
    });

    it.each(PRICING_PAGES)('%s takes the mode from resolvePricingPageContent', (page) => {
        const src = stripBlockComments(readFileSync(resolve(WEB_ROOT, page), 'utf8'));

        // The prop being an expression is not enough on its own — a page could
        // compute its own `const priceMode = 'consult'` and satisfy the rule
        // above while still holding a private opinion.
        expect(destructuredKeys(src)).toContain('priceMode');
    });
});

describe('the guard detects the shapes it forbids', () => {
    // Mutation coverage, inline: the patterns are asserted against the exact
    // strings they exist to reject, so a regex broken by an edit fails here
    // rather than passing everything.
    it('rejects a literal in every spelling, braced or bare', () => {
        // The braced three are the ones an earlier version of this guard let
        // through: it required a quote directly after the `=`, so one brace was
        // the whole bypass. Listed explicitly so the escape cannot reopen.
        for (const bypass of [
            'priceMode="consult"',
            "priceMode='amount'",
            'priceMode = "consult"',
            "priceMode={'consult'}",
            'priceMode={"amount"}',
            'priceMode={`consult`}'
        ]) {
            expect(LITERAL_PRICE_MODE.test(bypass)).toBe(true);
        }
    });

    it('accepts a real binding', () => {
        expect(LITERAL_PRICE_MODE.test('priceMode={priceMode}')).toBe(false);
        expect(DERIVED_PRICE_MODE.test('priceMode={priceMode}')).toBe(true);
        expect(DERIVED_PRICE_MODE.test('priceMode="consult"')).toBe(false);
    });

    it('reads the destructured keys in any order', () => {
        // The refactor that used to break this guard on five correct pages: a
        // sixth field, or simply a different order.
        const orders = [
            'const { copyRoot, faqs, hasComparison, priceMode } = resolvePricingPageContent({',
            'const { priceMode, copyRoot, faqs } = resolvePricingPageContent({',
            'const { copyRoot, priceMode, trialDays, faqs } = resolvePricingPageContent({'
        ];
        for (const src of orders) {
            expect(destructuredKeys(src)).toContain('priceMode');
        }

        expect(destructuredKeys('const { copyRoot } = resolvePricingPageContent({')).not.toContain(
            'priceMode'
        );
        expect(destructuredKeys('const { priceMode } = somethingElse({')).toEqual([]);
    });

    it('strips a prop out of prose but leaves a real one standing', () => {
        // Both halves matter. Only stripping would make the guard blind; only
        // matching would make it fail on its own documentation.
        expect(stripBlockComments('/* was priceMode="consult" */\npriceMode={x}')).not.toMatch(
            LITERAL_PRICE_MODE
        );
        expect(stripBlockComments('{/* note */}\npriceMode="consult"')).toMatch(LITERAL_PRICE_MODE);
    });
});
