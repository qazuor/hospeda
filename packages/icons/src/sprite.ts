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
