/**
 * @file generators/generate-css.ts
 * @description SPEC-153 T-153-16 — Emit `dist/tokens.css` from the token
 * modules + theme mappings.
 *
 * Output layout (theme-selector contract documented in spec.md §4 / doc 05 §6):
 *
 *   :root {
 *       <150 palette declarations — theme-independent primitives>
 *       <208 web light theme declarations — web is the default scope>
 *   }
 *
 *   /* SPEC-176: Variant tokens — sRGB fallback + @supports oklch override. *\/
 *   :root { <114 sRGB fallback variant token declarations> }
 *   @supports (color: oklch(from white l c h)) {
 *       :root { <114 oklch relative-color override declarations> }
 *   }
 *
 *   @media (min-width: 1600px) {
 *       :root { <layoutMediaOverrides — container-max bump> }
 *   }
 *
 *   [data-theme="dark"]:not([data-app="admin"]) { <56 web dark overrides> }
 *   [data-app="admin"] { <92 admin light declarations — color-* naming> }
 *   [data-app="admin"][data-theme="dark"] { <14 admin dark overrides> }
 *
 * The pure `buildCSS()` function returns the full output as a string so the
 * colocated tests can assert against it without filesystem IO. The CLI entry
 * at the bottom writes the result to `dist/tokens.css` when invoked directly
 * via `tsx src/generators/generate-css.ts`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { adminDark } from '../themes/admin-dark.js';
import { adminLight } from '../themes/admin-light.js';
import type { Theme, ThemeValue } from '../themes/types.js';
import { webDark } from '../themes/web-dark.js';
import { webLight } from '../themes/web-light.js';
import { type OKLCH, SHADES, formatOKLCH, palettes } from '../tokens/colors.js';
import { layoutMediaOverrides } from '../tokens/layout.js';
import { emitVariantDarkFallback, emitVariantTokens } from './emit-variant-tokens.js';

const INDENT = '    ';
const NL = '\n';

/**
 * File-level banner. Stays narrow so the artifact reads cleanly when
 * downstream consumers open `dist/tokens.css` in a browser devtools panel.
 */
const HEADER = `/**
 * @repo/design-tokens — auto-generated, do not edit by hand.
 * Source: src/tokens/, src/themes/. Spec: SPEC-153.
 * Regenerate via \`pnpm --filter @repo/design-tokens build\`.
 */`;

/**
 * Narrow `ThemeValue` to the OKLCH branch. The string branch covers
 * `clamp()`, `calc()`, `var()`, font stacks, plain numbers (for z-index),
 * etc., none of which carry the `l` numeric field.
 */
function isOklch(value: ThemeValue): value is OKLCH {
    return typeof value === 'object' && value !== null && typeof (value as OKLCH).l === 'number';
}

/** Serialize a single ThemeValue. OKLCH triples go through formatOKLCH(). */
function formatValue(value: ThemeValue): string {
    return isOklch(value) ? formatOKLCH(value) : value;
}

/** Emit a `    --key: value;` line (indent stays inside the caller's block). */
function emitDecl(key: string, value: string, indent: string): string {
    return `${indent}--${key}: ${value};`;
}

/**
 * Emit every palette × shade as a `--palette-<name>-<shade>` declaration.
 * Order: brand (river/sky/forest/sand/accent) → semantic (success/warning/
 * danger/info) → neutral, preserving the insertion order of the `palettes`
 * aggregate in `tokens/colors.ts`. Within a palette, shades go 50..900.
 *
 * Total: 10 palettes × 10 shades = 100 declarations.
 */
function emitPalettes(indent: string): string {
    const lines: string[] = [];
    for (const [name, palette] of Object.entries(palettes)) {
        for (const shade of SHADES) {
            lines.push(emitDecl(`palette-${name}-${shade}`, formatOKLCH(palette[shade]), indent));
        }
    }
    return lines.join(NL);
}

