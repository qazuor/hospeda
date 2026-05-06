#!/usr/bin/env node
/**
 * @file check-css-tokens.cjs
 * @description Static lint rule that detects usage of undefined CSS custom
 * properties in apps/web/src. The web app's design tokens live in
 * `src/styles/global.css`. Any `var(--token)` reference in source files must
 * resolve to a token defined there (in `:root` or a theme override block
 * such as `[data-theme="dark"]`). Anything else silently breaks dark mode
 * and visual consistency.
 *
 * Exit code:
 *   0 -> no undefined tokens found
 *   1 -> at least one undefined token, or fatal error reading files
 *
 * Usage: node apps/web/scripts/check-css-tokens.cjs
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const APP_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(APP_ROOT, 'src');
const TOKENS_FILE = path.join(SRC_ROOT, 'styles', 'global.css');

const SOURCE_EXTS = new Set(['.astro', '.css', '.tsx', '.ts']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', '.turbo', '.vercel']);

/**
 * Parse the canonical tokens defined in global.css.
 *
 * @param {string} filePath Absolute path to global.css.
 * @returns {Set<string>} Set of defined token names without the leading `--`.
 */
function parseDefinedTokens(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '');

    const defined = new Set();
    const declRegex = /(^|[{;\s])--([a-zA-Z0-9_-]+)\s*:/g;
    let m = declRegex.exec(stripped);
    while (m !== null) {
        defined.add(m[2]);
        m = declRegex.exec(stripped);
    }
    return defined;
}

/**
 * Walk a directory and yield every source file path that should be checked.
 *
 * @param {string} dir Directory to walk.
 * @returns {string[]} Array of absolute file paths.
 */
function collectSourceFiles(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
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
 * Strip block comments so commented `var(--token)` usages are not flagged.
 *
 * @param {string} source Raw file content.
 * @returns {string} Source with block comments replaced by whitespace.
 */
function stripBlockComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
        .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length));
}

/**
 * Find every `var(--token...)` reference in a source file.
 *
 * @param {string} filePath Absolute path to the source file.
 * @param {Set<string>} defined Set of valid token names.
 * @returns {{ file: string, line: number, column: number, token: string }[]}
 */
function findUndefinedTokens(filePath, defined) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const cleaned = stripBlockComments(raw);
    const findings = [];

    const usageRegex = /var\(\s*--([a-zA-Z0-9_-]+)/g;
    let match = usageRegex.exec(cleaned);
    while (match !== null) {
        const token = match[1];
        if (!defined.has(token)) {
            const offset = match.index;
            const before = cleaned.slice(0, offset);
            const lineNumber = before.split('\n').length;
            const lastNl = before.lastIndexOf('\n');
            const column = offset - (lastNl + 1) + 1;
            findings.push({
                file: path.relative(APP_ROOT, filePath),
                line: lineNumber,
                column,
                token
            });
        }
        match = usageRegex.exec(cleaned);
    }
    return findings;
}

function main() {
    if (!fs.existsSync(TOKENS_FILE)) {
        console.error(`[check-css-tokens] cannot find tokens file: ${TOKENS_FILE}`);
        process.exit(1);
    }

    const defined = parseDefinedTokens(TOKENS_FILE);
    const files = collectSourceFiles(SRC_ROOT).filter(
        (f) => path.resolve(f) !== path.resolve(TOKENS_FILE)
    );

    // Component-local CSS custom properties may be defined anywhere in the
    // source tree: `--name:` declarations inside .astro/.tsx style blocks,
    // inline `style="--name: ..."` props, or .module.css rules. Collect every
    // such definition across the source tree and treat them as also-valid.
    const componentLocal = new Set();
    const localDeclRegex = /(?:^|[{;\s>"'`])--([a-zA-Z0-9_-]+)\s*:/g;
    for (const file of files) {
        let raw;
        try {
            raw = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        const stripped = stripBlockComments(raw);
        let m = localDeclRegex.exec(stripped);
        while (m !== null) {
            componentLocal.add(m[1]);
            m = localDeclRegex.exec(stripped);
        }
    }
    const allDefined = new Set([...defined, ...componentLocal]);

    const allFindings = [];
    for (const file of files) {
        const findings = findUndefinedTokens(file, allDefined);
        if (findings.length > 0) allFindings.push(...findings);
    }

    if (allFindings.length === 0) {
        console.log(
            `[check-css-tokens] OK - scanned ${files.length} files, ${defined.size} global tokens + ${componentLocal.size} component-local properties, 0 undefined references.`
        );
        process.exit(0);
    }

    const byFile = new Map();
    for (const f of allFindings) {
        if (!byFile.has(f.file)) byFile.set(f.file, []);
        byFile.get(f.file).push(f);
    }

    console.error(
        `[check-css-tokens] FAIL - ${allFindings.length} undefined token references in ${byFile.size} files:\n`
    );
    for (const [file, findings] of byFile) {
        for (const f of findings) {
            console.error(`  ${file}:${f.line}:${f.column}  var(--${f.token})`);
        }
    }
    console.error(
        '\nFix: ensure each token is defined in apps/web/src/styles/global.css (under :root or a theme block), or correct the token name to one of the defined values.'
    );
    process.exit(1);
}

main();
