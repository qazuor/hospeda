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
import * as iconExports from '@repo/icons';
import {
    getIconSpriteBase,
    getIconSpriteName,
    iconSymbolId,
    SPRITE_WEIGHTS,
    setIconSpriteBase
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

    it('carries one <symbol> per glyph per shipped weight', () => {
        expect(getIconSpriteGlyphCount()).toBeGreaterThan(200);
        expect(symbolIds().length).toBe(getIconSpriteGlyphCount() * SPRITE_WEIGHTS.length);
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
        // weight would still produce four well-formed symbols — all drawing the
        // same shape, and three of them wrong. So this compares the symbols'
        // CHILDREN; the opening tag is excluded precisely because its `id`
        // differs per weight and would make any four symbols look distinct.
        const bodies = SPRITE_WEIGHTS.map((weight) => {
            const id = iconSymbolId({ name: 'StarIcon', weight });
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
        ).toBe(SPRITE_WEIGHTS.length);
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

    it('covers every Phosphor icon the package exports', () => {
        // The wrapper's sprite branch has NO membership test — once a base URL
        // is set it emits a `<use>` for any icon. So the sprite must be a
        // superset of what the app can render; an icon exported but not
        // enumerated renders as nothing, silently.
        const ids = new Set(symbolIds());
        const missing = Object.values(iconExports as Record<string, unknown>)
            .map((value) => getIconSpriteName(value))
            .filter((name): name is string => name !== null)
            .filter((name) => !ids.has(iconSymbolId({ name, weight: 'regular' })));

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
        // Module-level singleton in @repo/icons — leaving it on would change
        // what every later icon render in this worker emits.
        setIconSpriteBase(null);
    });

    it('points @repo/icons at the sprite this process serves', () => {
        initIconSprite();

        expect(getIconSpriteBase()).toBe(iconSpriteUrl());
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
    it('assigns the global @repo/icons reads, with the current URL', () => {
        expect(iconSpriteClientScript()).toBe(
            `window.${iconExports.ICON_SPRITE_GLOBAL}="${iconSpriteUrl()}";`
        );
    });

    it('is a plain assignment — the reader is synchronous', () => {
        // Islands ask for the base while they render. Anything asynchronous here
        // would hand the first island `null` and it would re-inline every glyph.
        expect(iconSpriteClientScript()).not.toMatch(/fetch|import|addEventListener/);
    });
});
