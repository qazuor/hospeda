/**
 * @file generators/validate.ts
 * @description SPEC-153 T-153-17 — Byte-for-byte round-trip check between
 * the generated `dist/tokens.css` and the Phase 0 seed manifest at
 * `seed/web-baseline.json`.
 *
 * This is the safety net for AC-4 and the prerequisite for Phase 2's
 * pixel-diff-zero gate. If any extracted web token (light, dark, or media-
 * scoped) drifts in the generated CSS, the build fails with a per-entry
 * diff report.
 *
 * The validator only covers web tokens — palettes (`--palette-*-NNN`) and
 * admin tokens are doc 05 §6 introductions absent from the seed and have
 * their own correctness tests in `colors.test.ts` / `admin.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildCSS } from './generate-css.js';

// ============================================================================
// Seed manifest shape
// ============================================================================

type SeedEntry = {
    readonly name: string;
    readonly value: string;
    readonly category?: string;
    readonly line?: number;
};

type SeedMediaEntry = {
    readonly condition: string;
    readonly tokens: Readonly<Record<string, SeedEntry>>;
};

export type Seed = {
    readonly tokens: {
        readonly light: Readonly<Record<string, SeedEntry>>;
        readonly dark: Readonly<Record<string, SeedEntry>>;
        readonly media: Readonly<Record<string, SeedMediaEntry>>;
    };
};

// ============================================================================
// Validation report
// ============================================================================

export type Drift = {
    readonly scope: 'light' | 'dark' | `media ${string}`;
    readonly name: string;
    readonly expected: string;
    readonly actual: string | null;
};

export type ValidationReport = {
    readonly totalChecked: number;
    readonly drifts: readonly Drift[];
};

// ============================================================================
// Default paths
// ============================================================================

function packageRoot(): string {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function defaultSeedPath(): string {
    return resolve(packageRoot(), 'seed', 'web-baseline.json');
}

function readSeed(path: string = defaultSeedPath()): Seed {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as Seed;
}

// ============================================================================
// Brace-aware block extractor — robust to the nested `@media { :root { } }`
// case the naive `indexOf('\n}')` parser used in tests would mis-handle.
// ============================================================================

function extractBlockBody(css: string, startAfterBrace: number): { body: string; end: number } {
    let depth = 1;
    let i = startAfterBrace;
    while (i < css.length && depth > 0) {
        const ch = css[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        i++;
    }
    if (depth !== 0) {
        throw new Error('validate: unterminated CSS block (missing closing brace)');
    }
    return { body: css.slice(startAfterBrace, i - 1), end: i };
}

function getTopLevelBlock(css: string, selector: string): string {
    const open = `${selector} {`;
    const idx = css.indexOf(open);
    if (idx === -1) {
        throw new Error(`validate: selector not found in generated CSS: ${selector}`);
    }
    return extractBlockBody(css, idx + open.length).body;
}

function getMediaRootBlock(css: string, condition: string): string {
    const outer = getTopLevelBlock(css, `@media ${condition}`);
    const rootIdx = outer.indexOf(':root {');
    if (rootIdx === -1) {
        throw new Error(`validate: @media ${condition} block has no :root child`);
    }
    return extractBlockBody(outer, rootIdx + ':root {'.length).body;
}

// ============================================================================
// Declaration parser
// ============================================================================

const DECL_RE = /^\s*--([a-zA-Z0-9-]+):\s*(.+?);\s*$/gm;

function parseDeclarations(block: string): Map<string, string> {
    const decls = new Map<string, string>();
    for (const match of block.matchAll(DECL_RE)) {
        const [, name, value] = match;
        if (name && value !== undefined) decls.set(name, value);
    }
    return decls;
}

// ============================================================================
// Core validator
// ============================================================================

function diff(
    scope: Drift['scope'],
    actualDecls: Map<string, string>,
    seedTokens: Readonly<Record<string, SeedEntry>>
): { drifts: Drift[]; checked: number } {
    const drifts: Drift[] = [];
    let checked = 0;
    for (const [name, entry] of Object.entries(seedTokens)) {
        checked++;
        const actual = actualDecls.get(name);
        if (actual === undefined) {
            drifts.push({ scope, name, expected: entry.value, actual: null });
        } else if (actual !== entry.value) {
            drifts.push({ scope, name, expected: entry.value, actual });
        }
    }
    return { drifts, checked };
}

/**
 * Run the round-trip check. By default it reads the generated CSS via
 * `buildCSS()` (no filesystem dependency — keeps the validator runnable
 * before `dist/` exists) and the seed from disk. Both can be overridden
 * for tests.
 */
export function validate({ css, seed }: { css?: string; seed?: Seed } = {}): ValidationReport {
    const _css = css ?? buildCSS();
    const _seed = seed ?? readSeed();

    const rootBlock = getTopLevelBlock(_css, ':root');
    const darkBlock = getTopLevelBlock(_css, '[data-theme="dark"]:not([data-app="admin"])');

    const rootDecls = parseDeclarations(rootBlock);
    const darkDecls = parseDeclarations(darkBlock);

    const drifts: Drift[] = [];
    let totalChecked = 0;

    const light = diff('light', rootDecls, _seed.tokens.light);
    drifts.push(...light.drifts);
    totalChecked += light.checked;

    const dark = diff('dark', darkDecls, _seed.tokens.dark);
    drifts.push(...dark.drifts);
    totalChecked += dark.checked;

    for (const [query, mediaEntry] of Object.entries(_seed.tokens.media)) {
        const mediaDecls = parseDeclarations(getMediaRootBlock(_css, query));
        const m = diff(`media ${query}`, mediaDecls, mediaEntry.tokens);
        drifts.push(...m.drifts);
        totalChecked += m.checked;
    }

    return { totalChecked, drifts };
}

/** Render the report for human consumption (used by the CLI and surfaceable in CI logs). */
export function formatReport(report: ValidationReport): string {
    if (report.drifts.length === 0) {
        return `design-tokens validate: ${report.totalChecked} web tokens match seed`;
    }
    const lines: string[] = [];
    lines.push(`design-tokens validate: ${report.drifts.length} drift(s) detected:`);
    for (const d of report.drifts) {
        const actual = d.actual === null ? '<missing>' : d.actual;
        lines.push(`  [${d.scope}] --${d.name}`);
        lines.push(`    expected: ${d.expected}`);
        lines.push(`    actual:   ${actual}`);
    }
    return lines.join('\n');
}

// ============================================================================
// CLI entry
// ============================================================================

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const report = validate();
    const text = formatReport(report);
    if (report.drifts.length > 0) {
        process.stderr.write(`${text}\n`);
        process.exit(1);
    }
    process.stdout.write(`${text}\n`);
}
