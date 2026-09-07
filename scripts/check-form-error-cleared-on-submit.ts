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
 *
 * ---------------------------------------------------------------------------
 * ANCHOR 2 — the hand-rolled banners (HOS-837, second pass)
 * ---------------------------------------------------------------------------
 *
 * Anchor 1 reaches only the 11 forms that use the shared hook. Roughly forty
 * more hold the same banner in a plain `useState` and are, by construction,
 * invisible to it. Anchor 2 covers those. Checks 4 and 5 implement it.
 *
 * The first instinct was to anchor on the name `formError`, since the six forms
 * that prompted this all use it. Measuring killed that: 50 inline banners exist
 * across `apps/web/src` under EIGHTEEN different identifiers — `error`,
 * `submitError`, `globalError`, `errorMsg`, `oauthError`, `loadError`,
 * `masterToggleError`, … A `formError` anchor would have covered 16 of 50 and
 * reported "all consumers clear it" over the other 34. That is a guard giving
 * confidence without coverage, which is worse than no guard.
 *
 * So anchor 2 contains NO NAME AT ALL. It is a SHAPE:
 *
 *     {x && ( … role="alert" … {x} … )}        ← this is a form-level banner
 *     const [x, setX] = useState<…>(null)      ← this is where it lives
 *
 * Both identifiers are read off the code. `x` comes from the render, its setter
 * from the destructuring — never derived by capitalising `x`, so a pair named
 * `[banner, raiseBanner]` is tracked as faithfully as `[formError,
 * setFormError]`. Renaming either one renames it in both places at once,
 * because they are the same binding, and the guard simply follows.
 *
 * That makes anchor 2 MORE rename-proof than anchor 1, which does hold a
 * literal name (`handleApiError`) and needs check 1 to defend it. What anchor 2
 * has instead of a shared symbol is a floor
 * ({@link MIN_EXPECTED_BANNER_CONSUMERS}), kept separate from anchor 1's so one
 * group cannot vanish behind the other's population.
 *
 * ---------------------------------------------------------------------------
 * WHAT ANCHOR 2 CANNOT SEE — stated plainly, not buried
 * ---------------------------------------------------------------------------
 *
 * A banner escapes anchor 2 silently if it is:
 *
 *  1. rendered through a component (`<Banner message={x} />`) instead of the
 *     inline conditional;
 *  2. rendered without `role="alert"` (also an accessibility bug, but nothing
 *     here catches it);
 *  3. held in a state MACHINE rather than a nullable string — which is exactly
 *     `ContactHost.client.tsx` (`submitState.phase === 'error'`). HOS-837 fixed
 *     that form's stale banner and pinned it with a regression test, because
 *     this guard genuinely does not reach it. One file is a test's job; a third
 *     anchor for one file would be an exemption list wearing a hat.
 *
 * Check 5 is also weaker than check 3 on purpose: it asks only that the banner
 * CAN be retired, not that it is retired first. See `scanBannerSources` for the
 * measurement behind that choice.
 *
 * The rename-proof answer to all three holes is the same one anchor 1 already
 * enjoys: give the state a shared owner. Migrating these forms onto
 * `useZodForm` (or a smaller shared banner primitive) would collapse anchor 2
 * into anchor 1 and delete this entire section. That is an architectural call
 * for the owner, not something this guard should decide.
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

/**
 * Rot alarm floor for ANCHOR 2 (see the header). 47 banners matched at
 * HOS-837; 25 leaves room for a batch of forms to be deleted or migrated onto
 * `useZodForm` without breaking CI, while still screaming if the render shape
 * stops matching the codebase. Kept SEPARATE from
 * {@link MIN_EXPECTED_CONSUMERS} on purpose: one mixed count would let a whole
 * group disappear behind the other group's population.
 */
export const MIN_EXPECTED_BANNER_CONSUMERS = 25;

/**
 * How far past `{x && (` to look for the rest of the banner shape. All 47 real
 * banners fit comfortably; one hand-formatted past this simply falls out of
 * scope, which the header states plainly as a limitation.
 */
const ALERT_WINDOW = 400;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'coverage', '.astro']);

