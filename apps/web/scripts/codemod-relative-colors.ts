/**
 * @file apps/web/scripts/codemod-relative-colors.ts
 * @description SPEC-176 T-005 — Codemod that swaps inline `oklch(from var(--BASE) ...)`
 *   call-sites in `apps/web/src/` to `var(--TOKEN)` references, using
 *   `VARIANT_TOKEN_MAP` (from `@repo/design-tokens`) as the source of truth.
 *
 * ## How to run
 *
 * Run with `tsx` from the repo root (it imports the TypeScript map directly):
 *
 * ```bash
 * pnpm exec tsx apps/web/scripts/codemod-relative-colors.ts            # DRY-RUN (default)
 * pnpm exec tsx apps/web/scripts/codemod-relative-colors.ts --apply    # writes files
 * ```
 *
 * DRY-RUN is the default. It never touches any source file — it only counts what
 * WOULD be replaced and writes the report markdown (the report is an output
 * artifact, not source). `--apply` enables in-place writes.
 *
 * NOTE: T-001's guard script (`check-css-relative-colors.cjs`) references a
 * `codemod-relative-colors.mjs` filename in a doc string. This file is the `.ts`
 * variant: a `.mjs` cannot cleanly `import` the TypeScript `VARIANT_TOKEN_MAP`,
 * so the codemod is authored as `.ts` and executed under `tsx`. The guard's doc
 * string is reconciled in T-013 documentation.
 *
 * ## Matching strategy (exact-substring, longest-first)
 *
 * The mapping is an N→1 literal table: for each entry, `replaces` plus every
 * string in `replacesVariants` maps to `var(--{name})`. Matching is done with
 * exact substring search (`indexOf` scan), NOT regex — the `oklch(...)` literals
 * contain regex metacharacters (`(`, `)`, `*`, `+`, `.`) that would corrupt a
 * naive regex. Every literal already includes the closing `)` of the
 * `oklch(...)` expression, so a substring match is bounded on the right and
 * cannot bleed into trailing gradient syntax.
 *
 * Literals are sorted by descending length before matching so that a shorter
 * literal can never shadow a longer one that contains it as a prefix. (Concrete
 * case: `oklch(from var(--brand-accent) l c h / 0.3)` is a prefix-with-different-
 * suffix of `... / 0.30)` and `... / 0.35)` — but because each literal ends in
 * `)`, the shorter `/ 0.3)` does NOT match inside `/ 0.30)` or `/ 0.35)`. The
 * longest-first ordering is belt-and-suspenders for any future literal that IS a
 * true substring of another.)
 *
 * Each match is replaced by walking the source left-to-right with `indexOf`,
 * consuming the matched literal, and advancing past the inserted replacement so
 * overlapping re-matches are impossible.
 *
 * ## Conflict detection
 *
 * Before matching, the script asserts that no two map entries claim the same
 * literal (across `replaces` + `replacesVariants` of all entries). A collision
 * would make the substitution ambiguous and is reported as CRITICAL.
 *
 * ## var-with-fallback normalization (second pass)
 *
 * After the literal pass, residual call-sites of the form
 * `oklch(from var(--BASE, <FALLBACK>) <TRANSFORM>)` are handled by a second
 * pass. These carry a hardcoded fallback INSIDE `var()` (e.g.
 * `oklch(from var(--brand-primary, #1f6feb) l c h / 0.08)`) that the literal
 * matcher misses. The inner fallback is irrelevant once we point at a gated
 * token, so the pass strips `, <FALLBACK>` to get the canonical
 * `oklch(from var(--BASE) <TRANSFORM>)` and resolves the TRANSFORM to a token:
 *
 *   - alpha transform `l c h / V`: the alpha token for BASE whose `param` is
 *     NEAREST to `V` AND within `ALPHA_TOLERANCE` (0.025). If none is within
 *     tolerance, the occurrence is reported as a GAP (`var-fallback-alpha-gap`)
 *     with base + value + nearest token + delta — it is NEVER force-matched.
 *   - lightness transforms `calc(l * N)` / `calc(l - N)` / `calc(l + N)` /
 *     fixed `<N>`: matched EXACTLY to the corresponding token's `param`. If no
 *     exact token exists, the occurrence is a GAP (`var-fallback-lightness-gap`).
 *
 * The WHOLE original expression (fallback included) is replaced with
 * `var(--token)`. This works in `.css` and in JS/TSX inline-style strings.
 *
 * ### Nested-paren fallbacks (balanced scan)
 *
 * The `var()` fallback in this codebase is usually a simple hex value, but many
 * are `oklch(...)` / `rgb(...)` (which contain nested parentheses) and a few are
 * themselves `var()` calls (e.g. `var(--event-cat-bg, var(--brand-primary))`).
 * Naive stripping at the first `)` would corrupt those. Instead the pass finds
 * the `oklch(` open paren and the inner `var(` open paren and walks each forward
 * counting `(`/`)` depth to its matching close (`matchParen`), so the fallback —
 * however deeply nested — is removed correctly. Bases with no token entry at all
 * (e.g. `--muted`, `--primary`, `--success`, `--event-cat-bg`) cannot resolve
 * and are reported as GAPs (`var-fallback-no-base`).
 *
 * @see packages/design-tokens/src/generators/variant-tokens.ts — VARIANT_TOKEN_MAP.
 * @see packages/design-tokens/src/generators/variant-token-schema.ts — entry type.
 * @see .claude/specs/SPEC-176-web-color-fallback-old-browsers/variant-token-derivation.md
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { VariantTokenEntry } from '../../../packages/design-tokens/src/generators/variant-token-schema.js';
import { VARIANT_TOKEN_MAP } from '../../../packages/design-tokens/src/generators/variant-tokens.js';

// ============================================================================
// Configuration
// ============================================================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
/** apps/web/src — the directory walked for replacements. */
const WEB_SRC = resolve(SCRIPT_DIR, '..', 'src');
/** Repo root, used for printing portable relative paths in the report. */
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');
/** Output report path (allowed write — it is an artifact, not source). */
const REPORT_PATH = join(SCRIPT_DIR, 'codemod-report.md');
/** File extensions scanned (same set as check-css-relative-colors.cjs). */
const EXTENSIONS = ['.css', '.astro', '.tsx', '.ts'] as const;
/** Token used to detect ANY relative-color expression for the unmatched scan. */
const OKLCH_FROM = 'oklch(from';
/**
 * Maximum |requested − available| alpha distance for a var-with-fallback alpha
 * transform to snap onto an existing token. Beyond this it is a reported GAP.
 */
