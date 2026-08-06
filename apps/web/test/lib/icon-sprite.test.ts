/**
 * @file icon-sprite.test.ts
 * @description Unit tests for the hashed, immutable icon-sprite builder
 * (HOS-369 W3-6).
 *
 * The sprite is built for real here — no mocking. Its whole job is to contain
 * the glyphs `@repo/icons` can render, so a fixture would test the assembly and
 * nothing about the enumeration, which is the half that can silently ship an
 * incomplete sprite and leave icons rendering as empty boxes.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import * as iconExports from '@repo/icons';
import {
    expandSpriteSymbolEntry,
    getIconSpriteBase,
    hasIconSpriteSymbol,
    iconSymbolId,
    SPRITE_WEIGHTS,
    setIconSpriteBase,
    setIconSpriteSymbols
} from '@repo/icons';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getIconSpriteBody,
    getIconSpriteGlyphCount,
    ICON_SPRITE_EXTENSION,
    ICON_SPRITE_PATH_PREFIX,
    iconSpriteClientScript,
    iconSpriteUrl,
    initIconSprite,
    isCurrentIconSpriteFile
} from '@/lib/icon-sprite';
import iconSpriteManifest from '@/lib/icon-sprite-manifest.json';

/** The 8 hex chars embedded in the current sprite URL. */
function currentHash(): string {
    return iconSpriteUrl().slice('/icons/sprite.'.length, -'.svg'.length);
}

/** Every `<symbol id>` the generated sprite declares. */
function symbolIds(): ReadonlyArray<string> {
    return [...getIconSpriteBody().matchAll(/<symbol id="([^"]+)"/g)].map(
        (match) => match[1] ?? ''
    );
}

/**
 * Every (glyph, weight) pair the committed manifest lists, decoded straight
 * off the JSON file — independent of {@link getIconSpriteBody}, so a test
 * built from this cannot pass just because the generator and the assertion
 * share the same (possibly buggy) derivation.
 */
function manifestPairIds(): ReadonlyArray<string> {
    return Object.entries(iconSpriteManifest as Record<string, string>).flatMap(
        ([name, initials]) =>
            expandSpriteSymbolEntry({ entry: `${name}:${initials}` }).map((pair) =>
                iconSymbolId(pair)
            )
    );
}

/** How many total (glyph, weight) pairs the committed manifest lists. */
function expectedManifestPairCount(): number {
    return manifestPairIds().length;
}

describe('iconSpriteUrl', () => {
    it('has the content-addressed shape /icons/sprite.<8 hex>.svg', () => {
        expect(iconSpriteUrl()).toMatch(/^\/icons\/sprite\.[0-9a-f]{8}\.svg$/);
    });

    it('is stable across calls — the hash is computed once, not per call', () => {
        expect(iconSpriteUrl()).toBe(iconSpriteUrl());
    });

    it('is built from the exported prefix and extension, so the route cannot drift', () => {
        // `/icons/`, never `/_icons/`: Astro drops every `src/pages/_*` path
        // from the route manifest, so an underscored directory would serve
        // nothing. The extension is shared with the endpoint, which has to
        // re-append it to the param Astro strips it from.
        expect(ICON_SPRITE_PATH_PREFIX).toBe('/icons/');
        expect(ICON_SPRITE_EXTENSION).toBe('.svg');
        expect(iconSpriteUrl().startsWith(ICON_SPRITE_PATH_PREFIX)).toBe(true);
        expect(iconSpriteUrl().endsWith(ICON_SPRITE_EXTENSION)).toBe(true);
    });

    it('names the exact bytes the body getter returns', () => {
        // Recomputed with an independent call to node:crypto: this is what makes
        // it impossible for the endpoint to serve one sprite under a hash that
        // describes another.
        const hash = createHash('sha256')
            .update(getIconSpriteBody(), 'utf8')
            .digest('hex')
            .slice(0, 8);

        expect(iconSpriteUrl()).toBe(`/icons/sprite.${hash}.svg`);
    });
});

