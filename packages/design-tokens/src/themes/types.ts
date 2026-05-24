/**
 * @file themes/types.ts
 * @description Shared types for SPEC-153 theme mappings.
 *
 * A theme is a flat record keyed by the CSS custom-property name
 * (WITHOUT the leading `--`). The value is either:
 *
 *   - an `OKLCH` triple — the CSS generator (T-153-16) calls
 *     `formatOKLCH()` to serialize it (e.g. `{ l: 0.63, c: 0.19, h: 259 }`
 *     becomes `oklch(0.63 0.19 259)`);
 *
 *   - a raw `string` — emitted as-is, used for values that don't fit a
 *     single OKLCH triple (relative-color expressions, `var()`
 *     references, `clamp()` / `calc()` expressions, font stacks,
 *     numbers for z-index, etc.).
 *
 * Keys omit the `--` prefix so they stay JS-identifier-friendly when
 * iterated; the generator prepends `--` when emitting.
 */

import type { OKLCH } from '../tokens/colors.js';

export type ThemeValue = OKLCH | string;
export type Theme = Readonly<Record<string, ThemeValue>>;