/**
 * Emit every entry of a theme record as a `--<key>: <value>;` declaration.
 * Iteration follows the theme's insertion order (which mirrors web's CSS
 * authoring order in `apps/web/src/styles/global.css`).
 */
function emitTheme(theme: Theme, indent: string): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(theme)) {
        lines.push(emitDecl(key, formatValue(value), indent));
    }
    return lines.join(NL);
}

/**
 * Emit one `@media (min-width: N) { :root { ... } }` block per entry in
 * `layoutMediaOverrides`. Currently the seed manifest produces a single
 * block (the 1600px container-max bump). Future media overrides land here
 * without touching the generator.
 */
function emitMediaOverrides(): string {
    const blocks: string[] = [];
    for (const [query, overrides] of Object.entries(layoutMediaOverrides)) {
        const decls: string[] = [];
        for (const [key, value] of Object.entries(overrides)) {
            decls.push(emitDecl(key, value, INDENT + INDENT));
        }
        blocks.push(
            `@media ${query} {${NL}${INDENT}:root {${NL}${decls.join(NL)}${NL}${INDENT}}${NL}}`
        );
    }
    return blocks.join(NL + NL);
}

/**
 * Assemble the full `dist/tokens.css` content. Pure — no filesystem IO so
 * the colocated tests can call this directly and assert against the string.
 */
export function buildCSS(): string {
    const parts: string[] = [];
    parts.push(HEADER);
    parts.push('');
    parts.push(':root {');
    parts.push(`${INDENT}/* Palette primitives — theme-independent (150 declarations). */`);
    parts.push(emitPalettes(INDENT));
    parts.push('');
    parts.push(`${INDENT}/* Web light theme — web is the default scope. */`);
    parts.push(emitTheme(webLight, INDENT));
    parts.push('}');
    parts.push('');
    parts.push(emitVariantTokens());
    parts.push('/* Viewport-conditional overrides from layoutMediaOverrides. */');
    parts.push(emitMediaOverrides());
    parts.push('');
    parts.push('/* Web dark theme — opt-in, scoped to NOT apply when admin is mounted. */');
    parts.push('[data-theme="dark"]:not([data-app="admin"]) {');
    parts.push(emitTheme(webDark, INDENT));
    parts.push('}');
    parts.push('');
    parts.push('/* Admin light theme — applies whenever `data-app="admin"` is set on <html>. */');
    parts.push('[data-app="admin"] {');
    parts.push(emitTheme(adminLight, INDENT));
    parts.push('}');
    parts.push('');
    parts.push('/* Admin dark theme — combined selector requires both flags. */');
    parts.push('[data-app="admin"][data-theme="dark"] {');
    parts.push(emitTheme(adminDark, INDENT));
    parts.push('}');
    parts.push('');
    // SPEC-176 T-009 — dark-mode sRGB fallbacks for variant tokens, emitted LAST
    // so its `[data-theme="dark"]:not([data-app="admin"])` selector (nested under
    // `@supports not (oklch)`) does not shadow the base-token dark block above.
    const variantDarkFallback = emitVariantDarkFallback();
    if (variantDarkFallback !== '') {
        parts.push(variantDarkFallback);
    }
    return parts.join(NL);
}

/** Resolve the package's dist output path relative to this source file. */
function resolveOutputPath(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    return resolve(here, '..', '..', 'dist', 'tokens.css');
}

/**
 * Write the generated CSS to disk. Creates `dist/` if it does not exist.
 * Exposed so other tools (e.g. the validate step in T-153-17) can reuse it.
 */
export function writeCSS(outputPath: string = resolveOutputPath()): string {
    const css = buildCSS();
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, css, 'utf8');
    return outputPath;
}

// ============================================================================
// CLI entry — runs only when executed directly via `tsx generate-css.ts`,
// never when imported (vitest, validator, etc.) because process.argv[1]
// then points at the test runner / parent script, not this file.
// ============================================================================

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const outputPath = writeCSS();
    process.stdout.write(`design-tokens: wrote ${outputPath}\n`);
}
