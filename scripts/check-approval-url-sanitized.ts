/**
 * @file check-approval-url-sanitized.ts
 * @description GUARD:G10 (HOS-1352 program, built by B1 / HOS-1508, AC:B1:6,
 * TEST:B1:6, INV:D10): the provider's approval link is never shown raw.
 *
 * EX-37 (2026-09-16, production): the provider returns the link where the
 * customer authorizes the charge BROKEN, and the API answers success with it.
 * The fix is `sanitizeApprovalUrl` (`@repo/payments`), and this guard is what
 * keeps every call site going through it: it is a call site anyone rewrites
 * "correctly" by copying what the API returns.
 *
 * ## The two predicates (the message names the one that failed)
 *
 * In every production code file under `apps/` and `packages/`, OUTSIDE
 * `packages/payments/` (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .astro`, tests
 * excluded, comments ignored):
 *
 * (a) An identifier, or a string literal that is exactly a name, whose name
 *     contains the provider's own field for that link once case, `_` and `-`
 *     are ignored (`init_point`, `sandbox_init_point`, `initPoint`,
 *     `mpInitPoint`…). Only the adapter, inside the payments package, may know
 *     that field. Prose inside a string (`'the init_point to redirect to'`) is
 *     not a name and does not count.
 * (b) The identifier `approvalUrl` (or the string literal `'approvalUrl'`)
 *     anywhere except inside the parentheses of a `sanitizeApprovalUrl(…)`
 *     call. That covers a member read (`result.approvalUrl`), a destructuring
 *     (`const { approvalUrl } = result`) and an object key alike: the name is
 *     reserved for the raw link outside the package, type positions included
 *     (an interface property, a schema key). Pass the authorize result
 *     whole (`sanitizeApprovalUrl(result)`) or the field inside the call.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - The raw link leaving WITHOUT its name: the whole authorize result returned
 *   to a surface (`c.json(result)`), spread (`{ ...result }`), serialized, or
 *   read by a computed key built at runtime. No lexical guard sees a value
 *   whose field name never appears.
 * - What `sanitizeApprovalUrl` does with the link: that is its unit test
 *   (`packages/payments/test/approval-url.test.ts`).
 * - Anything inside `packages/payments/`: the package defines the field and
 *   sanitizes it; its fake and its adapters return the broken link on purpose
 *   (M10).
 *
 * ## Scope and positive control
 *
 * The files git sees in the tree. A scan of fewer than `MIN_SCANNED_FILES` files
 * is a moved root or a wrong cwd, not a clean tree. `run({ root, minScannedFiles })`
 * takes any tree; `scripts/__tests__/check-approval-url-sanitized.test.ts` runs
 * it over throwaway git trees that violate each predicate.
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
    matchingClose,
    normalizeName,
    PAYMENTS_DIR
} from './payments-guard-scan.js';

/** Fewer files than this means the scan is broken, not that the tree is clean. */
export const MIN_SCANNED_FILES = 1000;

/** The provider's raw-link field, normalized (case, `_` and `-` ignored). */
export const RAW_LINK_FIELD = 'initpoint';

/** The raw link's name on the payments interface. */
export const APPROVAL_URL_NAME = 'approvalUrl';

/** The only function that may read it outside the package. */
export const SANITIZER_NAME = 'sanitizeApprovalUrl';

/** Which predicate a violation breaks. */
export type Rule = 'G10(a)' | 'G10(b)';

/** One offending occurrence. */
export interface Violation {
    readonly rule: Rule;
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

/** What each predicate means, printed once per failing predicate. */
export const RULE_MESSAGES: Readonly<Record<Rule, string>> = {
    'G10(a)':
        "GUARD:G10 predicate (a): code outside packages/payments names the provider's raw payment-link " +
        'field (init_point, in any spelling). Only the adapter may know it (INV:D10, EX-37).',
    'G10(b)':
        'GUARD:G10 predicate (b): code outside packages/payments names `approvalUrl` outside the ' +
        'parentheses of sanitizeApprovalUrl(…). The raw link is shown only sanitized (INV:D10, EX-37): ' +
        'pass the authorize result to sanitizeApprovalUrl and show its `url`. The name is reserved outside ' +
        'the package, type positions included: name your own field differently (e.g. `checkoutUrl`).'
};

const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const NAME_LIKE = /^[A-Za-z_$][\w$-]*$/;

/**
 * Both predicates over one file.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @returns One violation per offending occurrence
 */
export function findRawApprovalLinks(args: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    const { code, strings } = maskSource({ source: args.source });
    const allowed: (readonly [number, number])[] = [];
    for (const call of code.matchAll(new RegExp(`\\b${SANITIZER_NAME}\\s*\\(`, 'g'))) {
        const open = call.index + call[0].length - 1;
        const close = matchingClose({ code, open });
        allowed.push([open, close === -1 ? code.length : close]);
    }
    const insideSanitizer = (offset: number) =>
        allowed.some(([from, to]) => offset > from && offset < to);

    const names = [
        ...[...code.matchAll(IDENTIFIER)].map((match) => ({ offset: match.index, name: match[0] })),
        ...strings
            .filter((literal) => NAME_LIKE.test(literal.value))
            .map((literal) => ({ offset: literal.start, name: literal.value }))
    ];
    const violations: Violation[] = [];
    for (const { offset, name } of names) {
        const at = () => ({ file: args.file, line: lineOf({ source: args.source, offset }) });
        if (normalizeName({ name }).includes(RAW_LINK_FIELD)) {
            violations.push({ rule: 'G10(a)', ...at(), detail: `names '${name}'` });
        } else if (name === APPROVAL_URL_NAME && !insideSanitizer(offset)) {
            violations.push({ rule: 'G10(b)', ...at(), detail: `names '${name}'` });
        }
    }
    return violations.sort((a, b) => a.line - b.line);
}

/**
 * Runs GUARD:G10.
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
    const lines = ['=== GUARD:G10 - the approval link is shown only sanitized ==='];
    const files = listProductionFiles({ root, excludePrefixes: [PAYMENTS_DIR] });
    if (files.length < minScannedFiles) {
        lines.push(
            `ERROR: only ${files.length} file(s) scanned under ${root}, expected at least ` +
                `${minScannedFiles}. The cwd is wrong or the scan is broken; this is not a clean tree.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    const violations = files.flatMap((file) =>
        findRawApprovalLinks({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    const failing = (['G10(a)', 'G10(b)'] as const).filter((rule) =>
        violations.some((violation) => violation.rule === rule)
    );
    for (const rule of failing) {
        lines.push('', `FAIL ${RULE_MESSAGES[rule]}`);
        for (const v of violations.filter((violation) => violation.rule === rule)) {
            lines.push(`  ${v.file}:${v.line}  ${v.detail}`);
        }
    }
    if (failing.length > 0) return { exitCode: 1, output: lines.join('\n') };
    lines.push(
        `OK: ${files.length} production file(s) outside ${PAYMENTS_DIR} scanned; no raw link field is ` +
            `named, and \`${APPROVAL_URL_NAME}\` appears only inside ${SANITIZER_NAME}(…).`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
