/**
 * @file check-no-native-dialogs.ts
 * @description HOS-957 — fails CI when `apps/web` (or a workspace package it
 * ships to the browser) asks the user something through a NATIVE browser
 * dialog: `confirm()`, `alert()` or `prompt()`.
 *
 * Five call sites raised one. Each of them shows the site's bare domain above
 * the question, cannot be styled, sits outside the app's focus management and
 * scroll lock, and — the part that is a plain bug rather than a blemish —
 * labels its own buttons in the BROWSER's language while the message beside
 * them was a hard-coded Spanish string. `/en/` and `/pt/` got a Spanish
 * question with English buttons. `window.prompt('URL del enlace', …)` in the
 * rich-text toolbar was the worst of them: it asked for a VALUE, in Spanish,
 * from every locale.
 *
 * The replacements already existed for the yes/no case
 * (`lib/forms/show-confirmation-dialog.tsx` and
 * `components/shared/ui/ConfirmDeleteDialog.client.tsx`); HOS-957 added
 * `components/host/editor/LinkUrlDialog.client.tsx` for the value case. This
 * guard is what stops the inventory from filling back up — there is precedent
 * in this repo for a hand-fixed chain of call sites regrowing in the very next
 * pull request, and none of these five is caught by a type, a lint rule or a
 * test.
 *
 * ## What it asserts
 *
 * 1. No native dialog call in production code under any scan root (below).
 * 2. Every exemption in `EXEMPTIONS` is still EXACT: the file exists and holds
 *    precisely the budgeted number of native calls. Fewer means the exemption
 *    outlived its subject and is now a hole nobody is watching; more means a
 *    second call slipped in under an entry granted for the first. An exemption
 *    that only sets a ceiling is how a fail-open gets in.
 * 3. Every declared scan root exists and contributed at least one file, and the
 *    scan as a whole cleared a floor. A guard that silently matches nothing —
 *    wrong cwd, a moved directory, a renamed extension — prints "no violations"
 *    in exactly the same words as a clean tree, which is the worst possible
 *    outcome for a guard.
 *
 * ## Where it looks, and where it does not
 *
 * IN: `apps/web/src`, plus the `src/` of every `@repo/*` workspace package
 * `apps/web` depends on — read from the app's own `package.json` rather than
 * hard-coded, because the set changes without anyone thinking about dialogs.
 * The package half is not decoration: HOS-958's guard watched only
 * `apps/web/src` and a `<dialog>` from `@repo/feedback`, mounted on every page
 * of the site, stayed outside its scan for five rounds. A shared package can
 * put a `confirm()` on every page the same way. Measured when this guard was
 * written: zero native calls in any of them, so the scope costs nothing today
 * and closes the door.
 *
 * OUT, deliberately:
 *  - **`apps/admin`.** It has four bare `confirm(` call sites of its own and
 *    resolves them with Shadcn in HOS-1198, which is in flight in parallel.
 *    Widening this guard now would fail CI on `staging` for work that is
 *    somebody else's. The regex already recognises the bare form, so the day
 *    HOS-1198 lands, adding `apps/admin/src` to `SCAN_ROOTS` is the whole
 *    change.
 *  - **`apps/api`** and anything else server-side, where these identifiers are
 *    not globals at all.
 *  - **Test files** (`*.test.*`, `*.spec.*`, anything under `test/`, `tests/`
 *    or `__tests__/`). A test legitimately proves that `alert(1)` in a URL is
 *    neutralised, and a component test may stub `window.confirm`.
 *  - **`scripts/`** — including this file, which necessarily names all three.
 *
 * ## Why it is anchored where it is
 *
 * On the three platform identifiers, which is the one thing a native dialog
 * cannot be written without. They belong to the browser, so unlike a project
 * symbol they cannot be renamed out from under the guard — the failure mode
 * that killed guards anchored on a function name. What CAN rot here is the
 * SCAN, so assertion 3 exists.
 *
 * The regexes are anchored on both sides. Unanchored, `confirm(` matches inside
 * `confirmDelete(`, and `.confirm(` matches `promise.confirm(` — a method on
 * somebody's object, not the browser's.
 *
 * ## Code, comment, string
 *
 * The predicate reads a MASKED copy of each file in which comment bodies and
 * string contents are blanked, offsets preserved. Without it the JSDoc in the
 * very files this guard protects — `ConfirmDeleteDialog.client.tsx` explains at
 * length why `window.confirm()` is wrong — would be read as code, and the guard
 * would fail on the prose describing the fix. Template-literal `${…}`
 * interpolations are NOT blanked: they are code.
 *
 * ## What it cannot see (stated, not hidden)
 *
 *  - A call reached through an alias (`const ask = window.confirm; ask(x)`) or
 *    through `Reflect`/`eval`. Bracket access on a known global
 *    (`window['confirm']`) IS caught, because that is the one evasion someone
 *    reaches for by accident.
 *  - `confirm(` written in the TEXT of an `.astro` template rather than in its
 *    script — it is not inside a string literal there, so it is not masked, and
 *    it would be reported. That direction is a false positive, not a hole.
 *  - A regex literal containing `confirm(`. The masker's regex-vs-division
 *    heuristic is the standard one and is not a parser.
 *
 * Run: `pnpm check:no-native-dialogs`
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The three dialogs the browser owns. */
export const NATIVE_DIALOGS = ['confirm', 'alert', 'prompt'] as const;

