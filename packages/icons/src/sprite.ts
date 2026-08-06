/**
 * @file sprite.ts
 * @description Opt-in external-sprite mode for the Phosphor icon wrappers
 * (HOS-369 W3-6).
 *
 * `createPhosphorIcon` inlines a full `<svg>` — every path, every time — for
 * each icon instance. On `apps/web` that is 30.5% of the home page's HTML and
 * 47.9% of a listing page's, for 78 and 139 DISTINCT shapes respectively: the
 * same handful of glyphs re-serialized hundreds of times per document. Pointing
 * each instance at ONE content-addressed sprite instead replaces ~500 bytes of
 * path data per instance with a ~55-byte `<use>` reference, and the sprite
 * itself is fetched once per session and then read from the HTTP cache.
 *
 * ## Why this is opt-in and off by default
 *
 * `@repo/icons` is shared with `apps/admin`, which has no sprite endpoint. A
 * `<use href>` pointing at a URL that does not exist renders NOTHING — silently,
 * with no console error in most browsers. So the sprite branch only activates
 * once a consumer explicitly calls {@link setIconSpriteBase} (or, in the
 * browser, once the page has assigned {@link ICON_SPRITE_GLOBAL}). With no base
 * configured, `createPhosphorIcon` renders exactly as it always has.
 *
 * ## Why only four weights ship
 *
 * Measured over the icon set `apps/web` can reach (247 distinct glyphs, once
 * aliases collapse): `regular`, `bold`, `fill` and `duotone` cost 500,799 B raw
 * / 83,222 B brotli. `thin` and `light` are used nowhere in the app, and adding
 * them would grow the sprite by half again for nothing.
 *
 * A weight outside this list is NOT a failure: the wrapper falls back to inline
 * rendering, which is correct, just heavier. `apps/web` carries a static guard
 * that fails CI if `thin`/`light` appear, so the fallback stays theoretical.
 * {@link SPRITE_WEIGHTS} is the
 * single source of truth for both the generator (which decides what to emit)
 * and the wrapper (which decides when to reference it), so the two cannot
 * disagree about what the sprite contains.
 *
 * ## Why `currentColor` still works across the boundary
 *
 * `fill` is an INHERITED presentation attribute, and inherited properties do
 * cross into a `<use>` shadow tree (CSS *selectors* do not). The wrapper keeps
 * `fill={resolvedColor}` on the host `<svg>`, and the symbol's children carry no
 * `fill` of their own, so `currentColor` — and the duotone brand color — resolve
 * exactly as they did inline.
 *
 * ## Why there is also a (glyph, weight) PAIR fail-safe
 *
 * {@link isSpriteWeight} is a fail-safe on the WEIGHT axis only: it assumes
 * that if a weight is shipped at all, every glyph has a `<symbol>` for it — true
 * today, because the sprite is the full cartesian product of every glyph the
 * package can reach at every shipped weight. A subset sprite (planned in a
 * later change) breaks that assumption: a glyph can ship at `duotone` but not
 * `bold`. {@link hasIconSpriteSymbol} is the same fail-safe pattern extended to
 * that pair, checked in addition to {@link isSpriteWeight} rather than instead
 * of it. This PR only adds the mechanism — every consumer today either
 * configures no manifest at all, or (this app) an explicit `null`, both of
 * which resolve to the SAME permissive default the mechanism had before it
 * existed, so introducing it is a no-op until a later change actually ships a
 * subset.
 *
 * @module sprite
 */

import type { ComponentType } from 'react';
import type { IconWeight } from './types';

/**
 * The icon weights the sprite actually contains.
 *
 * Shared by the generator (`apps/web/src/lib/icon-sprite.ts`) and by
 * `createPhosphorIcon`: a weight outside this list has no `<symbol>`, so the
 * wrapper must fall back to inline rendering rather than emit a `<use>` that
 * resolves to nothing.
 */
export const SPRITE_WEIGHTS = ['regular', 'bold', 'fill', 'duotone'] as const;

/** One of the weights {@link SPRITE_WEIGHTS} ships. */
export type SpriteWeight = (typeof SPRITE_WEIGHTS)[number];

