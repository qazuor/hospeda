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
 *   0 — no `oklch(from` occurrences found (post-codemod / expected final state)
 *   1 — at least one occurrence found (pre-codemod or regression introduced)
 *
 * Current state (T-001): the web source has ~679 violations. This script is
 * EXPECTED to exit 1 right now. After T-005 (codemod) runs and replaces all
 * 679 call-sites with `var(--token)` references, this script will exit 0.
 * The script is wired into CI in T-013 via `apps/web/package.json`.
 *
 * Allowlist: only `apps/web/src/` is scanned. The generated artifact
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
 * Strip block comments (`/* ... *\/` and `<!-- ... -->`) from source content
 * to avoid counting occurrences that are commented out.
 *
 * Mirrors the approach used in the sibling `check-css-tokens.cjs` script.
 *
 * @param {string} source - Raw file content.
 * @returns {string} Content with block comments replaced by equal-length whitespace.
 */
function stripBlockComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
        .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length));
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

    /** @type {{ file: string; count: number }[]} */
    const violations = [];
    let totalOccurrences = 0;

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
            violations.push({ file: path.relative(APP_ROOT, filePath), count });
            totalOccurrences += count;
        }
    }

    if (violations.length === 0) {
        process.stdout.write(
            `[check-css-relative-colors] OK — scanned ${files.length} files, 0 "${PATTERN}" occurrences found.\n`
        );
        process.exit(0);
    }

    process.stdout.write(
        `[check-css-relative-colors] FAIL — Found ${totalOccurrences} \`${PATTERN}\` occurrences in ${violations.length} files. Fix: run codemod-relative-colors.mjs\n\n`
    );
    for (const v of violations) {
        process.stdout.write(`  ${v.file}  (${v.count} occurrence${v.count === 1 ? '' : 's'})\n`);
    }
    process.stdout.write('\n');
    process.exit(1);
}

main();