/** Globals a native dialog can legitimately be reached through. */
const GLOBAL_OBJECTS = ['window', 'globalThis', 'self'] as const;

/** File extensions that can carry browser code. */
const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx,mjs,cjs,astro}';

/** Directories that never hold production source. */
const IGNORED_GLOBS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.astro/**',
    '**/.turbo/**',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.d.ts'
];

/**
 * Files allowed to call a native dialog, and EXACTLY how many calls each may
 * make. Both directions fail — see assertion 2 in the file header.
 *
 * The single entry is the `catch` arm of the imperative replacement itself.
 * `showConfirmationDialog()` mounts a throwaway React root through
 * `await import('react-dom/client')`; if that chunk never arrives the promise
 * would never settle, and every consumer of this helper guards a navigation on
 * it — so the page would silently swallow every subsequent link click instead
 * of asking. Degrading to the native confirm keeps the user asked. It is the
 * last-resort fallback of the thing that replaces the native dialog, so it
 * cannot itself be replaced by it.
 */
export const EXEMPTIONS: ReadonlyMap<string, number> = new Map([
    ['apps/web/src/lib/forms/show-confirmation-dialog.tsx', 1]
]);

/**
 * Floor on the total number of files scanned. Measured at 2,479 when this guard
 * was written; the floor sits well below that so ordinary churn does not trip
 * it, and far enough above zero that a scan which lost a root cannot pass.
 *
 * The sharper half of the same assertion is per-root: every declared root must
 * exist and contribute at least one file, which catches a moved directory even
 * when the other roots keep the total high.
 */
export const MIN_SCANNED_FILES = 1800;

// ---------------------------------------------------------------------------
// Scan roots
// ---------------------------------------------------------------------------

/**
 * Workspace packages `apps/web` depends on, as absolute `src` directories.
 *
 * Read from the app's own manifest rather than hard-coded: a `confirm()`
 * reaching the page from a shared package is outside `apps/web/src` and so
 * outside every other assertion here, and the set of such packages changes
 * without anyone thinking about dialogs.
 *
 * @param root - Repository root.
 * @returns Absolute paths, sorted.
 */
