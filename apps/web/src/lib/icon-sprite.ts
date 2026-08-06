/**
 * @file icon-sprite.ts
 * @description Single source of truth for the hashed, immutable SVG sprite that
 * delivers every Phosphor glyph this app can render (HOS-369 W3-6).
 *
 * Each icon instance used to inline its full `<svg>`: 186,488 B on the home page
 * (30.5% of the HTML) across 369 instances of just 78 distinct shapes, and
 * 354,976 B on a listing page (47.9%) across 520 instances of 139 shapes. Served
 * as ONE content-addressed sprite, each instance costs a ~55-byte `<use>`
 * reference and the shapes are downloaded once per session, then read from the
 * HTTP cache.
 *
 * Sibling of `./i18n-asset.ts`, and deliberately the same shape, because the two
 * safety properties are the same ones:
 *
 *  - The URL and the served content are derived from the SAME string. The
 *    endpoint answers with {@link getIconSpriteBody}, the pages reference
 *    {@link iconSpriteUrl}, and both read one entry built once, so they cannot
 *    desynchronize.
 *  - Rendering ~1,600 glyphs and hashing ~700 KB is paid ONCE at module load,
 *    never per request. The SSR process is long-lived, so this is one cost per
 *    boot.
 *
 * ## What goes in
 *
 * The icon set is enumerated at RUNTIME from `@repo/icons`'s own exports plus
 * its data-driven `ICON_MAP`, not from a list re-derived by scanning source.
 * The wrapper's sprite branch DOES have a membership test now
 * (`hasIconSpriteSymbol`, HOS-369 sprite-subsetting groundwork), but this
 * generator still publishes no manifest (`setIconSpriteSymbols({ symbols:
 * null })` in {@link initIconSprite}), which resolves that check permissively
 * — i.e. still "emit a `<use>` for ANY icon once a base URL is configured".
 * So the sprite still has to be a SUPERSET of what the app can render, and
 * "everything the package exports" is still the only enumeration that stays a
 * superset when someone adds an icon. A LATER change will start publishing a
 * real manifest and subsetting this generator's output to match; until then
 * this file's job does not change.
 *
 * Glyphs are keyed by the Phosphor component's own `displayName`, so the ~480
 * wrappers (many of which are semantic aliases of the same glyph) collapse onto
 * the distinct shapes they actually draw.
 *
 * Server-only by construction: it renders React to markup and hashes with
 * `node:crypto`. Nothing in the client bundle may import it — the browser gets
 * only the URL, via the global `IconSpriteClientData.astro` assigns.
 *
 * @module lib/icon-sprite
 */

import { createHash } from 'node:crypto';
import type { PhosphorGlyphComponent, SpriteWeight } from '@repo/icons';
import * as iconExports from '@repo/icons';
import {
    getIconSpriteGlyph,
    getIconSpriteName,
    ICON_SPRITE_GLOBAL,
    ICON_SPRITE_SYMBOLS_GLOBAL,
    iconSymbolId,
    SPRITE_WEIGHTS,
    setIconSpriteBase,
    setIconSpriteSymbols
} from '@repo/icons';
import { ICON_MAP } from '@repo/icons/resolver';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * URL path prefix the sprite is served under.
 *
 * NOT `/_icons/`: Astro excludes every `src/pages/_*` path from routing, so an
 * underscored directory would never produce a route at all.
 */
export const ICON_SPRITE_PATH_PREFIX = '/icons/';

/**
 * Extension the sprite filename ends in.
 *
 * Exported because the route that serves it is `src/pages/icons/[file].svg.ts`
 * — Astro strips that `.svg` route suffix before filling `params.file`, so the
 * endpoint has to put it back before calling {@link isCurrentIconSpriteFile}.
 * Sharing the constant keeps the two halves of that filename from drifting.
 */
export const ICON_SPRITE_EXTENSION = '.svg';

/** Stem of the sprite filename, before the content hash. */
const SPRITE_STEM = 'sprite';

/** Length of the content hash embedded in the filename. */
const HASH_LENGTH = 8;

/**
 * The only filename shape the endpoint accepts: `sprite.<8 lowercase hex>.svg`.
 * Anchored, so nothing else can reach the hash comparison.
 */
const SPRITE_FILE_PATTERN = new RegExp(`^${SPRITE_STEM}\\.([0-9a-f]{${HASH_LENGTH}})\\.svg$`);

/** How deep {@link collectSpriteGlyphs} walks into exported containers. */
const MAX_WALK_DEPTH = 4;

/** The sprite document: the exact bytes served, and the hash that names them. */
interface IconSpriteEntry {
    /** The SVG document served for this deployment. */
    readonly body: string;
    /** First {@link HASH_LENGTH} hex chars of `sha256(body)`. */
    readonly hash: string;
    /** How many distinct glyphs it carries (one symbol per glyph per weight). */
    readonly glyphCount: number;
}

