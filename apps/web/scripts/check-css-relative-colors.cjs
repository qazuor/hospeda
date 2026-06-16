#!/usr/bin/env node
/**
 * @file check-css-relative-colors.cjs
 * @description SPEC-176 T-001 — CI guard that detects inline relative-color
 * expressions in the web app source tree.
 *
 * Scans `apps/web/src/` recursively for `.astro`, `.css`, `.tsx`, and `.ts`
 * files. Strips block comments before scanning to avoid false positives from
 * commented-out code. Counts occurrences of the literal `oklch(from` pattern,
 * which identifies CSS relative-color syntax (Chrome 119+ only).
 *
 * Exit codes:
 *   0 — occurrences match the documented allowlist exactly (expected final state)
 *   1 — a NON-allowlisted occurrence exists, OR an allowlisted file's count
 *       drifted from its expected value (new violation, or a residual was
 *       removed without updating the allowlist).
 *
 * Allowlist (T-011): after the T-005 codemod swapped 658 static call-sites to
 * precomputed `var(--token)` references, 16 occurrences remain that CANNOT be
 * statically tokenized — the base color and/or alpha is resolved at RUNTIME:
 *
 *   - lib/colors.ts (4): generic helpers; both the `var(--${cssToken})` base and
 *     the alpha/lightness are caller-supplied at runtime (incl. non-alpha
 *     lightness ops `min(l, 0.6)`).
 *   - components/GlobalAnnouncements.astro (2): base is a hardcoded hex literal
 *     (`#ef4444`), not a `var(--token)` — no static token to map to.
 *   - components/ShareButtons.module.css (1): base is `var(--primary, <fallback>)`,
 *     an undefined alias with an inline oklch fallback.
 *   - components/shared/cards/EventCardFeatured.astro (3): base is
 *     `var(--event-cat-bg, ...)`, a CSS var injected at runtime per event category.
 *   - components/account/CollectionCard.tsx (3): base is a JS template `${color}`
 *     where `color` is arbitrary user-chosen collection color from the API.
 *   - components/account/SubscriptionDashboard.module.css (2): base is
 *     `var(--primary, <fallback>)`, same undefined-alias case as ShareButtons.
 *   - pages/500.astro (1): SVG fill is `oklch(from ${destructiveColor} ...)` with
 *     destructiveColor interpolated in the Astro frontmatter at runtime.
 *
 * These degrade on Chrome <119 (the badge/overlay tint falls back to the
 * browser default for an unresolved relative color) — an accepted cosmetic
 * residual per PDR §10 / Edge Case 6. The allowlist is COUNT-PINNED per file so
 * a NEW `oklch(from` (regression) or a removed residual still fails CI.
 *
 * Only `apps/web/src/` is scanned. The generated artifact
 * `packages/design-tokens/dist/tokens.css` is NOT in scope — it intentionally
 * contains `oklch(from` inside `@supports` blocks, which is correct behavior.
 *
 * Usage: node apps/web/scripts/check-css-relative-colors.cjs
 * Or via npm script: pnpm --filter hospeda-web check:relative-colors
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ============================================================================
// Constants
// ============================================================================

const APP_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(APP_ROOT, 'src');

/** File extensions to scan. */
const SOURCE_EXTS = new Set(['.astro', '.css', '.tsx', '.ts']);

/** Directories to skip when walking the source tree. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.turbo', '.vercel', '__snapshots__']);

/** The pattern that identifies CSS relative-color syntax (Chrome 119+ only). */
const PATTERN = 'oklch(from';

/**
 * Count-pinned allowlist of un-tokenizable runtime-dynamic residuals (T-011).
 * Keys are paths relative to `apps/web/`; values are the EXACT expected number
 * of `oklch(from` occurrences. A file at its expected count passes; any drift
 * (new occurrence, or a residual removed without updating this map) fails so the
 * residual set stays frozen and reviewed. See the file header for the rationale
 * behind each entry.
 *
 * @type {Readonly<Record<string, number>>}
 */
const ALLOWLIST = Object.freeze({
    'src/lib/colors.ts': 4,
    'src/components/GlobalAnnouncements.astro': 2,
    'src/components/ShareButtons.module.css': 1,
    'src/components/shared/cards/EventCardFeatured.astro': 3,
    'src/components/account/CollectionCard.tsx': 3,
    // SPEC-203: subtle primary/accent tints + a modal overlay on the plan-management
    // surface. No precomputed alpha tokens exist (only --ring-a50), so these follow
    // the same theme-adaptive oklch(from var(--token) ...) residual pattern as the
    // other allowlisted account components.
    'src/components/account/SubscriptionDashboard.module.css': 4,
    'src/components/account/PlanChangeFlow.module.css': 1,
    'src/components/account/PlanPicker.module.css': 4,
    // 500 error page: SVG fill uses `oklch(from ${destructiveColor} ...)` where
    // destructiveColor is interpolated in the Astro frontmatter at runtime.
    'src/pages/500.astro': 1
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Walk a directory tree and return every source file path that should be
 * checked. Skips directories listed in SKIP_DIRS.
 *
 * @param {string} dir - Absolute path to the directory to walk.
 * @returns {string[]} Array of absolute file paths.
 */
function collectSourceFiles(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        /** @type {import('node:fs').Dirent[]} */
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            // Unreadable directory — skip silently.
            continue;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                stack.push(full);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (SOURCE_EXTS.has(ext)) out.push(full);
            }
        }
    }
    return out;
}