export function webWorkspacePackageRoots(root: string): readonly string[] {
    const manifestPath = resolve(root, 'apps/web/package.json');
    const wanted = new Set(
        [...readFileSync(manifestPath, 'utf8').matchAll(/"(@repo\/[a-z0-9-]+)"\s*:\s*"workspace:/g)]
            .map((m) => m[1])
            .filter((name): name is string => name !== undefined)
    );

    const dirs: string[] = [];
    for (const pkgJson of globSync('packages/*/package.json', { cwd: root, absolute: true })) {
        const name = /"name"\s*:\s*"([^"]+)"/.exec(readFileSync(pkgJson, 'utf8'))?.[1];
        if (name === undefined || !wanted.has(name)) continue;
        const src = resolve(dirname(pkgJson), 'src');
        if (existsDirectory(src)) dirs.push(src);
    }
    return dirs.sort();
}

/** True when `path` exists and is a directory. */
function existsDirectory(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Every directory this guard scans, as absolute paths.
 *
 * @param root - Repository root.
 * @returns The app root first, then each workspace package's `src`.
 */
export function scanRoots(root: string): readonly string[] {
    return [resolve(root, 'apps/web/src'), ...webWorkspacePackageRoots(root)];
}

/**
 * Source files under one root.
 *
 * @param dir - Absolute directory to scan.
 * @returns Absolute file paths, sorted.
 */
export function collectSourceFiles(dir: string): readonly string[] {
    return globSync(SOURCE_GLOB, { cwd: dir, absolute: true, ignore: IGNORED_GLOBS }).sort();
}

// ---------------------------------------------------------------------------
// Masking: code is what is left after comments and string bodies are blanked
// ---------------------------------------------------------------------------

/**
 * Blanks comment bodies and string contents, preserving every character's
 * offset so a position computed on the result still lines up with the original.
 *
 * Handles JS line and block comments, HTML comments (`.astro` templates),
 * single/double-quoted strings, and template literals — whose `${…}`
 * interpolations are deliberately left INTACT, because they are code. Regex
 * literals are skipped whole using the standard "a regex can only start where a
 * value is expected" heuristic.
 *
 * @param source - Raw file contents.
 * @returns The same string with comment and string bodies replaced by spaces.
 */
export function maskCommentsAndStrings(source: string): string {
    const out = source.split('');
    // Stack of open template literals, so `${ … }` nesting is tracked.
    const templateStack: number[] = [];
    let braceDepth = 0;
    let i = 0;
    let prevSignificant = '';

    const blank = (from: number, to: number): void => {
        for (let k = from; k < to && k < out.length; k++) {
            if (out[k] !== '\n') out[k] = ' ';
        }
    };

    while (i < source.length) {
        const ch = source[i] as string;
        const next = source[i + 1];

        // Closing a `${ … }` puts us back inside the template literal.
        if (ch === '}' && templateStack.length > 0 && braceDepth === templateStack.at(-1)) {
            templateStack.pop();
            i = maskQuoted(source, out, i, '`', templateStack, () => braceDepth);
            prevSignificant = '`';
            continue;
        }
        if (ch === '{') braceDepth += 1;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);

        if (ch === '/' && next === '/') {
            let end = source.indexOf('\n', i);
            if (end === -1) end = source.length;
            blank(i, end);
            i = end;
            continue;
        }

        if (ch === '/' && next === '*') {
            let end = source.indexOf('*/', i + 2);
            end = end === -1 ? source.length : end + 2;
            blank(i, end);
            i = end;
            continue;
        }

        if (ch === '<' && source.startsWith('<!--', i)) {
            let end = source.indexOf('-->', i + 4);
            end = end === -1 ? source.length : end + 3;
            blank(i, end);
            i = end;
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') {
            i = maskQuoted(source, out, i, ch, templateStack, () => braceDepth);
            prevSignificant = ch;
            continue;
        }

        // A `/` that opens a regex literal rather than a division: a regex can
        // only start where a VALUE is expected, never right after an
        // identifier, a number or a closing bracket.
        if (ch === '/' && !/[\w$)\]]/.test(prevSignificant)) {
            i = skipRegex(source, i);
            prevSignificant = '/';
            continue;
        }

        if (!/\s/.test(ch)) prevSignificant = ch;
        i++;
    }

    return out.join('');
}