/** A `useZodForm(...)` CALL — not the declaration, not a mention in prose. */
const USE_ZOD_FORM_CALL = /\buseZodForm\s*(?:<[^<>]*>)?\s*\(/;

/** The `handleApiError` identifier anywhere: destructured, aliased, or on the result object. */
const HANDLE_API_ERROR_IDENT = /\bhandleApiError\b/;

/** A `handleApiError(...)` call — the moment a banner can be set. */
const HANDLE_API_ERROR_CALL = /\bhandleApiError\s*\(/;

/** The clear: `setFormError(null)`, in any spacing. */
const CLEAR_CALL = /\bsetFormError\s*\(\s*null\s*\)/;

/** Opening of a conditional render, `{x && (`. The identifier is CAPTURED, never assumed. */
const CONDITIONAL_RENDER = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*&&\s*\(/g;

/**
 * A nullable `useState` pair. BOTH names are captured from the destructuring,
 * so neither the state nor its setter is ever assumed to be called anything.
 * The `(null)` initialiser is what separates an error banner from ordinary
 * string state — `const [message, setMessage] = useState('')` is a textarea's
 * contents, not a banner, and must not be dragged in by its name.
 */
const NULLABLE_STATE_PAIR =
    /const\s*\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]\s*=\s*useState\s*(?:<[^<>]*>)?\s*\(\s*null\s*\)/g;

/** A hook handing its state out: `return { a, b, c }`. */
const HOOK_RETURN_OBJECT = /return\s*\{([^{}]*)\}/g;

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
// ANCHOR 2 — hand-rolled banners, selected by SHAPE, never by name
// ---------------------------------------------------------------------------

/**
 * Identifiers this file renders as an inline form-level alert banner, i.e.
 * `{x && ( … role="alert" … {x} … )}`.
 *
 * The identifier must be BARE. A member expression (`fieldErrors.email &&`) is
 * a per-field message, not a form-level banner, and there are far more of those
 * than of banners — matching them would bury the signal.
 *
 * @param code - Comment-stripped source.
 * @returns The identifiers rendered as banners here.
 */
export function discoverAlertBannerIdents(code: string): Set<string> {
    const found = new Set<string>();
    CONDITIONAL_RENDER.lastIndex = 0;
    let m: RegExpExecArray | null = CONDITIONAL_RENDER.exec(code);
    while (m !== null) {
        const ident = m[1] as string;
        const window = code.slice(m.index + m[0].length, m.index + m[0].length + ALERT_WINDOW);
        if (window.includes('role="alert"') && window.includes(`{${ident}}`)) found.add(ident);
        m = CONDITIONAL_RENDER.exec(code);
    }
    return found;
}

/**
 * Identifiers this module hands out of a `return { … }` — how a custom hook
 * owns a banner whose render lives in a sibling component
 * (`use-video-section.ts` holds the state, `VideoSection.client.tsx` draws it).
 * Without this clause that pair falls between two chairs: the state file has no
 * render and the render file has no state.
 *
 * @param code - Comment-stripped source.
 * @returns Every identifier appearing in a flat return-object literal.
 */
export function discoverHandedOutIdents(code: string): Set<string> {
    const found = new Set<string>();
    HOOK_RETURN_OBJECT.lastIndex = 0;
    let m: RegExpExecArray | null = HOOK_RETURN_OBJECT.exec(code);
    while (m !== null) {
        for (const tok of (m[1] as string).match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) found.add(tok);
        m = HOOK_RETURN_OBJECT.exec(code);
    }
    return found;
}

/** A `useState` pair that can hold a banner message. */
export interface StatePair {
    /** The state identifier, as written. */
    readonly state: string;
    /** Its setter, as written — never derived by capitalising the state name. */
    readonly setter: string;
}

/**
 * Every `const [x, setX] = useState<…>(null)` pair in the file.
 *
 * @param code - Comment-stripped source.
 * @returns The pairs, in source order.
 */
export function findNullableStatePairs(code: string): StatePair[] {
    const out: StatePair[] = [];
    NULLABLE_STATE_PAIR.lastIndex = 0;
    let m: RegExpExecArray | null = NULLABLE_STATE_PAIR.exec(code);
    while (m !== null) {
        out.push({ state: m[1] as string, setter: m[2] as string });
        m = NULLABLE_STATE_PAIR.exec(code);
    }
    return out;
}

/**
 * Applies anchor 2 across the tree.
 *
 * A pair is in scope when the file either renders it as a banner itself, or
 * hands it out while SOME file in the tree renders it as one. That second
 * condition consults `globalBannerIdents` — a set discovered from the
 * codebase's own render sites, never a list written here.
 *
 * The requirement is deliberately weaker than anchor 3's: the setter must be
 * called with `null` SOMEWHERE in the file. Source order is not a sound proxy
 * for execution order at this scale — `ExternalReputationSection` alone owns
 * four independent banners with four separate operations — and six files whose
 * clear is perfectly correct sit textually below their first raise. Requiring
 * an order here would manufacture six false positives, and a false positive is
 * how an exemption list gets born.
 *
 * @param root - Repository root.
 * @param files - Absolute paths to inspect.
 * @returns Consumers found (`path [state]`) and violations among them.
 */
export function scanBannerSources(root: string, files: readonly string[]): ScanResult {
    const sources = new Map<string, string>();
    const globalBannerIdents = new Set<string>();
    const perFileBanners = new Map<string, Set<string>>();

    for (const file of files) {
        let body: string;
        try {
            body = stripComments(readFileSync(file, 'utf8'));
        } catch {
            continue;
        }
        sources.set(file, body);
        const rendered = discoverAlertBannerIdents(body);
        perFileBanners.set(file, rendered);
        for (const ident of rendered) globalBannerIdents.add(ident);
    }

    const consumers: string[] = [];
    const violations: string[] = [];

    for (const [file, code] of sources) {
        const relPath = relative(root, file).replace(/\\/g, '/');
        const renderedHere = perFileBanners.get(file) ?? new Set<string>();
        const handedOut = discoverHandedOutIdents(code);

        for (const { state, setter } of findNullableStatePairs(code)) {
            const inScope =
                renderedHere.has(state) || (handedOut.has(state) && globalBannerIdents.has(state));
            if (!inScope) continue;

            consumers.push(`${relPath} [${state}]`);
            const clears = new RegExp(`\\b${setter}\\s*\\(\\s*null\\s*\\)`).test(code);
            if (!clears) {
                violations.push(
                    `  ${relPath}: renders a form-level banner from \`${state}\` but never calls \`${setter}(null)\``
                );
            }
        }
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
    console.log('=== Checking every form-level error banner can be retired (HOS-837) ===\n');

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

    const banner = scanBannerSources(root, files);

    console.log(
        `\n4. The banner shape still selects hand-rolled forms (floor: ${MIN_EXPECTED_BANNER_CONSUMERS})...`
    );
    if (banner.consumers.length < MIN_EXPECTED_BANNER_CONSUMERS) {
        console.log(
            `ERROR: only ${banner.consumers.length} hand-rolled banner(s) matched, expected at least ${MIN_EXPECTED_BANNER_CONSUMERS}.`
        );
        console.log(
            '\n  Anchor 2 has no shared symbol to fall back on — this floor IS its rot alarm. ' +
                'Either the banners moved to a different render shape, or they migrated onto ' +
                '`useZodForm` (in which case lower the floor and check they show up under check 2).'
        );
        failed = true;
    } else {
        console.log(`  OK — ${banner.consumers.length} hand-rolled banner(s) under the guard.`);
    }

    console.log('\n5. Every hand-rolled banner can be retired...');
    if (banner.violations.length > 0) {
        console.log('ERROR: a banner can be raised and never taken down:');
        for (const v of banner.violations) console.log(v);
        console.log(
            '\n  A message that nothing can clear survives the attempt it described. Clear it ' +
                'as the operation STARTS, the way every other hand-rolled form here already ' +
                'does. HOS-816 is what happens without it: the user saves successfully and ' +
                'reads a red banner telling them it failed.'
        );
        failed = true;
    } else {
        console.log(`  OK — all ${banner.consumers.length} can be cleared.`);
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