/**
 * Walks an exported value and collects every Phosphor GLYPH it reaches, keyed by
 * sprite name.
 *
 * Generic rather than a hand-listed set of tables: `@repo/icons` exports icons
 * directly (`StarIcon`), and also inside domain visual maps
 * (`AMENITY_TYPE_VISUALS[x].icon`, `POI_CATEGORY_VISUALS`, …). Walking every
 * export means a NEW domain table needs no change here — the alternative,
 * naming each table, fails silently by omission the day one is added.
 *
 * Recursion stops at any marked wrapper (they are functions, nothing useful is
 * nested inside) and at {@link MAX_WALK_DEPTH}.
 *
 * @param params.value - The value to inspect.
 * @param params.into - Accumulator, keyed by sprite name.
 * @param params.depth - Current recursion depth.
 */
function collectSpriteGlyphs({
    value,
    into,
    depth = 0
}: {
    readonly value: unknown;
    readonly into: Map<string, PhosphorGlyphComponent>;
    readonly depth?: number;
}): void {
    if (value === null || value === undefined || depth > MAX_WALK_DEPTH) return;

    const name = getIconSpriteName(value);
    if (name !== null) {
        const glyph = getIconSpriteGlyph(value);
        if (glyph !== null && !into.has(name)) into.set(name, glyph);
        return;
    }

    if (typeof value !== 'object') return;
    for (const nested of Object.values(value as Record<string, unknown>)) {
        collectSpriteGlyphs({ value: nested, into, depth: depth + 1 });
    }
}

/**
 * Every distinct glyph reachable from `@repo/icons`, keyed by sprite name.
 *
 * Both roots matter: the barrel covers direct JSX usage and the domain visual
 * tables, and `ICON_MAP` covers the data-driven resolver, whose entries are
 * imported from icon modules directly and are not all re-exported by the barrel.
 *
 * Many wrappers are semantic aliases of one Phosphor glyph, so this map is much
 * smaller than the export count — and the sprite carries each shape once.
 *
 * @returns The glyph map.
 */
function collectGlyphSet(): Map<string, PhosphorGlyphComponent> {
    const glyphs = new Map<string, PhosphorGlyphComponent>();
    collectSpriteGlyphs({ value: iconExports, into: glyphs });
    collectSpriteGlyphs({ value: ICON_MAP, into: glyphs });
    return glyphs;
}

/**
 * Renders one glyph at one weight and returns ONLY the `<svg>`'s children.
 *
 * The RAW Phosphor component is rendered, never the `@repo/icons` wrapper. The
 * wrapper consults sprite mode, so once a base URL is configured it would emit
 * `<use>` references INTO the sprite being built — an empty, self-referential
 * document — and the generator would have to defend itself by toggling a global
 * singleton mid-build.
 *
 * The outer element's attributes (`width`, `height`, `fill`, `class`,
 * `aria-label`) belong to the page's `<use>` wrapper, which sets them per
 * instance. Duplicating them into the symbol would both waste sprite bytes and
 * pin `fill` inside the shadow tree, defeating `currentColor`.
 *
 * @param params.glyph - The Phosphor component to render.
 * @param params.weight - Weight to render it at.
 * @returns The glyph's markup and its `viewBox`.
 * @throws When it does not render a single `<svg>` root, or renders one without
 *   a `viewBox`. A silent skip would ship a sprite missing a symbol the pages
 *   already reference, which renders as nothing at all.
 */
function renderGlyph({
    glyph,
    weight
}: {
    readonly glyph: PhosphorGlyphComponent;
    readonly weight: SpriteWeight;
}): { readonly children: string; readonly viewBox: string } {
    const html = renderToStaticMarkup(createElement(glyph, { weight }));

    const openEnd = html.indexOf('>');
    if (!html.startsWith('<svg') || openEnd === -1 || !html.endsWith('</svg>')) {
        throw new Error(
            `[icon-sprite] unexpected markup for a ${weight} glyph: ${html.slice(0, 80)}`
        );
    }

    const viewBox = /viewBox="([^"]+)"/.exec(html.slice(0, openEnd))?.[1];
    if (viewBox === undefined) {
        throw new Error('[icon-sprite] rendered glyph has no viewBox to give its symbol');
    }

    return { children: html.slice(openEnd + 1, html.length - '</svg>'.length), viewBox };
}

/**
 * Builds the sprite document: one `<symbol>` per glyph per shipped weight.
 *
 * @returns The SVG source and the glyph count behind it.
 */
function buildBody(): { readonly body: string; readonly glyphCount: number } {
    const glyphs = collectGlyphSet();
    const symbols: string[] = [];

    // Sorted by name so the document — and therefore the hash — depends only on
    // WHICH glyphs are in it, not on module evaluation order.
    for (const [name, glyph] of [...glyphs].sort(([a], [b]) => (a < b ? -1 : 1))) {
        for (const weight of SPRITE_WEIGHTS) {
            const { children, viewBox } = renderGlyph({ glyph, weight });
            symbols.push(
                `<symbol id="${iconSymbolId({ name, weight })}" viewBox="${viewBox}">${children}</symbol>`
            );
        }
    }

    return {
        body: `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`,
        glyphCount: glyphs.size
    };
}

