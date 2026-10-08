/**
 * @file check-fake-lies.ts
 * @description GUARD:G15 (HOS-1352 program, built by B1 / HOS-1510, AC:B1:9,
 * TEST:B1:9, DEC-TEST-003): the fake payment provider's lies are a CLOSED list,
 * and a test that turns one off says which and why.
 *
 * ## Predicate (a): the fake lies only from the closed list, each row whole
 *
 * - The list is `packages/payments/src/fake/fake-lists.json` (`lies`). Every row
 *   carries its three data: its name; the matrix rows it comes from, each with
 *   a date (`YYYY-MM-DD`) and at least one account; and the test that proves our
 *   code resists it (`defenseTest`, `TEST:<piece>:<n>`). A row without one of
 *   them fails.
 * - In the fake's code (`packages/payments/src/fake/`, tests excluded), a lie is
 *   told only through `.lying({ lie: '<id>' })`, with the id as a literal. A
 *   call whose id is not a literal, an id that is not a row of the list, the
 *   same id told in two places, and a lie id named anywhere else in that code
 *   (`'M3'` outside such a call) all fail.
 *
 * ## Predicate (b): a lie is turned off only by naming it and saying why
 *
 * In every code file under `apps/` and `packages/`, TESTS INCLUDED (they are
 * the subject), except the fake's own folder, every `honestAbout` must be
 * written in place as `honestAbout: [{ lie: '<id of the list>', why: '<text>' }, …]`:
 * an array literal of object literals, each with exactly those two keys, both
 * string literals, the id a row of the list and the reason not blank. A
 * variable, a spread, a missing key or a blank reason fails.
 *
 * One file is not read by (b): `packages/payments/test/fake-switches.test.ts`,
 * the test of the RUNTIME twin of this predicate (the fake refuses the same
 * options when it is built). It must write the very refusals (b) catches, so it
 * cannot pass (b); `scripts/__tests__/check-fake-lies.test.ts` proves (b) still
 * catches them everywhere else.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - A lie hand-written into the fake WITHOUT `.lying(…)`: a behaviour is not a
 *   name. That rule is held by review and by TEST:B1:13, whose cases turn each
 *   lie off by name and see the honest path come back.
 * - Simulations (`simulate: [...]`): they are not lies and G15 does not count
 *   them (`B/20` §3.2); the fake refuses an unnamed one at runtime.
 * - The provider's own rules (RP): not lies, never turned off.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a scan too small to trust.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    lineOf,
    listCodeFiles,
    listProductionFiles,
    type MaskedSource,
    maskSource,
    matchingClose,
    PAYMENTS_FAKE_DIR,
    skipSpace
} from './payments-guard-scan.js';

/** Fewer files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** The closed lists, by repo-relative path. */
export const FAKE_LISTS_FILE = 'packages/payments/src/fake/fake-lists.json';

/** The test of the runtime twin of predicate (b): not read by (b). */
export const RUNTIME_CHECK_TEST = 'packages/payments/test/fake-switches.test.ts';