const ALPHA_TOLERANCE = 0.025;

// ============================================================================
// Types
// ============================================================================

/** A single literal → token replacement rule. */
interface ReplacementRule {
    /** Exact literal to find (includes the closing paren of the oklch expression). */
    readonly literal: string;
    /** Replacement value, e.g. `var(--brand-primary-a15)`. */
    readonly replacement: string;
    /** Owning token name (for per-token frequency stats). */
    readonly token: string;
}

/** One available transform → token for a base, used by the var-fallback pass. */
interface BaseVariant {
    /** Token name without `--` (e.g. `destructive-a10`). */
    readonly name: string;
    /** Transform family. */
    readonly family: VariantTokenEntry['family'];
    /** Numeric transform parameter (alpha value or lightness operand). */
    readonly param: number;
}

/**
 * Per-base index of available variant tokens, grouped by transform family, so
 * the var-with-fallback pass can do nearest-alpha / exact-lightness resolution.
 */
type BaseVariantIndex = Map<string, Map<VariantTokenEntry['family'], BaseVariant[]>>;

/** Per-file, per-rule replacement counts produced by the dry scan. */
interface FileMatchResult {
    /** Absolute file path. */
    readonly file: string;
    /** Map of token name → count of replacements that would happen in this file. */
    readonly perToken: Map<string, number>;
    /** Total replacements in this file. */
    readonly total: number;
}