/**
 * The sprite and its hash, built ONCE at module load.
 *
 * Rendering ~1,600 glyphs is not something a request may pay for: the endpoint
 * would redo it on every hit and every page render would redo it to learn the
 * URL. The SSR process is long-lived, so this is one cost per boot.
 */
const SPRITE: IconSpriteEntry = (() => {
    const { body, glyphCount } = buildBody();
    return {
        body,
        hash: createHash('sha256').update(body, 'utf8').digest('hex').slice(0, HASH_LENGTH),
        glyphCount
    };
})();

/**
 * The immutable, content-addressed URL of the icon sprite.
 *
 * @returns A path of the form `/icons/sprite.<8 hex>.svg`.
 *
 * @example
 * ```ts
 * iconSpriteUrl(); // "/icons/sprite.9f3a1c07.svg"
 * ```
 */
export function iconSpriteUrl(): string {
    return `${ICON_SPRITE_PATH_PREFIX}${SPRITE_STEM}.${SPRITE.hash}${ICON_SPRITE_EXTENSION}`;
}

/**
 * The exact SVG document served for the sprite.
 *
 * @returns The `<svg>` source carrying one `<symbol>` per glyph per weight.
 */
export function getIconSpriteBody(): string {
    return SPRITE.body;
}

/**
 * How many distinct glyphs the sprite carries.
 *
 * Exported for the guard tests: a sprite that silently collapsed to a handful of
 * symbols would still serve, hash and 200 correctly.
 *
 * @returns The glyph count.
 */
export function getIconSpriteGlyphCount(): number {
    return SPRITE.glyphCount;
}

/**
 * Whether a requested filename names the sprite this process would serve.
 *
 * The hash check is load-bearing, not defensive tidiness. The response is served
 * `immutable` for a year, so answering a STALE URL with FRESH content would pin
 * the wrong sprite in every browser and CDN that asked for it, with no way to
 * invalidate it — and every icon on those pages would then reference symbol ids
 * that may no longer exist. A URL whose hash no longer matches names content
 * this deployment does not have; the only correct answer is 404.
 *
 * @param file - The requested filename, e.g. `sprite.9f3a1c07.svg`.
 * @returns `true` when the filename is well-formed and current.
 */
export function isCurrentIconSpriteFile(file: string): boolean {
    const match = SPRITE_FILE_PATTERN.exec(file);
    return match !== null && match[1] === SPRITE.hash;
}

/**
 * The inline script that hands the sprite URL — and, once a later change ships
 * a subset sprite, its symbol manifest — to the browser.
 *
 * Client islands render icons too, and they run in a realm where
 * `setIconSpriteBase`/`setIconSpriteSymbols` were never called. `@repo/icons`
 * reads `ICON_SPRITE_GLOBAL`/`ICON_SPRITE_SYMBOLS_GLOBAL` off `globalThis` on
 * first lookup, so the HTML shell assigning them before hydration is all that
 * is needed — the same "value the shell emits, read once on the client"
 * mechanism the translation dictionary uses.
 *
 * `JSON.stringify` on the URL is what keeps the snippet from being a string
 * concatenation of an unescaped value.
 *
 * @param params.symbols - The current sprite's symbol manifest, or `null`
 *   (the default) to emit no manifest assignment at all. Today's sprite is
 *   the full cartesian product of every glyph at every shipped weight, and
 *   `@repo/icons`' `hasIconSpriteSymbol` already treats "no manifest
 *   published" as "every pair exists" — the exact same behaviour a manifest
 *   listing all 988 ids would produce, at zero HTML cost instead of ~20 KB.
 *   Passing an array here (once a later change generates a subset) emits the
 *   second assignment.
 * @returns Classic-script source, ready to be emitted with `set:html`.
 */
export function iconSpriteClientScript({
    symbols = null
}: {
    readonly symbols?: ReadonlyArray<string> | null;
} = {}): string {
    const base = `window.${ICON_SPRITE_GLOBAL}=${JSON.stringify(iconSpriteUrl())};`;
    if (symbols === null) return base;
    return `${base}window.${ICON_SPRITE_SYMBOLS_GLOBAL}=${JSON.stringify(symbols)};`;
}

/**
 * Turns sprite mode on for SERVER rendering. Call once, at server start.
 *
 * Must happen at module load of the SSR entry rather than from a layout: a
 * component that enabled it mid-render would leave every icon rendered earlier
 * in the tree inline, and the page would ship both forms.
 *
 * `setIconSpriteSymbols` is called alongside `setIconSpriteBase`, both wired
 * the same way, so the two halves of the (base, manifest) pair stay symmetric
 * for a later change that ships a real subset. Today's sprite carries every
 * pair, so `null` (the permissive default — see `hasIconSpriteSymbol`) is the
 * correct manifest to publish.
 */
export function initIconSprite(): void {
    setIconSpriteBase(iconSpriteUrl());
    setIconSpriteSymbols({ symbols: null });
}
