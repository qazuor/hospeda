/**
 * @file check-vertical-axis-items.ts
 * @description GUARD:G1 (HOS-1352 program, built by V1 / HOS-1431, AC:V1:5,
 * TEST:V1:8): a vertical is not named without its Axis-2 item, and shared code
 * does not dispatch on a vertical with a binary ternary.
 *
 * Retires `scripts/check-no-binary-vertical-ternary.sh` (HOS-1079) in the same
 * change: predicate (b) below is that script's rule, widened.
 *
 * ## The two predicates (the message names the one that failed)
 *
 * (a) Every `VerticalEnum` value has its OWN entry in
 *     `VERTICAL_ACTIVATION_EVENT_BY_VERTICAL` (`packages/schemas/src/catalog`),
 *     whose value is `null` (declared: no trial) or a member of the closed
 *     activation-event catalog; and the map has no entry for a value the enum
 *     does not have. The `Record<VerticalEnum, ...>` type already makes a
 *     missing entry a compile error; this predicate holds even where the type is
 *     bypassed (a cast, a spread of a wider object).
 *
 * (b) No production code under {@link DISPATCH_SCAN_ROOTS} compares a value with
 *     the literal of a vertical in {@link DISPATCH_LITERALS} and feeds that
 *     comparison straight into a ternary: `x === 'gastronomy' ? A : B`, either
 *     operand order, `===`/`!==`/`==`/`!=`, with up to 200 characters and no
 *     `;`, `{` or `}` between the comparison and the `?` (multi-line shapes
 *     included; `?.` and `??` are not ternaries). That shape silently answers
 *     `B` for every OTHER vertical (HOS-1079: eleven sites answered "experience"
 *     for accommodation and partner, and none raised). Comments are ignored.
 *
 * ## What it does NOT prove, so a green run is not read as more
 *
 * - Of the eight Axis-2 items of a vertical (activation event, what it
 *   publishes, My Account section, keys, sign-up path, Tourist VIP inheritance,
 *   payment methods, own pricing), (a) checks ONE: the activation event, the
 *   only item declared in code today. The others are checked by the pieces
 *   that build them.
 * - (b) is one syntactic shape. An `if (x === 'gastronomy') return A; return B;`
 *   chain, a lookup with a default, or a ternary on a variable that already
 *   holds the comparison is invisible to it.
 * - (b) does not scan `apps/web` or `apps/admin`, and does not anchor on the
 *   `accommodation`, `tourist` or `partner` literals. Measured on the epic
 *   (969a6e2cca): those widenings flag 21 files, nearly all a ternary over an
 *   operand typed `'gastronomy' | 'experience'` (total, not HOS-1079) or a
 *   comparison that is not a vertical dispatch.
 * - Test files (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `__tests__/`, `e2e/`)
 *   are not scanned: fixtures compare against literals on purpose.
 *
 * ## Positive control
 *
 * `run({ root, minScannedFiles, verticals, activationByVertical })` takes any
 * tree and any map: `scripts/__tests__/check-vertical-axis-items.test.ts` breaks
 * each predicate on purpose and sees it red.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a scan too small to be trusted.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    VERTICAL_ACTIVATION_EVENT_VALUES
} from '../packages/schemas/src/catalog/vertical-activation-event.js';
import { VerticalEnum } from '../packages/schemas/src/enums/vertical.enum.js';

/** Where predicate (b) looks: the API and every workspace package's source. */
export const DISPATCH_SCAN_ROOTS = [/^apps\/api\/src\//, /^packages\/[^/]+\/src\//] as const;

/** The vertical literals predicate (b) anchors on. */
export const DISPATCH_LITERALS = ['gastronomy', 'experience'] as const;

/** Fewer scanned files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 500;

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;

/** One problem found by the guard. */
export interface G1Violation {
    readonly rule: 'G1(a)' | 'G1(b)';
    readonly file?: string;
    readonly line?: number;
    readonly detail: string;
}

/** The message per predicate. It claims only what the predicate checks. */
export const RULE_MESSAGES = {
    'G1(a)':
        'G1(a): a VerticalEnum value has no entry of its own in VERTICAL_ACTIVATION_EVENT_BY_VERTICAL, ' +
        'the map names a value the enum does not have, or an entry is outside the closed activation-event ' +
        'catalog. Declare the event (or null for "no trial") for every vertical.',
    'G1(b)':
        `G1(b): shared code feeds a comparison with a vertical literal (${DISPATCH_LITERALS.join(', ')}) ` +
        "straight into a ternary (`x === 'gastronomy' ? A : B`). It answers B for EVERY other vertical " +
        '(HOS-1079). Replace it with an exhaustive `switch` whose `default` throws, or a Record keyed by vertical.'
} as const;

/**
 * Predicate (a): the activation map covers the vertical enum exactly.
 *
 * @param input - Check input.
 * @param input.verticals - The vertical values.
 * @param input.activationByVertical - The declared event per vertical.
 * @param input.allowedEvents - The closed activation-event catalog.
 * @returns One violation per missing, extra or out-of-catalog entry.
 */
export function checkActivationMap({
    verticals,
    activationByVertical,
    allowedEvents
}: {
    readonly verticals: readonly string[];
    readonly activationByVertical: Readonly<Record<string, unknown>>;
    readonly allowedEvents: readonly string[];
}): readonly G1Violation[] {
    const violations: G1Violation[] = [];
    for (const vertical of verticals) {
        if (!Object.hasOwn(activationByVertical, vertical)) {
            violations.push({
                rule: 'G1(a)',
                detail: `vertical '${vertical}' has no activation-event entry.`
            });
            continue;
        }
        const event = activationByVertical[vertical];
        if (event !== null && !(typeof event === 'string' && allowedEvents.includes(event))) {
            violations.push({
                rule: 'G1(a)',
                detail: `vertical '${vertical}' declares ${JSON.stringify(event)}, outside the catalog (${allowedEvents.join(', ')}).`
            });
        }
    }
    for (const key of Object.keys(activationByVertical)) {
        if (!verticals.includes(key)) {
            violations.push({
                rule: 'G1(a)',
                detail: `the map has an entry for '${key}', which is not a VerticalEnum value.`
            });
        }
    }
    return violations;
}

/**
 * Blanks out `//` and `/* *\/` comments, keeping string literals and line numbers.
 *
 * @param input - Strip input.
 * @param input.source - The file's text.
 * @returns The text with every comment character replaced by a space (newlines kept).
 */
export function stripComments({ source }: { readonly source: string }): string {
    let out = '';
    let i = 0;
    while (i < source.length) {
        const ch = source[i] as string;
        const next = source[i + 1];
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') {
                out += ' ';
                i += 1;
            }
            continue;
        }
        if (ch === '/' && next === '*') {
            const end = source.indexOf('*/', i + 2);
            const stop = end === -1 ? source.length : end + 2;
            out += source.slice(i, stop).replace(/[^\n]/g, ' ');
            i = stop;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            let j = i + 1;
            while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
            out += source.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/** The binary-ternary pattern of predicate (b), both operand orders. */
function dispatchPattern(): RegExp {
    const names = DISPATCH_LITERALS.join('|');
    const tail = '[^;{}]{0,200}?(?<!\\?)\\?(?![.?])';
    return new RegExp(
        `(?:[!=]==?\\s*(['"\`])(?:${names})\\1|(['"\`])(?:${names})\\2\\s*[!=]==?)${tail}`,
        'g'
    );
}

/**
 * Predicate (b) over one file.
 *
 * @param input - Check input.
 * @param input.file - Repo-relative path, for the report.
 * @param input.source - The file's text.
 * @returns One violation per binary vertical ternary, with its line.
 */
export function findBinaryVerticalTernaries({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly G1Violation[] {
    const code = stripComments({ source });
    const violations: G1Violation[] = [];
    for (const match of code.matchAll(dispatchPattern())) {
        const line = code.slice(0, match.index).split('\n').length;
        violations.push({
            rule: 'G1(b)',
            file,
            line,
            detail: match[0].replace(/\s+/g, ' ').slice(0, 80)
        });
    }
    return violations;
}

/** Production code files predicate (b) reads, from the files git sees under `root`. */
function listScannedFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter(Boolean)
        .filter((file) => CODE_FILE.test(file) && !TEST_FILE.test(file))
        .filter((file) => DISPATCH_SCAN_ROOTS.some((pattern) => pattern.test(file)));
}

/**
 * Runs GUARD:G1.
 *
 * @param args - Run input.
 * @param args.root - Repository root; defaults to this repo.
 * @param args.minScannedFiles - Floor for predicate (b)'s scan; defaults to {@link MIN_SCANNED_FILES}.
 * @param args.verticals - Vertical values; defaults to `VerticalEnum`.
 * @param args.activationByVertical - Event map; defaults to the code map.
 * @returns The exit code and the report.
 */
export function run(
    args: {
        readonly root?: string;
        readonly minScannedFiles?: number;
        readonly verticals?: readonly string[];
        readonly activationByVertical?: Readonly<Record<string, unknown>>;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const lines = [
        '=== GUARD:G1 - verticals carry their Axis-2 item; no binary vertical ternary ==='
    ];

    const files = listScannedFiles({ root });
    if (files.length < minScannedFiles) {
        lines.push(
            `ERROR: only ${files.length} code file(s) scanned under ${root}, expected at least ${minScannedFiles}. ` +
                'The root is wrong or the scan is broken; this is not a clean tree.'
        );
        return { exitCode: 1, output: lines.join('\n') };
    }

    const violations = [
        ...checkActivationMap({
            verticals: args.verticals ?? Object.values(VerticalEnum),
            activationByVertical:
                args.activationByVertical ?? VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
            allowedEvents: VERTICAL_ACTIVATION_EVENT_VALUES
        }),
        ...files.flatMap((file) =>
            findBinaryVerticalTernaries({ file, source: readFileSync(join(root, file), 'utf8') })
        )
    ];

    const failing = (['G1(a)', 'G1(b)'] as const).filter((rule) =>
        violations.some((v) => v.rule === rule)
    );
    for (const rule of failing) {
        lines.push('', `FAIL ${RULE_MESSAGES[rule]}`);
        for (const v of violations.filter((violation) => violation.rule === rule)) {
            lines.push(`  ${v.file ? `${v.file}:${v.line}  ` : ''}${v.detail}`);
        }
    }
    if (failing.length > 0) return { exitCode: 1, output: lines.join('\n') };

    lines.push(
        `OK: every vertical declares its activation event; ${files.length} code file(s) under apps/api/src and ` +
            `packages/*/src hold no binary ternary on ${DISPATCH_LITERALS.map((l) => `'${l}'`).join(' or ')}.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