/**
 * Blanks the body of a quoted literal opened at `start`, leaving the quotes
 * themselves in place. A template literal stops at an unescaped `${`, pushing
 * the current brace depth so the interpolation is scanned as code.
 *
 * @param source - Raw contents.
 * @param out - Mutable output characters.
 * @param start - Index of the opening quote.
 * @param quote - The opening character.
 * @param templateStack - Brace depths of the enclosing interpolations.
 * @param braceDepth - Reads the scanner's current brace depth.
 * @returns Index to resume scanning from.
 */
function maskQuoted(
    source: string,
    out: string[],
    start: number,
    quote: string,
    templateStack: number[],
    braceDepth: () => number
): number {
    let i = start + 1;
    while (i < source.length) {
        const ch = source[i] as string;
        if (ch === '\\') {
            if (out[i] !== '\n') out[i] = ' ';
            if (i + 1 < source.length && out[i + 1] !== '\n') out[i + 1] = ' ';
            i += 2;
            continue;
        }
        if (quote === '`' && ch === '$' && source[i + 1] === '{') {
            templateStack.push(braceDepth());
            // Resume as code just past `${`; the `{` is consumed here so the
            // main loop's depth bookkeeping stays balanced with the pushed value.
            return i + 2;
        }
        if (ch === quote) return i + 1;
        // An unterminated non-template string cannot span lines.
        if (ch === '\n' && quote !== '`') return i;
        if (ch !== '\n') out[i] = ' ';
        i++;
    }
    return i;
}

/**
 * Advances past a regex literal opened at `start`, honouring escapes and
 * character classes so `/[/]/` does not terminate early.
 *
 * @param source - Raw contents.
 * @param start - Index of the opening slash.
 * @returns Index just past the closing slash.
 */
function skipRegex(source: string, start: number): number {
    let i = start + 1;
    let inClass = false;
    while (i < source.length) {
        const ch = source[i];
        if (ch === '\\') {
            i += 2;
            continue;
        }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) return i + 1;
        else if (ch === '\n') return i;
        i++;
    }
    return i;
}

// ---------------------------------------------------------------------------
// The predicate
// ---------------------------------------------------------------------------

const DIALOG_ALTERNATION = NATIVE_DIALOGS.join('|');
const GLOBAL_ALTERNATION = GLOBAL_OBJECTS.join('|');

/**
 * `window.confirm(` / `globalThis?.prompt(` / `self . alert (`.
 *
 * Left-anchored on a word boundary so `myWindow.confirm(` does not match, and
 * right-anchored on the `(` so a bare mention of `window.confirm` in code (a
 * `typeof` probe, a spy target) is not a CALL.
 */
const QUALIFIED_CALL = new RegExp(
    `(?<![\\w$.])(?:${GLOBAL_ALTERNATION})\\s*\\??\\s*\\.\\s*(${DIALOG_ALTERNATION})\\s*\\(`,
    'g'
);

/**
 * A bare `confirm(` — the form `apps/admin` uses, and the one a rename of the
 * enclosing helper would not disturb. Left-anchored so `confirmDelete(` and
 * `x.confirm(` are both excluded.
 *
 * The second lookbehind is variable-length on purpose: `window . confirm(` is
 * legal formatting, and a fixed `(?<![\w$.])` only inspects the character
 * immediately before the identifier — which is a SPACE there. Without it the
 * same call is reported twice, once by each rule.
 */
const BARE_CALL = new RegExp(`(?<![\\w$.])(?<!\\.\\s{0,32})(${DIALOG_ALTERNATION})\\s*\\(`, 'g');

/**
 * `window['confirm'](` — bracket access on a known global. Matched against the
 * RAW source, since the quoted member name is blanked in the masked copy.
 * Restricted to the three globals so an ordinary `styles['alert']` is untouched.
 */