/** One offending occurrence. */
export interface Violation {
    readonly predicate: 'a' | 'b';
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

/** What each predicate means. */
export const PREDICATE_MESSAGES: Readonly<Record<'a' | 'b', string>> = {
    a:
        'GUARD:G15 (a): the fake lies only from the closed list, each lie in one place, each row ' +
        'with its three data (name; matrix rows with date and account; the test proving our code ' +
        'resists it).',
    b:
        'GUARD:G15 (b): a test turns a lie off only by naming it and saying why, written in place: ' +
        "honestAbout: [{ lie: '<id of the list>', why: '<reason>' }]."
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIE_ID = /^M\d+$/;
const DEFENSE_TEST = /^TEST:[A-Za-z0-9]+:\d+$/;
const KEY = /^\s*([A-Za-z_$][\w$]*)\s*:\s*/;

const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim() === '';

/**
 * Predicate (a) over the list: every lie row has its three data.
 *
 * @param args.raw - The parsed JSON (or anything)
 * @returns The lie ids, and one violation per incomplete row
 */
export function checkLieRows(args: { readonly raw: unknown }): {
    readonly ids: readonly string[];
    readonly violations: readonly Violation[];
} {
    const at = (detail: string): Violation => ({
        predicate: 'a',
        file: FAKE_LISTS_FILE,
        line: 1,
        detail
    });
    const lies = (args.raw as { lies?: unknown } | null)?.lies;
    if (!Array.isArray(lies)) return { ids: [], violations: [at('the list has no `lies` array')] };
    const violations: Violation[] = [];
    const ids: string[] = [];
    for (const [index, row] of lies.entries()) {
        const r = (row ?? {}) as Record<string, unknown>;
        const label = typeof r.id === 'string' ? r.id : `row ${index + 1}`;
        if (typeof r.id !== 'string' || !LIE_ID.test(r.id)) {
            violations.push(at(`${label}: its id is not M<n>`));
            continue;
        }
        if (ids.includes(r.id)) violations.push(at(`${label}: listed twice`));
        ids.push(r.id);
        if (isBlank(r.name)) violations.push(at(`${label}: no name`));
        const measured = Array.isArray(r.measured) ? r.measured : [];
        const whole = measured.every((m) => {
            const entry = (m ?? {}) as Record<string, unknown>;
            return (
                !isBlank(entry.row) &&
                typeof entry.date === 'string' &&
                DATE.test(entry.date) &&
                Array.isArray(entry.accounts) &&
                entry.accounts.length > 0 &&
                entry.accounts.every((account) => !isBlank(account))
            );
        });
        if (measured.length === 0 || !whole) {
            violations.push(at(`${label}: no matrix row with its date and account`));
        }
        if (typeof r.defenseTest !== 'string' || !DEFENSE_TEST.test(r.defenseTest)) {
            violations.push(at(`${label}: no test proving our code resists it`));
        }
    }
    return { ids, violations };
}

/** The `{ … }` argument of a call opening at `open`, as offsets, if it is one. */
function objectArgument(args: { readonly code: string; readonly open: number }) {
    const start = skipSpace({ code: args.code, at: args.open + 1 });
    if (args.code[start] !== '{') return undefined;
    const end = matchingClose({ code: args.code, open: start });
    return end === -1 ? undefined : { start, end };
}

/** The top-level comma-separated parts of `[from, to)` (masked code), as offsets. */
function topLevelParts(args: {
    readonly code: string;
    readonly from: number;
    readonly to: number;
}): readonly { readonly start: number; readonly end: number }[] {
    const parts: { start: number; end: number }[] = [];
    let depth = 0;
    let start = args.from;
    for (let k = args.from; k <= args.to; k += 1) {
        const c = args.code[k];
        if (k < args.to && (c === '{' || c === '[' || c === '(')) depth += 1;
        if (k < args.to && (c === '}' || c === ']' || c === ')')) depth -= 1;
        if (k === args.to || (c === ',' && depth === 0)) {
            if (args.code.slice(start, k).trim() !== '') parts.push({ start, end: k });
            start = k + 1;
        }
    }
    return parts;
}

/**
 * The properties of an object literal whose braces are at `start`/`end`, each
 * value read as a string literal when it is exactly one.
 */
function literalProperties(args: {
    readonly masked: MaskedSource;
    readonly start: number;
    readonly end: number;
}): readonly { readonly key: string | undefined; readonly value: string | undefined }[] {
    const { code } = args.masked;
    return topLevelParts({ code, from: args.start + 1, to: args.end }).map((part) => {
        const text = code.slice(part.start, part.end);
        const key = KEY.exec(text);
        if (!key) return { key: undefined, value: undefined };
        const valueAt = skipSpace({ code, at: part.start + key[0].length });
        const literal = args.masked.strings.find((s) => s.start === valueAt);
        const onlyThat = literal !== undefined && code.slice(literal.end, part.end).trim() === '';
        return { key: key[1], value: onlyThat ? literal.value : undefined };
    });
}

/**
 * Predicate (a) over one file of the fake.
 *
 * @param args.file - Repo-relative path
 * @param args.source - The file text
 * @param args.ids - The lie ids of the list
 * @returns The ids told in this file (one entry per call), and the violations
 */
export function findLies(args: {
    readonly file: string;
    readonly source: string;
    readonly ids: readonly string[];
}): { readonly told: readonly string[]; readonly violations: readonly Violation[] } {
    const masked = maskSource({ source: args.source });
    const { code } = masked;
    const told: string[] = [];
    const violations: Violation[] = [];
    const named = new Set<number>();
    const report = (offset: number, detail: string) =>
        violations.push({
            predicate: 'a',
            file: args.file,
            line: lineOf({ source: args.source, offset }),
            detail
        });
    for (const match of code.matchAll(/\.\s*lying\s*\(/g)) {
        const open = match.index + match[0].length - 1;
        const argument = objectArgument({ code, open });
        const props = argument ? literalProperties({ masked, ...argument }) : [];
        const lie = props.length === 1 && props[0]?.key === 'lie' ? props[0].value : undefined;
        if (!argument || lie === undefined) {
            report(match.index, 'a lie told without its name as a literal: lying({ lie: ... })');
            continue;
        }
        const literal = masked.strings.find(
            (s) => s.start > argument.start && s.end <= argument.end
        );
        if (literal) named.add(literal.start);
        if (!args.ids.includes(lie))
            report(match.index, `tells '${lie}', which is not in the list`);
        told.push(lie);
    }
    for (const literal of masked.strings) {
        if (LIE_ID.test(literal.value) && !named.has(literal.start)) {
            report(literal.start, `names the lie '${literal.value}' outside a lying({ lie }) call`);
        }
    }
    return { told, violations };
}

/**
 * Predicate (b) over one file.
 *
 * @param args.file - Repo-relative path
 * @param args.source - The file text
 * @param args.ids - The lie ids of the list
 * @returns One violation per `honestAbout` that does not name its lies and say why
 */
export function findUnnamedHonesty(args: {
    readonly file: string;
    readonly source: string;
    readonly ids: readonly string[];
}): readonly Violation[] {
    if (!args.source.includes('honestAbout')) return [];
    const masked = maskSource({ source: args.source });
    const { code } = masked;
    const violations: Violation[] = [];
    for (const match of code.matchAll(/\bhonestAbout\b/g)) {
        const report = (detail: string) =>
            violations.push({
                predicate: 'b',
                file: args.file,
                line: lineOf({ source: args.source, offset: match.index }),
                detail
            });
        const colon = skipSpace({ code, at: match.index + match[0].length });
        const open = code[colon] === ':' ? skipSpace({ code, at: colon + 1 }) : -1;
        const close = open === -1 || code[open] !== '[' ? -1 : matchingClose({ code, open });
        if (close === -1) {
            report('honestAbout is not an array literal written in place');
            continue;
        }
        for (const entry of topLevelParts({ code, from: open + 1, to: close })) {
            const start = skipSpace({ code, at: entry.start });
            const end = code[start] === '{' ? matchingClose({ code, open: start }) : -1;
            if (end === -1 || code.slice(end + 1, entry.end).trim() !== '') {
                report('an entry is not an object literal { lie, why }');
                continue;
            }
            const props = literalProperties({ masked, start, end });
            const keys = props.map((p) => p.key).sort();
            const lie = props.find((p) => p.key === 'lie')?.value;
            const why = props.find((p) => p.key === 'why')?.value;
            if (keys.join(',') !== 'lie,why' || lie === undefined) {
                report('an entry does not name its lie and its reason as literals');
            } else if (!args.ids.includes(lie)) {
                report(`turns off '${lie}', which is not a lie of the list`);
            } else if (why === undefined || why.trim() === '') {
                report(`turns off '${lie}' without saying why`);
            }
        }
    }
    return violations;
}

/**
 * Runs GUARD:G15.
 *
 * @param args.root - Repository root; defaults to this repo
 * @param args.minScannedFiles - Scan floor; defaults to {@link MIN_SCANNED_FILES}
 * @returns The exit code and the report
 */
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const lines = ['=== GUARD:G15 - the fake payment provider lies only from its closed list ==='];
    // The runtime twin's test is skipped by EXACT path, never by prefix: a prefix
    // would also skip `fake-switches.test.tsx` or a whole folder.
    const files = listCodeFiles({ root, excludePrefixes: [PAYMENTS_FAKE_DIR] }).filter(
        (file) => file !== RUNTIME_CHECK_TEST
    );
    const fakeFiles = listProductionFiles({
        root,
        excludePrefixes: [],
        scanRoot: /^packages\/payments\/src\/fake\//
    });
    const listPath = join(root, FAKE_LISTS_FILE);
    if (files.length < minScannedFiles || fakeFiles.length === 0 || !existsSync(listPath)) {
        lines.push(
            `ERROR: ${files.length} file(s) scanned under ${root} (expected at least ` +
                `${minScannedFiles}), ${fakeFiles.length} file(s) of the fake, list ` +
                `${existsSync(listPath) ? 'found' : 'missing'}. The cwd is wrong or the scan is ` +
                'broken; this is not a clean tree.'
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(listPath, 'utf8'));
    } catch {
        raw = null;
    }
    const rows = checkLieRows({ raw });
    const violations: Violation[] = [...rows.violations];
    const told = new Map<string, number>();
    for (const file of fakeFiles) {
        const found = findLies({
            file,
            source: readFileSync(join(root, file), 'utf8'),
            ids: rows.ids
        });
        violations.push(...found.violations);
        for (const lie of found.told) told.set(lie, (told.get(lie) ?? 0) + 1);
    }
    for (const [lie, count] of told) {
        if (count > 1) {
            violations.push({
                predicate: 'a',
                file: PAYMENTS_FAKE_DIR,
                line: 0,
                detail: `'${lie}' is told in ${count} places; a lie lives in one`
            });
        }
    }
    for (const file of files) {
        violations.push(
            ...findUnnamedHonesty({
                file,
                source: readFileSync(join(root, file), 'utf8'),
                ids: rows.ids
            })
        );
    }
    if (violations.length > 0) {
        for (const predicate of ['a', 'b'] as const) {
            const own = violations.filter((v) => v.predicate === predicate);
            if (own.length === 0) continue;
            lines.push('', `FAIL ${PREDICATE_MESSAGES[predicate]}`);
            for (const v of own) lines.push(`  ${v.file}:${v.line}  ${v.detail}`);
        }
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${rows.ids.length} lie(s) in the list, each whole; ${told.size} told by the fake, each ` +
            `in one place; ${files.length} code file(s) scanned, every lie turned off by name and with why.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