/**
 * Name of the global a page assigns to hand the sprite URL to the browser.
 *
 * The server sets its base through {@link setIconSpriteBase} at boot, but client
 * islands render icons too and run in a different realm. `apps/web`'s HTML
 * shells emit `window.__HOSPEDA_ICON_SPRITE__ = "<url>"` from an inline script
 * in `<head>`, mirroring how the translation dictionary reaches islands: a value
 * the shell emits once, resolved from there by whoever needs it.
 *
 * Consumers that never assign it (i.e. `apps/admin`) keep inline rendering.
 */
export const ICON_SPRITE_GLOBAL = '__HOSPEDA_ICON_SPRITE__';

/**
 * Name of the global a page assigns to hand the sprite's SYMBOL MANIFEST to the
 * browser — sibling of {@link ICON_SPRITE_GLOBAL}, same rationale: the server
 * sets its manifest through {@link setIconSpriteSymbols} at boot, but client
 * islands render in a different realm where that call never happened, so the
 * value has to come from something the HTML shell assigned before hydration.
 *
 * Consumers that never assign it keep the permissive default — see
 * {@link hasIconSpriteSymbol}.
 */
export const ICON_SPRITE_SYMBOLS_GLOBAL = '__HOSPEDA_ICON_SPRITE_SYMBOLS__';

/**
 * Property under which a wrapper records the sprite symbol NAME of the Phosphor
 * glyph it draws.
 *
 * `Symbol.for` rather than a plain string key so it cannot collide with a React
 * or Phosphor static, and rather than a module-local `Symbol()` so two copies of
 * this module (source alias in tests, bundled `dist` elsewhere) still agree.
 */
const SPRITE_NAME_KEY = Symbol.for('repo-icons.sprite-name');

/** Property under which a wrapper records the Phosphor component it wraps. */
const SPRITE_GLYPH_KEY = Symbol.for('repo-icons.sprite-glyph');

/** Props a raw Phosphor glyph component accepts. Minimal subset the wrapper uses. */
export interface PhosphorGlyphProps {
    readonly size?: number | string;
    readonly color?: string;
    readonly weight?: IconWeight;
    readonly mirrored?: boolean;
    readonly className?: string;
    readonly [key: string]: unknown;
}

/** A raw Phosphor icon component, as handed to `createPhosphorIcon`. */
export type PhosphorGlyphComponent = ComponentType<PhosphorGlyphProps>;

/** Shape a marked wrapper takes, from the marker's point of view. */
interface SpriteMarkedComponent {
    readonly [SPRITE_NAME_KEY]?: string;
    readonly [SPRITE_GLYPH_KEY]?: PhosphorGlyphComponent;
}

/**
 * The sprite base URL set explicitly, or `null` when nothing set one.
 *
 * Module-level singleton: every wrapper reads the same value, so enabling sprite
 * mode is one call rather than a prop threaded through every call site.
 */
let spriteBase: string | null = null;

/**
 * Turns sprite mode on for every Phosphor icon wrapper.
 *
 * @param url - Base URL of the sprite document, e.g. `/icons/sprite.9f3a1c07.svg`.
 *   Pass `null` to drop the explicit setting, after which the value falls back to
 *   {@link ICON_SPRITE_GLOBAL} — see {@link getIconSpriteBase}.
 *
 * @example
 * ```ts
 * setIconSpriteBase(iconSpriteUrl()); // once, at server start
 * ```
 */
export function setIconSpriteBase(url: string | null): void {
    spriteBase = url;
}

/**
 * The sprite base URL currently in effect, or `null` when sprite mode is off.
 *
 * An explicit {@link setIconSpriteBase} wins; failing that, the value the HTML
 * shell published on {@link ICON_SPRITE_GLOBAL}. The global fallback is what
 * lets a browser island resolve the base without every island wiring an
 * initializer, and without depending on some module having called a setter
 * before the first icon rendered.
 *
 * @returns The base URL, or `null` when icons must render inline.
 */
export function getIconSpriteBase(): string | null {
    if (spriteBase !== null) return spriteBase;

    const fromGlobal = (globalThis as Record<string, unknown>)[ICON_SPRITE_GLOBAL];
    return typeof fromGlobal === 'string' && fromGlobal.length > 0 ? fromGlobal : null;
}

/**
 * Whether a weight has a `<symbol>` in the sprite.
 *
 * @param weight - The resolved icon weight.
 * @returns `true` when the sprite ships this weight.
 */