/**
 * Strip block comments (`/* ... *\/` and `<!-- ... -->`) and `@supports (...)`
 * feature-detection conditions from source content before scanning.
 *
 * Block comments are stripped to avoid counting commented-out code. `@supports`
 * conditions are stripped because an `oklch(from ...)` inside a `@supports (...)`
 * probe is the EXACT mechanism this system uses to gate the modern oklch path
 * (e.g. `@supports (background-color: oklch(from white l c h / 0.95)) { ... }`).
 * That is correct, intended usage — not an unguarded relative color — so it must
 * not count as a violation. Only the parenthesized condition is blanked; the
 * block body is left intact so any real violation inside it is still caught.
 *
 * Mirrors the approach used in the sibling `check-css-tokens.cjs` script.
 *
 * @param {string} source - Raw file content.
 * @returns {string} Content with comments + @supports conditions blanked to
 *   equal-length whitespace (offsets preserved).
 */
function stripBlockComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
        .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length))
        .replace(/@supports\s*\([^{]*\)/g, (match) => ' '.repeat(match.length));
}

/**
 * Count occurrences of PATTERN in a string.
 *
 * @param {string} content - Cleaned (comment-stripped) file content.
 * @returns {number} Number of occurrences found.
 */
function countOccurrences(content) {
    let count = 0;
    let pos = content.indexOf(PATTERN);
    while (pos !== -1) {
        count++;
        pos = content.indexOf(PATTERN, pos + PATTERN.length);
    }
    return count;
}

// ============================================================================
// Main
// ============================================================================

/**
 * Entry point. Scans the web source tree for `oklch(from` patterns, prints
 * a summary, and exits with code 0 (clean) or 1 (violations found).
 */
function main() {
    if (!fs.existsSync(SRC_ROOT)) {
        process.stderr.write(
            `[check-css-relative-colors] FATAL: source directory not found: ${SRC_ROOT}\n`
        );
        process.exit(1);
    }

    const files = collectSourceFiles(SRC_ROOT);

    /** @type {Map<string, number>} Observed count per relative file path. */
    const observed = new Map();

    for (const filePath of files) {
        /** @type {string} */
        let raw;
        try {
            raw = fs.readFileSync(filePath, 'utf8');
        } catch {
            process.stderr.write(
                `[check-css-relative-colors] WARNING: could not read ${filePath} — skipping\n`
            );
            continue;
        }

        const cleaned = stripBlockComments(raw);
        const count = countOccurrences(cleaned);
        if (count > 0) {
            observed.set(path.relative(APP_ROOT, filePath), count);
        }
    }

    // Classify each observed file against the count-pinned allowlist.
    /** @type {string[]} Hard failures: new files, or counts above the allowed. */
    const failures = [];
    for (const [file, count] of observed) {
        const allowed = ALLOWLIST[file] ?? 0;
        if (count > allowed) {
            const extra = allowed === 0 ? count : count - allowed;
            failures.push(
                `  ${file}  (${count} occurrence${count === 1 ? '' : 's'}${
                    allowed === 0 ? ', not allowlisted' : `, allowlisted ${allowed} — ${extra} NEW`
                })`
            );
        }
    }

    // Stale allowlist entries: a residual was removed (or the file deleted) but
    // the allowlist still expects it. Surface so the allowlist stays honest.
    /** @type {string[]} */
    const stale = [];
    for (const [file, allowed] of Object.entries(ALLOWLIST)) {
        const count = observed.get(file) ?? 0;
        if (count < allowed) {
            stale.push(
                `  ${file}  (allowlisted ${allowed}, found ${count} — reduce the allowlist)`
            );
        }
    }

    if (failures.length === 0 && stale.length === 0) {
        const allowedTotal = Object.values(ALLOWLIST).reduce((a, b) => a + b, 0);
        process.stdout.write(
            `[check-css-relative-colors] OK — scanned ${files.length} files. ` +
                `${allowedTotal} allowlisted runtime-dynamic residual(s), 0 new "${PATTERN}" occurrences.\n`
        );
        process.exit(0);
    }

    if (failures.length > 0) {
        process.stdout.write(
            `[check-css-relative-colors] FAIL — new \`${PATTERN}\` occurrence(s) detected. Replace with a precomputed var(--token-aNN) reference (run the codemod), or, if genuinely runtime-dynamic, update the ALLOWLIST in this script.\n\n`
        );
        for (const line of failures) process.stdout.write(`${line}\n`);
        process.stdout.write('\n');
    }
    if (stale.length > 0) {
        process.stdout.write(
            '[check-css-relative-colors] FAIL — stale allowlist entr(y/ies): a residual was ' +
                'removed but the allowlist still counts it. Lower the count in ALLOWLIST.\n\n'
        );
        for (const line of stale) process.stdout.write(`${line}\n`);
        process.stdout.write('\n');
    }
    process.exit(1);
}

main();
