/**
 * @file check-promo-redemption-end.ts
 * @description HOS-2352: a writer that zeroes `promo_redemption.remaining_charges`
 * records when and why the promo ended.
 *
 * The reconciliation prices a past charge with the promos in force when it was
 * made (AC:B11:11, B/14 §2.4). A downgrade or an S37 retirement ends the promos by
 * zeroing today's counter; without `ended_at` that zero would erase the promo
 * from every charge it already priced. Every such writer goes through
 * `endPromoRedemptions()` (`packages/service-core/src/services/billing/promo/end-promo-redemptions.ts`),
 * which writes the counter, `ended_at` and `ended_reason` together.
 *
 * ## The predicate (what a red proves, and nothing more)
 *
 * A production code file under `packages/` or `apps/` (`.ts .tsx .mts .cts .js
 * .jsx .mjs .cjs`; tests, `dist` and `node_modules` excluded), with its comments
 * blanked out, fails when it contains `remainingCharges: 0` (any spacing) or the
 * SQL `remaining_charges = 0` inside an `UPDATE`/`SET`, and it is not
 * `end-promo-redemptions.ts` itself. A literal zero is how a writer ends a promo;
 * the decrement in P1 (`remainingCharges - 1`) and a read filter
 * (`eq(promoRedemptions.remainingCharges, 0)`) do not match.
 *
 * NOT seen, on purpose: a zero computed at runtime (`remainingCharges: n` with
 * `n = 0`), a raw SQL string built by concatenation, and a write through a
 * migration file.
 *
 * ## Fails loud
 *
 * A tree where the helper file is missing is a moved helper, never a clean tree.
 *
 * ## Positive control
 *
 * `run({ root })` takes any tree: `scripts/__tests__/check-promo-redemption-end.test.ts`
 * breaks it on purpose over throwaway git trees and sees it red.
 *
 * Exit codes: 0 = clean; 1 = a writer zeroes the counter by hand, or a check that cannot be enforced.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withoutComments } from './check-billing-verticals-boundary.js';

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** The only file allowed to zero the counter. */
export const HELPER_FILE =
    'packages/service-core/src/services/billing/promo/end-promo-redemptions.ts';

/** `remainingCharges: 0`, or `remaining_charges = 0` written by an UPDATE. */
const ZEROING = [/\bremainingCharges\s*:\s*0\b/, /\bSET\b[^;]*\bremaining_charges\s*=\s*0\b/i];

/** One file that zeroes the counter outside the helper. */
export interface HandZeroing {
    readonly file: string;
    readonly line: number;
}

/**
 * Whether one file's source zeroes `remaining_charges` by hand.
 *
 * @returns The line of the first zeroing, or `null` when the file is clean
 */
export function findHandZeroing(args: {
    readonly file: string;
    readonly source: string;
}): HandZeroing | null {
    const code = withoutComments(args.source);
    for (const pattern of ZEROING) {
        const match = pattern.exec(code);
        if (match) return { file: args.file, line: code.slice(0, match.index).split('\n').length };
    }
    return null;
}

function listFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter((file) => file !== '' && !/(^|\/)(node_modules|dist)\//.test(file));
}

/**
 * Runs the check and renders its report.
 *
 * @param args.root - Repo root (defaults to the cwd)
 * @returns The exit code and the report text
 */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = resolve(args.root ?? process.cwd());
    const lines = ['=== HOS-2352 — a zeroed promo counter records its end ==='];
    const all = listFiles({ root });
    if (!all.includes(HELPER_FILE)) {
        lines.push(
            `ERROR: ${HELPER_FILE} is missing in ${root}. Fix the path; a moved helper is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    const files = all.filter(
        (file) =>
            CODE_FILE.test(file) &&
            /^(packages|apps)\//.test(file) &&
            !TEST_FILE.test(file) &&
            file !== HELPER_FILE
    );
    const found = files.flatMap((file) => {
        const hit = findHandZeroing({ file, source: readFileSync(join(root, file), 'utf8') });
        return hit ? [hit] : [];
    });
    if (found.length > 0) {
        lines.push(
            `FAIL: ${found.length} file(s) zero promo_redemption.remaining_charges by hand. ` +
                'Use endPromoRedemptions() so ended_at and ended_reason are written with it.'
        );
        for (const hit of found) lines.push(`  ${hit.file}:${hit.line}`);
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${files.length} production code file(s) scanned; only ${HELPER_FILE} zeroes the counter.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