export function isSpriteWeight(weight: IconWeight): weight is SpriteWeight {
    return (SPRITE_WEIGHTS as ReadonlyArray<string>).includes(weight);
}

/**
 * The symbol manifest set explicitly via {@link setIconSpriteSymbols}, memoized
 * into a `Set` for O(1) lookups — `null` when nothing set one (including "set,
 * then cleared with `null`").
 */
let spriteSymbolsSet: Set<string> | null = null;

/**
 * The array most recently read off {@link ICON_SPRITE_SYMBOLS_GLOBAL}, kept
 * only to detect whether the global changed between calls.
 */
let cachedGlobalSymbolsArray: unknown;

/** `cachedGlobalSymbolsArray`, memoized into a `Set`. */
let cachedGlobalSymbolsSet: Set<string> | null = null;

/**
 * Turns the (glyph name, weight) symbol manifest on for every Phosphor icon
 * wrapper.
 *
 * This is the WEIGHT-axis fail-safe ({@link isSpriteWeight}) extended to the
 * PAIR axis: today's sprite is the full cartesian product of every glyph at
 * every shipped weight, but a future subset sprite will not carry every pair,
 * and a `<use href>` at a missing `<symbol>` renders NOTHING — silently. This
 * setter is how a consumer tells the wrapper exactly which pairs actually have
 * a `<symbol>`, so a miss can fall back to inline rendering instead of
 * disappearing.
 *
 * @param params.symbols - Every `<symbol id>` the current sprite carries (see
 *   {@link iconSymbolId}), or `null` to clear the explicit setting, after which
 *   the value falls back to {@link ICON_SPRITE_SYMBOLS_GLOBAL} and then to the
 *   permissive default — see {@link hasIconSpriteSymbol}.
 *
 * @example
 * ```ts
 * setIconSpriteSymbols({ symbols: listCurrentSpriteSymbolIds() }); // once, at server start
 * ```
 */
export function setIconSpriteSymbols({
    symbols
}: {
    readonly symbols: ReadonlyArray<string> | null;
}): void {
    spriteSymbolsSet = symbols === null ? null : new Set(symbols);
}

/**
 * Reads {@link ICON_SPRITE_SYMBOLS_GLOBAL} off `globalThis`, memoizing the
 * derived `Set` so repeated {@link hasIconSpriteSymbol} calls — hundreds per
 * page — do not rescan the array each time. The cache is keyed on the array's
 * own identity, so it stays correct if the global is ever reassigned.
 *
 * @returns The manifest `Set`, or `null` when the global carries no usable array.
 */
function readGlobalSpriteSymbolsSet(): Set<string> | null {
    const fromGlobal = (globalThis as Record<string, unknown>)[ICON_SPRITE_SYMBOLS_GLOBAL];
    if (!Array.isArray(fromGlobal)) return null;

    if (fromGlobal !== cachedGlobalSymbolsArray) {
        cachedGlobalSymbolsArray = fromGlobal;
        cachedGlobalSymbolsSet = new Set(fromGlobal as ReadonlyArray<string>);
    }
    return cachedGlobalSymbolsSet;
}

/**
 * Whether the sprite currently in effect carries a `<symbol>` for a given
 * (glyph name, weight) pair id.
 *
 * ## The default is PERMISSIVE, and that is deliberate
 *
 * When NO manifest is configured anywhere — no {@link setIconSpriteSymbols}
 * call, no {@link ICON_SPRITE_SYMBOLS_GLOBAL} — this returns `true`
 * unconditionally. "No manifest" means "no one told the wrapper the sprite is
 * anything other than the full cartesian product", which is today's reality:
 * every (glyph, weight) pair the sprite generator can reach has a `<symbol>`.
 * Flipping this default to `false` would silently inline EVERY icon in
 * `apps/web` (and `apps/admin`, which never configures a base at all and so
 * would newly fail this check too, though it never reaches this branch since
 * it never configures a base). A future reader "cleaning up" what looks like
 * an inverted fail-open here would triple the HTML this mechanism exists to
 * shrink, with no error, on every page, in production, discoverable only by
 * noticing every icon rendered heavier than expected.
 *
 * ## Resolution order
 *
 * Mirrors {@link getIconSpriteBase} exactly: an explicit
 * {@link setIconSpriteSymbols} call wins; failing that, the manifest the HTML
 * shell published on {@link ICON_SPRITE_SYMBOLS_GLOBAL}; failing that, the
 * permissive default above.
 *
 * @param params.symbol - The `<symbol id>` to check, e.g. `StarIcon-duotone`
 *   (see {@link iconSymbolId}).
 * @returns `true` when the pair is known to have a symbol, OR when no manifest
 *   is configured at all. `false` only when a manifest IS configured and does
 *   not list this pair.
 */