describe('getIconSpriteBody', () => {
    it('is an SVG document with the xmlns an external <use> target needs', () => {
        // Not decoration: the sprite is fetched as a standalone document, not
        // parsed as inline HTML, so without the namespace the browser does not
        // treat it as SVG and every `<use>` resolves to nothing.
        expect(getIconSpriteBody().startsWith('<svg xmlns="http://www.w3.org/2000/svg">')).toBe(
            true
        );
        expect(getIconSpriteBody().endsWith('</svg>')).toBe(true);
    });

    it('carries one <symbol> per (glyph, weight) pair the committed manifest lists', () => {
        // HOS-369 sprite-manifest: the sprite is a SUBSET, not the full
        // cartesian product — a glyph can list one weight and another four.
        // The manifest itself is the independent source of truth here (read
        // straight off disk, not through the generator under test), so this
        // catches the generator silently drifting from what it was told to build.
        expect(getIconSpriteGlyphCount()).toBeGreaterThan(50);
        expect(symbolIds().length).toBe(expectedManifestPairCount());
    });

    it('gives every symbol a unique id', () => {
        // A collision is the worst failure mode available here: it does not
        // throw, it renders the WRONG icon, and only for whichever glyph lost.
        const ids = symbolIds();

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('ships every weight in SPRITE_WEIGHTS, and only those', () => {
        const weights = new Set(symbolIds().map((id) => id.slice(id.lastIndexOf('-') + 1)));

        expect([...weights].sort()).toEqual([...SPRITE_WEIGHTS].sort());
    });

    it('ships a distinct body for each weight of the same glyph', () => {
        // A generator that built the right IDS but rendered every symbol at one
        // weight would still produce well-formed symbols — all drawing the same
        // shape, and all but one of them wrong. So this compares the symbols'
        // CHILDREN; the opening tag is excluded precisely because its `id`
        // differs per weight and would make distinct-id symbols look distinct
        // regardless. Picks whichever manifest glyph lists the MOST weights,
        // rather than assuming a specific glyph (e.g. `StarIcon`) still has all
        // four — under subsetting a glyph legitimately ships only the weights
        // `apps/web` actually renders it at.
        const [multiWeightName, multiWeightInitials] = Object.entries(
            iconSpriteManifest as Record<string, string>
        ).reduce((best, entry) => (entry[1].length > best[1].length ? entry : best));
        const weights = expandSpriteSymbolEntry({
            entry: `${multiWeightName}:${multiWeightInitials}`
        }).map((pair) => pair.weight);
        expect(weights.length, 'no manifest glyph ships more than one weight').toBeGreaterThan(1);

        const bodies = weights.map((weight) => {
            const id = iconSymbolId({ name: multiWeightName, weight });
            const start = getIconSpriteBody().indexOf(`<symbol id="${id}"`);
            expect(start, `${id} is missing from the sprite`).toBeGreaterThan(-1);
            return getIconSpriteBody().slice(
                getIconSpriteBody().indexOf('>', start) + 1,
                getIconSpriteBody().indexOf('</symbol>', start)
            );
        });

        expect(
            new Set(bodies).size,
            'two shipped weights of the same glyph render identical artwork — the weight prop is not reaching the renderer'
        ).toBe(weights.length);
    });

    it('gives each symbol a viewBox, since the <use> host has none', () => {
        // The page's wrapper `<svg>` only sets width/height. Without a viewBox on
        // the symbol, the 256-unit artwork would be drawn at 256px inside a 24px
        // box and every icon would render as a cropped fragment.
        expect(symbolIds().length).toBe(
            [...getIconSpriteBody().matchAll(/<symbol id="[^"]+" viewBox="[^"]+">/g)].length
        );
    });

    it('leaves `fill` off the symbols so the host <svg> can inherit into them', () => {
        // `fill` is inherited, and inherited properties cross into the `<use>`
        // shadow tree — that is the entire reason `currentColor` still works.
        // A `fill` baked into a symbol would win and freeze that icon's color.
        const duotone = getIconSpriteBody().slice(
            getIconSpriteBody().indexOf('<symbol id="StarIcon-duotone"')
        );
        const symbol = duotone.slice(0, duotone.indexOf('</symbol>'));

        expect(symbol).not.toContain('fill=');
        // Non-vacuity: the duotone secondary layer IS there, so the assertion
        // above was made against real glyph markup and not an empty symbol.
        expect(symbol).toContain('opacity="0.2"');
    });

    it('carries a <symbol> for every pair the committed manifest lists', () => {
        // HOS-369 sprite-manifest: the generator no longer has to cover every
        // Phosphor icon the package exports (that was the pre-subsetting
        // invariant) — it has to cover exactly what the MANIFEST lists. A
        // manifest entry with no matching symbol is the one failure mode the
        // wrapper's `hasIconSpriteSymbol` membership check cannot save: the
        // wrapper would believe the pair is safe to reference and emit a
        // `<use>` at a `<symbol>` that was never rendered.
        const ids = new Set(symbolIds());
        const missing = manifestPairIds().filter((id) => !ids.has(id));

        expect(missing).toEqual([]);
    });
});

describe('isCurrentIconSpriteFile', () => {
    it('accepts the filename this deployment currently serves', () => {
        expect(isCurrentIconSpriteFile(iconSpriteUrl().replace('/icons/', ''))).toBe(true);
    });

    it('rejects a stale hash', () => {
        // The whole reason the endpoint 404s instead of serving fresh content:
        // the response is `immutable` for a year, so answering a stale URL would
        // pin the wrong sprite in every cache that asked — and the pages holding
        // that URL reference symbol ids it may not contain.
        expect(isCurrentIconSpriteFile('sprite.deadbeef.svg')).toBe(false);
    });

    it('rejects anything that is not the exact filename shape', () => {
        const hash = currentHash();

        for (const file of [
            '',
            'sprite.svg',
            `sprite.${hash}`,
            `sprite.${hash}.svgz`,
            `sprite.${hash.toUpperCase()}.svg`,
            `icons.${hash}.svg`,
            `../sprite.${hash}.svg`,
            `sprite.${hash}.svg/`
        ]) {
            expect(isCurrentIconSpriteFile(file), file).toBe(false);
        }
    });
});

describe('initIconSprite', () => {
    afterEach(() => {
        // Module-level singletons in @repo/icons — leaving either on would
        // change what every later icon render in this worker emits.
        setIconSpriteBase(null);
        setIconSpriteSymbols({ symbols: null });
    });

    it('points @repo/icons at the sprite this process serves', () => {
        initIconSprite();

        expect(getIconSpriteBase()).toBe(iconSpriteUrl());
    });

    it('publishes the real committed manifest, in step with the base', () => {
        // HOS-369 sprite-manifest: `initIconSprite` no longer resets to the
        // permissive `null` default — it publishes the SAME manifest the
        // sprite was built from, so the server-rendered `<use>` references
        // and `hasIconSpriteSymbol`'s verdict about them can never disagree.
        // Proven with a pair that is NOT in the manifest, not one that is:
        // asserting `true` on a real pair would also pass with the OLD
        // permissive-`null` behaviour this replaces, which is exactly the
        // regression this test exists to catch.
        setIconSpriteSymbols({ symbols: null });

        initIconSprite();

        expect(hasIconSpriteSymbol({ symbol: 'DefinitelyNotAGlyph-regular' })).toBe(false);
    });

    it('is called at module scope by the SSR entry, not from a page', () => {
        // Sprite mode is a singleton: flipped mid-render, every icon already
        // emitted in that tree stays inline and the document ships both forms.
        // Middleware is part of the SSR entry chunk, so its module scope is the
        // one place that runs once, before the listener accepts traffic.
        const middleware = readFileSync(resolve(__dirname, '../../src/middleware.ts'), 'utf8');

        expect(middleware).toContain("import { initIconSprite } from './lib/icon-sprite'");
        expect(middleware).toMatch(/^\s{4}initIconSprite\(\);$/m);
        // Inside the handler it would run per request and, worse, after the
        // first page had already begun rendering.
        expect(middleware.slice(middleware.indexOf('export const onRequest'))).not.toContain(
            'initIconSprite('
        );
    });
});

describe('iconSpriteClientScript', () => {
    it('assigns the URL global, with the current URL', () => {
        // Isolates the URL-only half of the output — passing `symbols: null`
        // explicitly suppresses the (now real, non-empty) manifest assignment
        // this function publishes by default. See the "publishes the real
        // committed manifest by default" test below for that half.
        expect(iconSpriteClientScript({ symbols: null })).toBe(
            `window.${iconExports.ICON_SPRITE_GLOBAL}="${iconSpriteUrl()}";`
        );
    });

    it('is a plain assignment — the reader is synchronous', () => {
        // Islands ask for the base while they render. Anything asynchronous here
        // would hand the first island `null` and it would re-inline every glyph.
        expect(iconSpriteClientScript()).not.toMatch(/fetch|import|addEventListener/);
    });

    it('publishes the real committed manifest by default (HOS-369 sprite-manifest)', () => {
        // The call site (`IconSpriteClientData.astro`) passes nothing, so this
        // IS what every page actually emits — not a groundwork stand-in.
        const withDefault = iconSpriteClientScript();
        const urlOnly = iconSpriteClientScript({ symbols: null });

        expect(withDefault).not.toBe(urlOnly);
        expect(withDefault.startsWith(urlOnly)).toBe(true);
        expect(withDefault).toContain(iconExports.ICON_SPRITE_SYMBOLS_GLOBAL);
        // Round-trips to exactly the committed manifest's compact entries —
        // proves the default is THE manifest, not some other non-empty value.
        const published = JSON.parse(
            withDefault
                .slice(withDefault.indexOf(`window.${iconExports.ICON_SPRITE_SYMBOLS_GLOBAL}=`))
                .split('=')
                .slice(1)
                .join('=')
                .replace(/;$/, '')
        );
        expect(published).toEqual(
            Object.entries(iconSpriteManifest as Record<string, string>).map(
                ([name, initials]) => `${name}:${initials}`
            )
        );
    });

    it('keeps the published manifest small enough to be worth publishing on every page', () => {
        // The whole point of the compact "name:initials" shape over a full
        // "Name-weight" array is a small per-page cost. Brotli, not raw bytes,
        // is what actually crosses the wire (HTML responses are compressed) —
        // budgeted at ~3 KB brotli; well past that, the once-per-session
        // sprite-byte savings would no longer be worth the per-page tax.
        const withDefault = iconSpriteClientScript();
        const symbolsAssignment = withDefault.slice(
            withDefault.indexOf(`window.${iconExports.ICON_SPRITE_SYMBOLS_GLOBAL}=`)
        );

        const brotliBytes = brotliCompressSync(symbolsAssignment).length;

        expect(brotliBytes).toBeGreaterThan(0);
        expect(brotliBytes).toBeLessThan(3 * 1024);
    });

    it('extends to publish an arbitrary manifest when one is supplied', () => {
        const symbols = ['StarIcon-duotone', 'HomeIcon-fill'];

        const script = iconSpriteClientScript({ symbols });
        const urlOnly = iconSpriteClientScript({ symbols: null });

        expect(script.startsWith(urlOnly)).toBe(true);
        expect(script).toBe(
            `${urlOnly}window.${iconExports.ICON_SPRITE_SYMBOLS_GLOBAL}=${JSON.stringify(symbols)};`
        );
    });
});
