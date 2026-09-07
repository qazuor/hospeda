#!/usr/bin/env tsx
/**
 * check-form-error-cleared-on-submit.ts — HOS-837 (guarding HOS-816)
 *
 * `useZodForm`'s `handleApiError` only ever SETS the form-level banner. Nothing
 * in the hook ever clears it, so a form that does not clear it itself carries
 * the previous attempt's rejection into every later submit: the user fixes the
 * problem, saves successfully, and reads a red banner telling them it failed.
 * No error, no warning — just a message that outlived what it was about.
 *
 * PR #3041 added the missing `setFormError(null)` to the two commerce forms;
 * HOS-837 added it to `EventCreateForm` and `PostCreateForm`, the last two
 * consumers still missing it. This guard is what stops the next one from being
 * born without it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD ASSERTS — nothing more, nothing less
 * ---------------------------------------------------------------------------
 *
 * Check 1 — the anchor still exists.
 *   `apps/web/src/lib/forms/use-zod-form.ts` must still declare BOTH
 *   `handleApiError` and `setFormError` on `UseZodFormResult`. If either is
 *   renamed or removed, checks 2 and 3 below would quietly stop matching
 *   anything and this guard would report green while checking nothing. That is
 *   the classic way a static guard dies: anchored on a name, killed by a
 *   rename, and the PR doing the renaming never sees it fail. Here it fails
 *   loudly and tells you to re-anchor.
 *
 * Check 2 — the anchor still matches a plausible number of consumers.
 *   A second, weaker net under check 1: if the population of in-scope files
 *   collapses below MIN_EXPECTED_CONSUMERS, the selection rule has rotted even
 *   though the two names survived (e.g. every form migrated behind a wrapper
 *   hook). This is a rot ALARM, not an inventory — it is deliberately far
 *   below the real count so deleting a form never breaks it.
 *
 * Check 3 — every in-scope file clears the banner, before it can set one.
 *   In scope = the file CALLS `useZodForm(` and mentions the `handleApiError`
 *   identifier. Both conditions come from the shared hook's public API, never
 *   from the name of a submit handler — see "ON THE ANCHOR" below.
 *
 * ---------------------------------------------------------------------------
 * ON THE ANCHOR — why `handleApiError`, and why it survives a rename
 * ---------------------------------------------------------------------------
 *
 * The obvious anchor is the submit handler: find `handleSubmit`, check its
 * first statements. It is also the wrong one. Renaming `handleSubmit` to
 * `onSave` (or wrapping it in `useCallback`, or splitting it in two) leaves the
 * guard matching nothing and reporting success — the bug it was written for
 * walks straight past it, and the PR that renamed the handler sees a green CI.
 *
 * `handleApiError` is different: it is not a local name a form chose, it is a
 * member of the shared hook's result object. A form that shows an API-error
 * banner CANNOT avoid it — it is the only thing in `useZodForm` that turns an
 * API response into `formError`. So:
 *
 *  - Renaming the form's submit handler: the anchor is untouched. The guard
 *    keeps evaluating the file and keeps detecting a missing clear.
 *  - Destructuring differently (`const form = useZodForm(...)`, then
 *    `form.handleApiError(...)`): still matched — selection looks for the
 *    IDENTIFIER anywhere in the file, not for a destructuring pattern.
 *  - Renaming `handleApiError` itself: that is a change to
 *    `use-zod-form.ts`'s exported interface, and check 1 fails on it in the
 *    same PR. The guard cannot rot silently; it can only rot loudly.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT ASSERT
 * ---------------------------------------------------------------------------
 *
 * It does not verify the clear sits at the top of the submit handler. Doing so
 * would mean identifying the handler, which is precisely the coupling rejected
 * above. What it can check without naming a handler is ORDER: the first
 * `setFormError(null)` must appear before the first `handleApiError(` call. In
 * a correct form the clear opens the submit and the error handling sits in the
 * failure branch below it; a clear placed only in the success branch — a real
 * and easy mistake, and the same bug — lands after it and is rejected.
 *
 * It also does not accept `reset()` as a clear, even though `reset()` does
 * clear `formError`. `reset` is too common a name to match safely (a native
 * `formRef.current.reset()` has nothing to do with the banner), and accepting
 * it would open a hole wider than the convenience is worth. No consumer uses
 * it today. If one legitimately needs to, call `setFormError(null)` explicitly
 * alongside it, or teach this guard about that specific call form.
 *
 * ---------------------------------------------------------------------------
 * NO EXEMPTION LIST — BY CONSTRUCTION
 * ---------------------------------------------------------------------------
 *
 * There is no allowlist and no opt-out, because the selection rule does not
 * need one. Measured against `origin/staging` @ d81df29cf: 26 files under
 * `apps/web/src` mention `useZodForm`, and 15 of them are not forms with an
 * API-error banner at all — `field-ids.ts` constant tables, `*.helpers.ts`
 * modules, editor sections that only render `fieldErrors`, and forms whose
 * validation is purely client-side (`ContactHost`, `CommentThreadIsland`,
 * `CreatePropertyMiniForm`, `CreateEditCollectionModal`, `CalendarProviderRow`).
 * All 15 fall out of scope naturally: the first ten never CALL `useZodForm(`
 * (they only name it in prose), and the last five never mention
 * `handleApiError`, because they have no API banner to leave behind.
 *
 * An exemption list is a promise to revisit that nobody keeps. If a file ever
 * needs one here, the selection rule is wrong and should be fixed instead.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
export const REPO_ROOT = resolve(HERE, '..');

/** The hook that owns the banner. Excluded from the scan; checked by check 1. */
export const HOOK_FILE = 'apps/web/src/lib/forms/use-zod-form.ts';

