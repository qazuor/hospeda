/**
 * @file check-no-provider-trial.ts
 * @description GUARD:G11 (HOS-1352 program, built by B1 / HOS-1508, AC:B1:7,
 * TEST:B1:7, INV:D12): a trial is never asked of the provider. The trial clock
 * is ours (DEC-TRIAL-002); the provider grants a free trial once per payer and
 * then reports it on objects where it will not run (HOS-522, M9).
 *
 * ## The predicate
 *
 * In every production code file under `apps/` and `packages/`
 * (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .astro`, tests excluded, comments
 * ignored), EXCEPT `packages/payments/src/fake/` and
 * `packages/payments/src/adapters/` (where the provider's trial fields and the
 * fake's M9 lie are legitimate):
 *
 * a file that BUILDS AN AUTHORIZATION, which here means its code calls or
 * declares `authorize(…)` or names `AuthorizeInput` / `AuthorizeInputSchema`,
 * fails if it names a trial-request field: an identifier, or a string literal
 * that is exactly a name, whose name contains `freetrial` or
 * `firstinvoiceoffset` once case, `_` and `-` are ignored (`free_trial`,
 * `freeTrial`, `freeTrialDays`, `first_invoice_offset`, `firstInvoiceOffset`…).
 * Those are the provider's two ways of granting a trial on a recurring charge.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - A trial asked through a field built in ANOTHER file and spread or passed
 *   into the authorization: the guard reads the file that builds it, not the
 *   data flow.
 * - A trial-request field with any other name.
 * - A future first-charge date, which the provider turns into a free trial on
 *   its own (EX-38, `B/06` §4.3). It cannot be banned (a future date is the
 *   safety precondition of every plan and cycle change, DEC-SUB-006) and no
 *   payload names it; this guard does not claim to see it.
 * - Code that TRUSTS a trial state the provider reports back: this guard only
 *   reads code that builds an authorization.
 *
 * ## Scope and positive control
 *
 * The files git sees in the tree. A scan of fewer than `MIN_SCANNED_FILES` files
 * is a moved root or a wrong cwd, not a clean tree. `run({ root, minScannedFiles })`
 * takes any tree; `scripts/__tests__/check-no-provider-trial.test.ts` runs it
 * over throwaway git trees that violate the predicate.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a scan too small to trust.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    lineOf,
    listProductionFiles,
    maskSource,
    normalizeName,
    PAYMENTS_ADAPTERS_DIR,
    PAYMENTS_FAKE_DIR
} from './payments-guard-scan.js';

/** Fewer files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** The provider's trial-request fields, normalized (case, `_` and `-` ignored). */
export const TRIAL_REQUEST_FIELDS = ['freetrial', 'firstinvoiceoffset'] as const;

/** What makes a file one that builds an authorization (over masked code). */
export const BUILDS_AN_AUTHORIZATION = /\bauthorize\s*(?:\?\.)?\s*\(|\bAuthorizeInput(?:Schema)?\b/;

/** One offending occurrence. */
export interface Violation {
    readonly rule: 'G11';
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

/** What the predicate means. */
export const RULE_MESSAGE =
    'GUARD:G11: a file that builds an authorization (calls or declares authorize(…), or names ' +
    'AuthorizeInput) names a provider trial-request field (free_trial or first_invoice_offset, in any ' +
    'spelling). The trial is never asked of the provider: its clock is ours (INV:D12, DEC-TRIAL-002).';

const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const NAME_LIKE = /^[A-Za-z_$][\w$-]*$/;

/** Whether a name is, or contains, a trial-request field. */
function isTrialRequestName({ name }: { readonly name: string }): boolean {
    const normalized = normalizeName({ name });
    return TRIAL_REQUEST_FIELDS.some((field) => normalized.includes(field));
}

/**
 * The predicate over one file.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per trial-request name, or none when the file builds no authorization
 */
export function findProviderTrialRequests(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const { code, strings } = maskSource({ source: args.source });
    if (!BUILDS_AN_AUTHORIZATION.test(code)) return [];
    const names = [
        ...[...code.matchAll(IDENTIFIER)].map((match) => ({ offset: match.index, name: match[0] })),
        ...strings
            .filter((literal) => NAME_LIKE.test(literal.value))
            .map((literal) => ({ offset: literal.start, name: literal.value }))
    ];
    return names
        .filter(({ name }) => isTrialRequestName({ name }))
        .map(({ offset, name }) => ({
            rule: 'G11' as const,
            file: args.file,
            line: lineOf({ source: args.source, offset }),
            detail: `names '${name}'`
        }))
        .sort((a, b) => a.line - b.line);
}

/**
 * Runs GUARD:G11.
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
    const lines = ['=== GUARD:G11 - a trial is never asked of the provider ==='];
    const files = listProductionFiles({
        root,
        excludePrefixes: [PAYMENTS_FAKE_DIR, PAYMENTS_ADAPTERS_DIR]
    });
    if (files.length < minScannedFiles) {
        lines.push(
            `ERROR: only ${files.length} file(s) scanned under ${root}, expected at least ` +
                `${minScannedFiles}. The cwd is wrong or the scan is broken; this is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    const violations = files.flatMap((file) =>
        findProviderTrialRequests({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    if (violations.length > 0) {
        lines.push('', `FAIL ${RULE_MESSAGE}`);
        for (const v of violations) lines.push(`  ${v.file}:${v.line}  ${v.detail}`);
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${files.length} production file(s) scanned; no file that builds an authorization names a ` +
            'provider trial-request field.'
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
