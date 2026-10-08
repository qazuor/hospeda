/**
 * @file check-plegable-discard.ts
 * @description GUARD:G-R2 (HOS-1352 program, built by V3 / HOS-1439, AC:V3:2,
 * TEST:V3:3): the fold of the effective set never folds a source of class
 * `COMPLEMENT` when the set has no live `TITLE` that is not a `TRIAL`
 * (`V/15` §2.6).
 *
 * ## What the predicate checks
 *
 * The discard lives in the resolution's single fold locus (`V/17` §1.3 forbids
 * resolving the steps per call site), so the guard reads that module and requires
 * its two halves to still be wired:
 *
 * - (a) the fold reaches the plegable set through `selectPlegableSources`
 *       (`fold.ts`), and
 * - (b) that selector gates the complements with `hasLiveNonTrialTitle`
 *       (`plegable.ts`).
 *
 * Removing either leaves a source of class `COMPLEMENT` eligible for the four
 * strategies without the title they require. The message names the half that
 * failed; removing (b) is the mutation TEST:V3:3 exercises.
 *
 * ## What it does NOT prove, so a green run is not read as more
 *
 * It is a static presence check over one directory: it does not prove that every
 * call path in the app resolves through the fold, nor that `TRIAL` is the only
 * exclusion the condition needs. It proves the single-locus resolution still
 * gates the complements, which is the property AC:V3:2 names.
 *
 * Exit codes: 0 = clean; 1 = a half is missing, or the resolution is absent.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './check-vertical-axis-items.js';

/** Where the resolution lives; the guard reads every production file in it. */
export const RESOLUTION_DIR = 'packages/verticals/src/effective-set';

/** The two halves of the condition, each named by the message when it is absent. */
export type GR2Half = 'fold-through-selector' | 'selector-gates-complement';

/** The message per half. Each claims only what its predicate verifies. */
export const RULE_MESSAGES: Readonly<Record<GR2Half, string>> = {
    'fold-through-selector':
        'G-R2: the effective-set fold does not go through `selectPlegableSources`, so a source of ' +
        'class COMPLEMENT can reach the four strategies without the discard.',
    'selector-gates-complement':
        'G-R2: `selectPlegableSources` no longer calls `hasLiveNonTrialTitle`, so the complements ' +
        'are admitted with any title (a trial included).'
};

const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/;

/** A call, not the definition: the expression `= name(` or `(name(`. */
function called(name: string): RegExp {
    return new RegExp(`[=(]\\s*${name}\\s*\\(`);
}

/**
 * The two halves over the resolution's source. A definition (`function name(`)
 * does not satisfy a call, so removing the call reddens the half even while the
 * definition stays behind.
 *
 * @param args.code - The resolution's concatenated, comment-stripped source.
 * @returns One entry per half that is missing.
 */
export function findMissingHalves({ code }: { readonly code: string }): readonly GR2Half[] {
    const missing: GR2Half[] = [];
    if (!called('selectPlegableSources').test(code)) missing.push('fold-through-selector');
    if (!called('hasLiveNonTrialTitle').test(code)) missing.push('selector-gates-complement');
    return missing;
}

/** Production files of the resolution directory, or `null` when it is absent. */
function readResolution({ root }: { readonly root: string }): string | null {
    const dir = join(root, RESOLUTION_DIR);
    let names: readonly string[];
    try {
        names = readdirSync(dir);
    } catch {
        return null;
    }
    const files = names.filter((name) => name.endsWith('.ts') && !TEST_FILE.test(name));
    if (files.length === 0) return null;
    return files
        .map((name) => stripComments({ source: readFileSync(join(dir, name), 'utf8') }))
        .join('\n');
}

/**
 * Runs GUARD:G-R2.
 *
 * @param args - Run input.
 * @param args.root - Repository root; defaults to this repo.
 * @returns The exit code and the report.
 */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const lines = [
        '=== GUARD:G-R2 - the effective set discards complements without a live non-TRIAL title ==='
    ];

    const code = readResolution({ root });
    if (code === null) {
        lines.push('', `FAIL G-R2: the resolution under ${RESOLUTION_DIR} has no production file.`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    const missing = findMissingHalves({ code });
    if (missing.length > 0) {
        for (const half of missing) lines.push('', `FAIL ${RULE_MESSAGES[half]}`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push(
        `OK: ${RESOLUTION_DIR} folds through selectPlegableSources, and the selector gates the complements on a live non-TRIAL title.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