/** One unmatched `oklch(from` occurrence with location + category. */
interface UnmatchedOccurrence {
    readonly file: string;
    readonly line: number;
    readonly snippet: string;
    readonly category: UnmatchedCategory;
    /** Diagnostic reason (var-fallback GAPs: base + value + nearest + delta). */
    readonly reason?: string;
}

/** Categories for unmatched relative-color occurrences (per derivation doc). */
type UnmatchedCategory =
    | 'var-with-fallback'
    | 'var-fallback-no-base'
    | 'var-fallback-alpha-gap'
    | 'var-fallback-lightness-gap'
    | 'dynamic-template-literal'
    | 'oklch-from-white'
    | 'alpha-zero'
    | 'other';

// ============================================================================
// Rule table construction + conflict detection
// ============================================================================

/**
 * Build the flat replacement-rule table from VARIANT_TOKEN_MAP and detect any
 * literal claimed by more than one token.
 *
 * @param map - The variant token map (source of truth).
 * @returns Object with the longest-first-sorted rules and any detected conflicts.
 */
function buildRules(map: ReadonlyArray<VariantTokenEntry>): {
    rules: ReplacementRule[];
    conflicts: Array<{ literal: string; tokens: string[] }>;
} {
    const owners = new Map<string, string[]>();
    const rules: ReplacementRule[] = [];

    for (const entry of map) {
        const literals = [entry.replaces, ...(entry.replacesVariants ?? [])];
        for (const literal of literals) {
            rules.push({
                literal,
                replacement: `var(--${entry.name})`,
                token: entry.name
            });
            const list = owners.get(literal) ?? [];
            list.push(entry.name);
            owners.set(literal, list);
        }
    }

    const conflicts: Array<{ literal: string; tokens: string[] }> = [];
    for (const [literal, tokens] of owners) {
        if (tokens.length > 1) {
            conflicts.push({ literal, tokens });
        }
    }

    // Longest literal first so a shorter literal never shadows a longer one.
    rules.sort((a, b) => b.literal.length - a.literal.length);

    return { rules, conflicts };
}

/**
 * Build the per-base variant index (base → family → tokens) used by the
 * var-with-fallback pass for nearest-alpha / exact-lightness resolution.
 *
 * @param map - The variant token map (source of truth).
 * @returns The base-keyed variant index.
 */
function buildBaseVariantIndex(map: ReadonlyArray<VariantTokenEntry>): BaseVariantIndex {
    const index: BaseVariantIndex = new Map();
    for (const entry of map) {
        const byFamily =
            index.get(entry.base) ?? new Map<VariantTokenEntry['family'], BaseVariant[]>();
        const list = byFamily.get(entry.family) ?? [];
        if (!list.some((x) => x.param === entry.param && x.name === entry.name)) {
            list.push({ name: entry.name, family: entry.family, param: entry.param });
        }
        byFamily.set(entry.family, list);
        index.set(entry.base, byFamily);
    }
    return index;
}

// ============================================================================
// var-with-fallback pass (strip inline var() fallback, resolve to a token)
// ============================================================================

/** Result of attempting to resolve one var-with-fallback expression. */
interface VarFallbackResolution {
    /** Token name (without `--`) when resolved; null on a GAP. */
    readonly token: string | null;
    /** GAP category when unresolved; undefined when resolved. */
    readonly gap?: 'var-fallback-no-base' | 'var-fallback-alpha-gap' | 'var-fallback-lightness-gap';
    /** Human-readable reason for the GAP (base + value + nearest + delta). */
    readonly reason?: string;
}

/**
 * Find the index of the matching close paren for the `(` at `openIdx`.
 *
 * @param text - The full string.
 * @param openIdx - Index of the opening `(`.
 * @returns Index of the matching `)`, or -1 if unbalanced.
 */