/** Where forms live. */
const SCAN_ROOT = 'apps/web/src';

/**
 * Rot alarm floor for check 2 (see the header). Deliberately well under the
 * real population (11 at HOS-837) so that deleting a form or two never trips
 * it — it exists to catch the anchor matching NOTHING, not to freeze a count.
 */
export const MIN_EXPECTED_CONSUMERS = 5;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'coverage', '.astro']);

/** A `useZodForm(...)` CALL — not the declaration, not a mention in prose. */
const USE_ZOD_FORM_CALL = /\buseZodForm\s*(?:<[^<>]*>)?\s*\(/;

/** The `handleApiError` identifier anywhere: destructured, aliased, or on the result object. */
const HANDLE_API_ERROR_IDENT = /\bhandleApiError\b/;

/** A `handleApiError(...)` call — the moment a banner can be set. */
const HANDLE_API_ERROR_CALL = /\bhandleApiError\s*\(/;

/** The clear: `setFormError(null)`, in any spacing. */
const CLEAR_CALL = /\bsetFormError\s*\(\s*null\s*\)/;

// ---------------------------------------------------------------------------
// Comment stripping
// ---------------------------------------------------------------------------

/**
 * Blanks out line and block comments, preserving every other character's
 * offset so positions computed on the result still line up with the original.
 *
 * String, template and regex literals are tracked so a `//` inside one of them
 * never starts a comment — without this, the module docs in these very files
 * ("`handleApiError` only ever SETS a message") would be read as code and every
 * ordering verdict would be decided by prose.
 *
 * @param source - Raw file contents.
 * @returns The same string with comment bodies replaced by spaces/newlines.
 */
export function stripComments(source: string): string {
    const out = source.split('');
    let i = 0;
    // Last significant character seen, to tell a regex literal from a division.
    let prevSignificant = '';

    const blank = (from: number, to: number): void => {
        for (let k = from; k < to && k < out.length; k++) {
            if (out[k] !== '\n') out[k] = ' ';
        }
    };

    while (i < source.length) {
        const ch = source[i] as string;
        const next = source[i + 1];

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

        if (ch === '"' || ch === "'" || ch === '`') {
            i = skipLiteral(source, i, ch);
            prevSignificant = ch;
            continue;
        }

        // A `/` that opens a regex literal rather than a division. Standard
        // heuristic: a regex can only start where a VALUE is expected, i.e.
        // never right after an identifier, a number, or a closing bracket.
        if (ch === '/' && !/[\w$)\]]/.test(prevSignificant)) {
            i = skipLiteral(source, i, '/');
            prevSignificant = '/';
            continue;
        }

        if (!/\s/.test(ch)) prevSignificant = ch;
        i++;
    }

    return out.join('');
}

/**
 * Advances past a quoted literal opened at `start`, honouring backslash
 * escapes. Character classes inside a regex literal are honoured too, so
 * `/[/]/` does not terminate early.
 *
 * @param source - Raw file contents.
 * @param start - Index of the opening quote/slash.
 * @param quote - The opening character.
 * @returns Index just past the closing character (or end of input).
 */
function skipLiteral(source: string, start: number, quote: string): number {
    let i = start + 1;
    let inClass = false;
    while (i < source.length) {
        const ch = source[i];
        if (ch === '\\') {
            i += 2;
            continue;
        }
        if (quote === '/' && ch === '[') inClass = true;
        else if (quote === '/' && ch === ']') inClass = false;
        else if (ch === quote && !inClass) return i + 1;
        // An unterminated string cannot span lines (a template can).
        else if (ch === '\n' && quote !== '`') return i;
        i++;
    }
    return i;
}

// ---------------------------------------------------------------------------
// The predicate
// ---------------------------------------------------------------------------

/** Verdict for one file. */
export interface FileVerdict {
    /** Whether the file is a `useZodForm` consumer that can set an API banner. */
    readonly inScope: boolean;
    /** Human-readable reason the file fails, or `null` when it passes. */
    readonly violation: string | null;
}

/**
 * Decides whether one source file is in scope and, if so, whether it clears the
 * banner before it can set one.
 *
 * @param source - Raw file contents (comments are stripped internally).
 * @returns The verdict — see {@link FileVerdict}.
 */