const BRACKET_CALL = new RegExp(
    `(?<![\\w$.])(?:${GLOBAL_ALTERNATION})\\s*\\??\\s*\\[\\s*['"\`](${DIALOG_ALTERNATION})['"\`]\\s*\\]\\s*\\(`,
    'g'
);

/** One native dialog call found in a file. */
export interface DialogCall {
    /** Which dialog: `confirm`, `alert` or `prompt`. */
    readonly kind: string;
    /** 1-based line number in the original source. */
    readonly line: number;
    /** The matched text, for the report. */
    readonly text: string;
}

/** 1-based line number of `index` within `source`. */
function lineOf(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < source.length; i++) {
        if (source[i] === '\n') line += 1;
    }
    return line;
}

/**
 * Every native dialog CALL in one file.
 *
 * @param source - Raw file contents.
 * @returns The calls found, in source order.
 */
export function findNativeDialogCalls(source: string): readonly DialogCall[] {
    const masked = maskCommentsAndStrings(source);
    const seen = new Set<number>();
    const calls: DialogCall[] = [];

    const collect = (re: RegExp, haystack: string): void => {
        re.lastIndex = 0;
        let match = re.exec(haystack);
        while (match !== null) {
            const kind = match[1] ?? '';
            // Keyed on where the IDENTIFIER sits, not where the match starts:
            // `window . confirm(` is one call that two rules can legitimately
            // reach from different offsets, and two distinct calls can never
            // share an identifier position.
            const key = match.index + match[0].indexOf(kind);
            if (!seen.has(key)) {
                seen.add(key);
                calls.push({
                    kind,
                    line: lineOf(source, match.index),
                    text: match[0].replace(/\s+/g, ' ')
                });
            }
            match = re.exec(haystack);
        }
    };

    collect(QUALIFIED_CALL, masked);
    collect(BARE_CALL, masked);
    // The only rule that reads the RAW source: the member name it looks for
    // lives inside a string, which the masker (correctly) blanked.
    collect(BRACKET_CALL, source);

    return calls.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------
// Repository scan
// ---------------------------------------------------------------------------

/** What one root contributed. */
export interface RootScan {
    /** Repo-relative path of the root. */
    readonly root: string;
    /** How many files it yielded. */
    readonly files: number;
}

/** Outcome of a whole-repository scan. */
export interface RepoScan {
    readonly roots: readonly RootScan[];
    readonly scanned: number;
    /** Human-readable violation lines. */
    readonly violations: readonly string[];
    /** Exemption bookkeeping problems (assertion 2). */
    readonly exemptionErrors: readonly string[];
}

/**
 * Scans every root and applies the exemptions.
 *
 * @param root - Repository root.
 * @returns The scan outcome (see {@link RepoScan}).
 */
export function scanRepo(root: string): RepoScan {
    const roots: RootScan[] = [];
    const violations: string[] = [];
    const exemptionErrors: string[] = [];
    const exemptionHits = new Map<string, number>();
    let scanned = 0;

    for (const dir of scanRoots(root)) {
        const relRoot = relative(root, dir) || '.';
        if (!existsDirectory(dir)) {
            exemptionErrors.push(
                `  scan root does not exist: ${relRoot} — this guard cannot watch what it cannot find`
            );
            roots.push({ root: relRoot, files: 0 });
            continue;
        }

        const files = collectSourceFiles(dir);
        roots.push({ root: relRoot, files: files.length });
        scanned += files.length;

        for (const file of files) {
            const relPath = relative(root, file).split('\\').join('/');
            const calls = findNativeDialogCalls(readFileSync(file, 'utf8'));
            if (calls.length === 0) continue;

            if (EXEMPTIONS.has(relPath)) {
                exemptionHits.set(relPath, calls.length);
                continue;
            }
            for (const call of calls) {
                violations.push(`  ${relPath}:${call.line}: \`${call.text}\``);
            }
        }
    }

    for (const [file, budget] of EXEMPTIONS) {
        const found = exemptionHits.get(file) ?? 0;
        if (found === budget) continue;
        exemptionErrors.push(
            found === 0
                ? `  ${file}: exempted for ${budget} native call(s) and has none — the exemption outlived its subject; delete the entry`
                : `  ${file}: exempted for ${budget} native call(s), found ${found} — an exemption is exact, not a ceiling`
        );
    }

    return { roots, scanned, violations, exemptionErrors };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Runs every check and prints a report.
 *
 * @param root - Repository root.
 * @returns Process exit code (0 pass, 1 fail).
 */
export function run(root: string): number {
    console.log('=== Checking apps/web raises no native browser dialog (HOS-957) ===\n');

    const scan = scanRepo(root);
    let failed = false;

    console.log('1. The scan reached every declared root...');
    const emptyRoots = scan.roots.filter((r) => r.files === 0);
    if (emptyRoots.length > 0) {
        console.log('ERROR: a scan root contributed no files:');
        for (const r of emptyRoots) console.log(`  ${r.root}`);
        console.log(
            '\n  A root that yields nothing reports "no violations" in the same words as a ' +
                'clean tree. Either the directory moved, or the extensions this guard reads ' +
                'no longer describe the code there. Re-point SCAN_ROOTS in ' +
                'scripts/check-no-native-dialogs.ts.'
        );
        failed = true;
    } else {
        for (const r of scan.roots) console.log(`  ${r.root}: ${r.files} file(s)`);
        console.log(`  OK — ${scan.roots.length} root(s), all non-empty.`);
    }

    console.log(`\n2. The scan cleared its floor (${MIN_SCANNED_FILES})...`);
    if (scan.scanned < MIN_SCANNED_FILES) {
        console.log(
            `ERROR: only ${scan.scanned} file(s) scanned, expected at least ${MIN_SCANNED_FILES}.`
        );
        console.log(
            '\n  Either the app shrank dramatically or this guard stopped seeing most of it. ' +
                'Confirm the second is not true before lowering the floor.'
        );
        failed = true;
    } else {
        console.log(`  OK — ${scan.scanned} file(s) scanned.`);
    }

    console.log('\n3. Every exemption is still exact...');
    if (scan.exemptionErrors.length > 0) {
        console.log('ERROR: the exemption list no longer matches the tree:');
        for (const e of scan.exemptionErrors) console.log(e);
        failed = true;
    } else {
        console.log(`  OK — ${EXEMPTIONS.size} exemption(s), each matching its budget.`);
    }

    console.log('\n4. No native dialog in production code...');
    if (scan.violations.length > 0) {
        console.log('ERROR: a native browser dialog is back:');
        for (const v of scan.violations) console.log(v);
        console.log(
            "\n  `confirm()` / `alert()` / `prompt()` show the site's bare domain, cannot be " +
                "styled, sit outside the app's focus trap and scroll lock, and label their own " +
                "buttons in the BROWSER's language — so a Spanish question ships to /en/ and " +
                '/pt/ with English buttons. Use one of:\n' +
                '    • `showConfirmationDialog()`  (lib/forms) — imperative yes/no inside a handler\n' +
                '    • `<ConfirmDeleteDialog>`     (components/shared/ui) — a destructive action\n' +
                '                                    that stays on the page while it runs\n' +
                '    • `<LinkUrlDialog>`           (components/host/editor) — asking for a VALUE\n' +
                '  All three are localized and composed from the shared `Dialog` primitive.'
        );
        failed = true;
    } else {
        console.log('  OK — none found.');
    }

    console.log('');
    if (failed) {
        console.log('FAILED — fix the issues above before merging.');
        return 1;
    }
    console.log('All checks passed.');
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    process.exit(run(REPO_ROOT));
}