function matchParen(text: string, openIdx: number): number {
    let depth = 0;
    for (let i = openIdx; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Resolve a canonicalized `oklch(from var(--BASE) <TRANSFORM>)` transform to a
 * token name, using nearest-alpha (within tolerance) or exact-lightness rules.
 *
 * @param base - Base token name without `--`.
 * @param transform - Transform body (e.g. `l c h / 0.08` or `calc(l * 1.05) c h`).
 * @param index - The per-base variant index.
 * @returns The resolution (token or GAP with reason).
 */
function resolveTransform(
    base: string,
    transform: string,
    index: BaseVariantIndex
): VarFallbackResolution {
    const byFamily = index.get(base);
    if (!byFamily) {
        return {
            token: null,
            gap: 'var-fallback-no-base',
            reason: `base --${base} has no variant tokens (not a gated base)`
        };
    }

    const alpha = transform.match(/^l\s+c\s+h\s*\/\s*([0-9]*\.?[0-9]+)$/);
    if (alpha) {
        const value = Number(alpha[1]);
        const candidates = byFamily.get('alpha') ?? [];
        let best: BaseVariant | null = null;
        let bestDelta = Number.POSITIVE_INFINITY;
        for (const c of candidates) {
            const delta = Math.abs(c.param - value);
            if (delta < bestDelta) {
                bestDelta = delta;
                best = c;
            }
        }
        if (best && bestDelta <= ALPHA_TOLERANCE) return { token: best.name };
        const nearest = best ? `${best.name}@${best.param}` : 'none';
        return {
            token: null,
            gap: 'var-fallback-alpha-gap',
            reason: `base --${base} alpha ${value} -> nearest ${nearest} delta ${bestDelta.toFixed(3)} (> ${ALPHA_TOLERANCE})`
        };
    }

    // Lightness transforms: calc(l * N) / calc(l - N) / calc(l + N) / fixed N.
    const lightnessFamilies: Array<{ re: RegExp; family: VariantTokenEntry['family'] }> = [
        { re: /^calc\(\s*l\s*\*\s*([0-9]*\.?[0-9]+)\s*\)\s+c\s+h$/, family: 'lightness-multiply' },
        { re: /^calc\(\s*l\s*-\s*([0-9]*\.?[0-9]+)\s*\)\s+c\s+h$/, family: 'lightness-subtract' },
        { re: /^calc\(\s*l\s*\+\s*([0-9]*\.?[0-9]+)\s*\)\s+c\s+h$/, family: 'lightness-add' }
    ];
    for (const { re, family } of lightnessFamilies) {
        const m = transform.match(re);
        if (!m) continue;
        const value = Number(m[1]);
        const candidates = byFamily.get(family) ?? [];
        const exact = candidates.find((c) => c.param === value);
        if (exact) return { token: exact.name };
        return {
            token: null,
            gap: 'var-fallback-lightness-gap',
            reason: `base --${base} ${family} ${value} -> no exact token`
        };
    }

    return {
        token: null,
        gap: 'var-fallback-lightness-gap',
        reason: `base --${base} transform "${transform}" not recognized`
    };
}

/** A single var-with-fallback replacement that would occur in a file. */
interface VarFallbackReplacement {
    /** Token name (without `--`). */
    readonly token: string;
    /** The full original literal that would be replaced (fallback included). */
    readonly original: string;
}

/** A single unresolved var-with-fallback occurrence (a GAP). */
interface VarFallbackGap {
    readonly file: string;
    readonly line: number;
    readonly snippet: string;
    readonly category: UnmatchedCategory;
    readonly reason: string;
}

/**
 * Apply the var-with-fallback pass to a source string: find every
 * `oklch(from var(--BASE, <FALLBACK>) <TRANSFORM>)`, strip the fallback, resolve
 * to a token, and substitute `var(--token)`. Unresolved occurrences are
 * collected as GAPs and left untouched.
 *
 * @param content - File content (already through the literal pass).
 * @param file - Absolute file path (for GAP reporting).
 * @param index - The per-base variant index.
 * @returns New content, per-token counts, and any GAPs.
 */
function applyVarFallback(
    content: string,
    file: string,
    index: BaseVariantIndex
): { result: string; perToken: Map<string, number>; gaps: VarFallbackGap[] } {
    const perToken = new Map<string, number>();
    const gaps: VarFallbackGap[] = [];
    const replacements: VarFallbackReplacement[] = [];

    // Locate each `oklch(from var(--BASE,` then balance-parse var() + oklch().
    const opener = /oklch\(from\s+var\(\s*(--[a-z][a-z0-9-]*)\s*,/g;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop.
    while ((m = opener.exec(content)) !== null) {
        const oklchOpen = m.index + 'oklch'.length; // index of oklch's `(`
        const oklchClose = matchParen(content, oklchOpen);
        if (oklchClose === -1) continue;
        const varKeyword = content.indexOf('var', m.index);
        const varOpen = content.indexOf('(', varKeyword);
        const varClose = matchParen(content, varOpen);
        if (varClose === -1 || varClose > oklchClose) continue;

        const base = m[1].slice(2); // strip leading `--`
        const transform = content.slice(varClose + 1, oklchClose).trim();
        const original = content.slice(m.index, oklchClose + 1);

        const res = resolveTransform(base, transform, index);
        if (res.token) {
            replacements.push({ token: res.token, original });
        } else {
            const line = content.slice(0, m.index).split('\n').length;
            gaps.push({
                file,
                line,
                snippet: original.slice(0, 160).trim(),
                category: res.gap ?? 'var-fallback-lightness-gap',
                reason: res.reason ?? 'unresolved'
            });
        }
    }

    // Apply replacements (longest original first to avoid prefix shadowing).
    let result = content;
    const uniqueByOriginal = new Map<string, string>();
    for (const r of replacements) uniqueByOriginal.set(r.original, r.token);
    const ordered = [...uniqueByOriginal.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [original, token] of ordered) {
        const replacement = `var(--${token})`;
        let from = 0;
        let rebuilt = '';
        let count = 0;
        for (;;) {
            const idx = result.indexOf(original, from);
            if (idx === -1) {
                rebuilt += result.slice(from);
                break;
            }
            rebuilt += result.slice(from, idx);
            rebuilt += replacement;
            from = idx + original.length;
            count++;
        }
        result = rebuilt;
        if (count > 0) perToken.set(token, (perToken.get(token) ?? 0) + count);
    }

    return { result, perToken, gaps };
}

// ============================================================================
// File walking
// ============================================================================

/**
 * Recursively collect target files under a directory.
 *
 * @param dir - Directory to walk.
 * @returns Sorted list of absolute file paths matching EXTENSIONS.
 */
function collectFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        for (const name of readdirSync(current)) {
            const full = join(current, name);
            const st = statSync(full);
            if (st.isDirectory()) {
                if (name === 'node_modules' || name === 'dist') continue;
                walk(full);
            } else if (EXTENSIONS.some((ext) => name.endsWith(ext))) {
                out.push(full);
            }
        }
    };
    walk(dir);
    out.sort();
    return out;
}

// ============================================================================
// Replacement application (pure — returns new content + per-token counts)
// ============================================================================

/**
 * Apply all rules to a source string using exact-substring, longest-first
 * matching with non-overlapping advancement.
 *
 * @param content - Original file content.
 * @param rules - Longest-first-sorted replacement rules.
 * @returns New content and a per-token replacement count map.
 */
function applyRules(
    content: string,
    rules: ReadonlyArray<ReplacementRule>
): { result: string; perToken: Map<string, number> } {
    let result = content;
    const perToken = new Map<string, number>();

    for (const rule of rules) {
        if (!result.includes(rule.literal)) continue;
        let from = 0;
        let rebuilt = '';
        let count = 0;
        // Manual indexOf scan: consume the literal, append the replacement, then
        // advance past the inserted replacement so we never re-match it.
        for (;;) {
            const idx = result.indexOf(rule.literal, from);
            if (idx === -1) {
                rebuilt += result.slice(from);
                break;
            }
            rebuilt += result.slice(from, idx);
            rebuilt += rule.replacement;
            from = idx + rule.literal.length;
            count++;
        }
        result = rebuilt;
        if (count > 0) {
            perToken.set(rule.token, (perToken.get(rule.token) ?? 0) + count);
        }
    }

    return { result, perToken };
}

// ============================================================================
// Unmatched-occurrence scan + categorization
// ============================================================================

/**
 * Categorize an unmatched `oklch(from` occurrence from its line text.
 *
 * @param _lineText - The full source line containing the occurrence (reserved for future heuristics).
 * @param afterFrom - Substring starting at the `oklch(from` token.
 * @returns The best-guess category.
 */
function categorizeUnmatched(_lineText: string, afterFrom: string): UnmatchedCategory {
    // Dynamic JS template literal interpolation, e.g. var(--${x}) or / ${y})
    if (afterFrom.includes('${')) return 'dynamic-template-literal';
    // Literal-origin (not a var()), e.g. oklch(from white l c h / 0.75)
    if (/^oklch\(from\s+white\b/.test(afterFrom) || /^oklch\(from\s+black\b/.test(afterFrom)) {
        return 'oklch-from-white';
    }
    // var() with an inline CSS fallback: var(--x, FALLBACK)
    if (/oklch\(from\s+var\(--[a-z][a-z0-9-]*\s*,/.test(afterFrom)) return 'var-with-fallback';
    // Transparent alpha=0: ... / 0) with no fractional digits
    if (/\/\s*0\s*\)/.test(afterFrom)) return 'alpha-zero';
    return 'other';
}

/**
 * Scan content (already with matched literals removed) for residual
 * `oklch(from` occurrences and record their location + category.
 *
 * @param file - Absolute file path.
 * @param postReplaceContent - File content AFTER rule application.
 * @returns List of unmatched occurrences in this file.
 */
function scanUnmatched(file: string, postReplaceContent: string): UnmatchedOccurrence[] {
    const out: UnmatchedOccurrence[] = [];
    const lines = postReplaceContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        let searchFrom = 0;
        for (;;) {
            const idx = lineText.indexOf(OKLCH_FROM, searchFrom);
            if (idx === -1) break;
            const afterFrom = lineText.slice(idx);
            out.push({
                file,
                line: i + 1,
                snippet: afterFrom.slice(0, 120).trim(),
                category: categorizeUnmatched(lineText, afterFrom)
            });
            searchFrom = idx + OKLCH_FROM.length;
        }
    }
    return out;
}

/**
 * Count raw `oklch(from` occurrences in the ORIGINAL content (pre-replacement).
 *
 * @param content - Original file content.
 * @returns Number of `oklch(from` substrings.
 */
function countOklchFrom(content: string): number {
    let count = 0;
    let from = 0;
    for (;;) {
        const idx = content.indexOf(OKLCH_FROM, from);
        if (idx === -1) break;
        count++;
        from = idx + OKLCH_FROM.length;
    }
    return count;
}

// ============================================================================
// Report rendering
// ============================================================================

/**
 * Render the dry-run / apply report markdown.
 *
 * @param data - Aggregated results.
 * @returns Markdown string.
 */
function renderReport(data: {
    apply: boolean;
    totalOklchFrom: number;
    matchedTotal: number;
    changedFiles: FileMatchResult[];
    perTokenTotals: Map<string, number>;
    unmatched: UnmatchedOccurrence[];
    conflicts: Array<{ literal: string; tokens: string[] }>;
    ruleCount: number;
    fileCount: number;
}): string {
    const {
        apply,
        totalOklchFrom,
        matchedTotal,
        changedFiles,
        perTokenTotals,
        unmatched,
        conflicts,
        ruleCount,
        fileCount
    } = data;

    const lines: string[] = [];
    lines.push('# SPEC-176 T-005 — Codemod Report');
    lines.push('');
    lines.push(`- Mode: **${apply ? 'APPLY (files written)' : 'DRY-RUN (no source modified)'}**`);
    lines.push(`- Generated: ${new Date().toISOString()}`);
    lines.push(`- Files scanned under \`apps/web/src/\`: ${fileCount}`);
    lines.push(`- Replacement rules (replaces + replacesVariants): ${ruleCount}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Current total \`oklch(from\` occurrences: **${totalOklchFrom}**`);
    lines.push(`- Matched (would-replace) occurrences: **${matchedTotal}**`);
    lines.push(`- Files that would change: **${changedFiles.length}**`);
    lines.push(`- Unmatched occurrences: **${unmatched.length}**`);
    lines.push(
        `- Residual-after-apply estimate (total − matched): **${totalOklchFrom - matchedTotal}**` +
            ` (should equal unmatched = ${unmatched.length})`
    );
    const reconciles = totalOklchFrom - matchedTotal === unmatched.length;
    lines.push(`- Reconciles: **${reconciles ? 'YES' : 'NO — investigate'}**`);
    lines.push('');

    lines.push('## Conflicts (CRITICAL if any)');
    lines.push('');
    if (conflicts.length === 0) {
        lines.push('None. No literal is claimed by more than one token.');
    } else {
        lines.push('| Literal | Tokens claiming it |');
        lines.push('|---|---|');
        for (const c of conflicts) {
            lines.push(`| \`${c.literal}\` | ${c.tokens.join(', ')} |`);
        }
    }
    lines.push('');

    lines.push('## Top tokens by replacement frequency');
    lines.push('');
    const sortedTokens = [...perTokenTotals.entries()].sort((a, b) => b[1] - a[1]);
    lines.push('| Rank | Token | Replacements |');
    lines.push('|---|---|---|');
    sortedTokens.slice(0, 20).forEach(([token, n], i) => {
        lines.push(`| ${i + 1} | \`--${token}\` | ${n} |`);
    });
    lines.push('');

    lines.push('## Per-token totals (all matched tokens)');
    lines.push('');
    lines.push('| Token | Replacements |');
    lines.push('|---|---|');
    for (const [token, n] of sortedTokens) {
        lines.push(`| \`--${token}\` | ${n} |`);
    }
    lines.push('');

    lines.push('## Per-file breakdown (files that would change)');
    lines.push('');
    lines.push('| File | Total | Tokens (token×count) |');
    lines.push('|---|---|---|');
    for (const f of changedFiles) {
        const rel = relative(REPO_ROOT, f.file);
        const tokens = [...f.perToken.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => `${t}×${n}`)
            .join(', ');
        lines.push(`| \`${rel}\` | ${f.total} | ${tokens} |`);
    }
    lines.push('');

    lines.push('## Unmatched occurrences (residual after apply)');
    lines.push('');
    const byCategory = new Map<UnmatchedCategory, UnmatchedOccurrence[]>();
    for (const u of unmatched) {
        const list = byCategory.get(u.category) ?? [];
        list.push(u);
        byCategory.set(u.category, list);
    }
    lines.push('### Category counts');
    lines.push('');
    lines.push('| Category | Count |');
    lines.push('|---|---|');
    const categoryOrder: UnmatchedCategory[] = [
        'var-fallback-no-base',
        'var-fallback-alpha-gap',
        'var-fallback-lightness-gap',
        'var-with-fallback',
        'dynamic-template-literal',
        'oklch-from-white',
        'alpha-zero',
        'other'
    ];
    for (const cat of categoryOrder) {
        lines.push(`| ${cat} | ${byCategory.get(cat)?.length ?? 0} |`);
    }
    lines.push('');
    lines.push('### Full list (file:line — snippet)');
    lines.push('');
    for (const cat of categoryOrder) {
        const list = byCategory.get(cat);
        if (!list || list.length === 0) continue;
        lines.push(`#### ${cat} (${list.length})`);
        lines.push('');
        for (const u of list) {
            const rel = relative(REPO_ROOT, u.file);
            const reason = u.reason ? ` — **GAP**: ${u.reason}` : '';
            lines.push(`- \`${rel}:${u.line}\` — \`${u.snippet}\`${reason}`);
        }
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Run the codemod. DRY-RUN by default; `--apply` writes files.
 *
 * @returns Process exit code (0 on success).
 */
function main(): number {
    const apply = process.argv.includes('--apply');
    const { rules, conflicts } = buildRules(VARIANT_TOKEN_MAP);
    const baseIndex = buildBaseVariantIndex(VARIANT_TOKEN_MAP);
    const files = collectFiles(WEB_SRC);

    let totalOklchFrom = 0;
    let matchedTotal = 0;
    const changedFiles: FileMatchResult[] = [];
    const perTokenTotals = new Map<string, number>();
    const unmatched: UnmatchedOccurrence[] = [];

    for (const file of files) {
        const original = readFileSync(file, 'utf8');
        totalOklchFrom += countOklchFrom(original);

        // Pass 1: literal N->1 matching.
        const literalPass = applyRules(original, rules);
        // Pass 2: var-with-fallback normalization on the literal-pass output.
        const fallbackPass = applyVarFallback(literalPass.result, file, baseIndex);
        const result = fallbackPass.result;

        // Merge per-token counts from both passes.
        const perToken = new Map<string, number>(literalPass.perToken);
        for (const [token, n] of fallbackPass.perToken) {
            perToken.set(token, (perToken.get(token) ?? 0) + n);
        }
        const fileTotal = [...perToken.values()].reduce((a, b) => a + b, 0);

        if (fileTotal > 0) {
            matchedTotal += fileTotal;
            changedFiles.push({ file, perToken, total: fileTotal });
            for (const [token, n] of perToken) {
                perTokenTotals.set(token, (perTokenTotals.get(token) ?? 0) + n);
            }
            if (apply && result !== original) {
                writeFileSync(file, result, 'utf8');
            }
        }

        // GAPs from the var-fallback pass are categorized residuals.
        for (const g of fallbackPass.gaps) {
            unmatched.push({
                file: g.file,
                line: g.line,
                snippet: g.snippet,
                category: g.category,
                reason: g.reason
            });
        }
        // Generic residual scan: the var-fallback pass now OWNS every
        // `var(--x, ...)` occurrence (resolved -> replaced, unresolved -> a GAP
        // above). Drop the generic `var-with-fallback` category here to avoid
        // double-counting; keep all other residual categories.
        for (const occ of scanUnmatched(file, result)) {
            if (occ.category === 'var-with-fallback') continue;
            unmatched.push(occ);
        }
    }

    const report = renderReport({
        apply,
        totalOklchFrom,
        matchedTotal,
        changedFiles,
        perTokenTotals,
        unmatched,
        conflicts,
        ruleCount: rules.length,
        fileCount: files.length
    });
    writeFileSync(REPORT_PATH, report, 'utf8');

    // Console summary
    process.stdout.write(`SPEC-176 codemod — ${apply ? 'APPLY' : 'DRY-RUN'}\n`);
    process.stdout.write(`  files scanned: ${files.length}\n`);
    process.stdout.write(`  replacement rules: ${rules.length}\n`);
    process.stdout.write(`  total oklch(from: ${totalOklchFrom}\n`);
    process.stdout.write(`  matched (would-replace): ${matchedTotal}\n`);
    process.stdout.write(`  files that would change: ${changedFiles.length}\n`);
    process.stdout.write(`  unmatched: ${unmatched.length}\n`);
    process.stdout.write(
        `  residual-after-apply estimate: ${totalOklchFrom - matchedTotal} ` +
            `(reconciles=${totalOklchFrom - matchedTotal === unmatched.length})\n`
    );
    process.stdout.write(`  conflicts: ${conflicts.length}\n`);
    process.stdout.write(`  report: ${relative(REPO_ROOT, REPORT_PATH)}\n`);
    if (conflicts.length > 0) {
        process.stdout.write('  !! CRITICAL: literal claimed by multiple tokens — see report\n');
    }

    return 0;
}

process.exit(main());