export function inspectSource(source: string): FileVerdict {
    const code = stripComments(source);

    const inScope = USE_ZOD_FORM_CALL.test(code) && HANDLE_API_ERROR_IDENT.test(code);
    if (!inScope) return { inScope: false, violation: null };

    const clearAt = code.search(CLEAR_CALL);
    if (clearAt === -1) {
        return {
            inScope: true,
            violation:
                'sets an API-error banner via handleApiError but never calls setFormError(null)'
        };
    }

    const setAt = code.search(HANDLE_API_ERROR_CALL);
    if (setAt !== -1 && clearAt > setAt) {
        return {
            inScope: true,
            violation:
                'calls setFormError(null) only AFTER handleApiError(...) — the clear has to open the submit, not trail the failure branch'
        };
    }

    return { inScope: true, violation: null };
}

/**
 * Check 1 — the hook still declares both anchor members on its result type.
 *
 * @param root - Repository root.
 * @returns Error lines; empty when the anchor is intact.
 */
export function checkAnchorIntact(root: string): string[] {
    const errors: string[] = [];
    let body: string;
    try {
        body = readFileSync(join(root, HOOK_FILE), 'utf8');
    } catch {
        return [`  ${HOOK_FILE}: file does not exist — this guard's anchor is gone.`];
    }

    for (const member of ['handleApiError', 'setFormError'] as const) {
        const declared = new RegExp(`readonly\\s+${member}\\s*:`).test(body);
        if (!declared) {
            errors.push(`  ${HOOK_FILE}: UseZodFormResult no longer declares "${member}".`);
        }
    }

    return errors;
}

/**
 * Collects production `.ts`/`.tsx` sources under `apps/web/src`, minus the hook
 * itself and test files.
 *
 * @param root - Repository root.
 * @returns Absolute file paths.
 */
export function collectSourceFiles(root: string): string[] {
    const out: string[] = [];
    const hookAbs = resolve(root, HOOK_FILE);

    const walk = (dir: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry)) continue;
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(entry)) continue;
            if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
            if (/\.d\.ts$/.test(entry)) continue;
            if (resolve(full) === hookAbs) continue;
            out.push(full);
        }
    };

    walk(join(root, SCAN_ROOT));
    return out.sort();
}

/** Result of scanning the repository. */
export interface ScanResult {
    /** Repo-relative paths of every in-scope consumer. */
    readonly consumers: string[];
    /** One line per offending consumer. */
    readonly violations: string[];
}

/**
 * Applies {@link inspectSource} to every collected file.
 *
 * @param root - Repository root.
 * @param files - Absolute paths to inspect.
 * @returns The consumers found and the violations among them.
 */
export function scanSources(root: string, files: readonly string[]): ScanResult {
    const consumers: string[] = [];
    const violations: string[] = [];

    for (const file of files) {
        let body: string;
        try {
            body = readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        const verdict = inspectSource(body);
        if (!verdict.inScope) continue;

        const relPath = relative(root, file).replace(/\\/g, '/');
        consumers.push(relPath);
        if (verdict.violation) violations.push(`  ${relPath}: ${verdict.violation}`);
    }

    return { consumers, violations };
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
    console.log('=== Checking every useZodForm banner is cleared on submit (HOS-837) ===\n');

    let failed = false;

    console.log('1. The hook still declares handleApiError/setFormError...');
    const anchorErrors = checkAnchorIntact(root);
    if (anchorErrors.length > 0) {
        console.log("ERROR: this guard's anchor rotted:");
        for (const e of anchorErrors) console.log(e);
        console.log(
            '\n  This guard selects files by those two names. With either renamed it would ' +
                'match nothing and pass while checking nothing, so it fails here instead. ' +
                'Re-anchor scripts/check-form-error-cleared-on-submit.ts on the new names.'
        );
        failed = true;
    } else {
        console.log(`  OK — ${HOOK_FILE} declares both.`);
    }

    const files = collectSourceFiles(root);
    const { consumers, violations } = scanSources(root, files);

    console.log(`\n2. The anchor still selects consumers (floor: ${MIN_EXPECTED_CONSUMERS})...`);
    if (consumers.length < MIN_EXPECTED_CONSUMERS) {
        console.log(
            `ERROR: only ${consumers.length} consumer(s) matched under ${SCAN_ROOT}, expected at least ${MIN_EXPECTED_CONSUMERS}.`
        );
        console.log(
            '\n  Either the selection rule stopped matching real forms, or the forms moved. ' +
                'Both mean this guard is no longer watching what it claims to watch.'
        );
        failed = true;
    } else {
        console.log(`  OK — ${consumers.length} consumer(s) under the guard.`);
    }

    console.log('\n3. Every consumer clears the banner before it can set one...');
    if (violations.length > 0) {
        console.log('ERROR: a form leaves the previous attempt’s API banner on screen:');
        for (const v of violations) console.log(v);
        console.log(
            '\n  `handleApiError` only ever SETS the banner — nothing in `useZodForm` clears ' +
                'it. Open the submit handler with `setFormError(null)`, before any early ' +
                'return, so a submit that only fails client-side validation retires the ' +
                'previous attempt’s message too. `CommerceCreateForm.client.tsx` is the ' +
                'reference shape. HOS-816 is what happens without it: the user saves ' +
                'successfully and reads a red banner telling them it failed.'
        );
        failed = true;
    } else {
        console.log(`  OK — all ${consumers.length} clear it.`);
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