export function hasIconSpriteSymbol({ symbol }: { readonly symbol: string }): boolean {
    if (spriteSymbolsSet !== null) return spriteSymbolsSet.has(symbol);

    const fromGlobal = readGlobalSpriteSymbolsSet();
    if (fromGlobal !== null) return fromGlobal.has(symbol);

    return true;
}

/**
 * The `<symbol>` id for one glyph at one weight.
 *
 * Used by BOTH halves of the mechanism — the generator names its symbols with
 * it, the wrapper builds its `<use href>` fragment with it — so an id format
 * change cannot break one side without breaking the other.
 *
 * @param params.name - Sprite name of the glyph (the Phosphor component's own
 *   `displayName`, e.g. `StarIcon`). Deliberately NOT the wrapper's
 *   `displayName`: those are semantic and collide (`bell`, `calendar` and 26
 *   others name more than one wrapper), which would make two different glyphs
 *   share a symbol.
 * @param params.weight - Weight to reference.
 * @returns The id, e.g. `StarIcon-duotone`.
 */
export function iconSymbolId({
    name,
    weight
}: {
    readonly name: string;
    readonly weight: SpriteWeight;
}): string {
    return `${name}-${weight}`;
}

/**
 * Records which Phosphor glyph a wrapper draws, and under what name.
 *
 * Called by `createPhosphorIcon` at wrapper-creation time. It is what lets the
 * generator enumerate the icon set from `@repo/icons`'s own exports at runtime
 * instead of re-deriving a list by scanning source: any exported value carrying
 * this marker is a Phosphor wrapper, names the glyph it needs a symbol for, and
 * hands over the component that can draw it.
 *
 * The GLYPH is recorded, not just the name, so the generator can render the raw
 * Phosphor component. Rendering the wrapper instead would mean rendering
 * something that consults sprite mode — and with a base already configured it
 * would emit `<use>` references INTO the sprite currently being built, producing
 * an empty, self-referential document.
 *
 * @param params.component - The wrapper component to mark.
 * @param params.name - Sprite name of the glyph it renders.
 * @param params.glyph - The Phosphor component that draws it.
 */
export function markIconSpriteGlyph({
    component,
    name,
    glyph
}: {
    readonly component: object;
    readonly name: string;
    readonly glyph: PhosphorGlyphComponent;
}): void {
    Object.defineProperty(component, SPRITE_NAME_KEY, {
        value: name,
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(component, SPRITE_GLYPH_KEY, {
        value: glyph,
        enumerable: false,
        configurable: true
    });
}

/**
 * Reads back the sprite name {@link markIconSpriteGlyph} recorded, if any.
 *
 * @param value - Any value; typically an export of `@repo/icons`.
 * @returns The glyph's sprite name, or `null` when the value is not a Phosphor
 *   wrapper (brand icons, hand-crafted icons, domain tables, plain constants).
 */
export function getIconSpriteName(value: unknown): string | null {
    if (value === null || (typeof value !== 'function' && typeof value !== 'object')) return null;
    const name = (value as SpriteMarkedComponent)[SPRITE_NAME_KEY];
    return typeof name === 'string' && name.length > 0 ? name : null;
}

/**
 * Reads back the raw Phosphor component {@link markIconSpriteGlyph} recorded.
 *
 * @param value - Any value; typically an export of `@repo/icons`.
 * @returns The Phosphor component, or `null` when the value is not a Phosphor
 *   wrapper.
 */
export function getIconSpriteGlyph(value: unknown): PhosphorGlyphComponent | null {
    if (value === null || (typeof value !== 'function' && typeof value !== 'object')) return null;
    return (value as SpriteMarkedComponent)[SPRITE_GLYPH_KEY] ?? null;
}
