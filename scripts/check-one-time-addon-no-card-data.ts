/**
 * @file check-one-time-addon-no-card-data.ts
 * @description HOS-2179 §6.2 item 3 (AC-14): a one-time addon never touches card data. T-7
 * retired the card order path (`/v1/orders` plus a card token); a one-time addon is now paid
 * on the provider's own payment page, so no Hospeda surface may carry a card token again.
 *
 * ## The predicate
 *
 * Two rules, over the raw text of each file (comments and strings INCLUDED, on purpose:
 * a mention is how a reintroduction starts):
 *
 * 1. `orders-api`: no file under `packages/payments/src` (any extension, so the JSON lists
 *    count too) contains the literal `/v1/orders`.
 * 2. `card-data`: no production file (tests excluded, code extensions) under
 *    `apps/web/src`, `apps/admin/src`, `apps/api/src/routes/billing-addon/` or
 *    `packages/service-core/src/services/billing/addon/` contains `card_token`, `cardToken`,
 *    `paymentToken` or `sdk.mercadopago.com`.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - The direct subscription start (`start-subscription.service.ts`, the authorize input) still
 *   carries `paymentToken`: it is out of scope (spec R-5) and its surfaces are not read.
 * - Any other spelling or field name for card data (`token`, `card_number`, `cardTokenId`
 *   written differently, a field built from parts). `PROVIDER_CONCEPT_TERMS` and the strict
 *   request schema cover the interface and the request; this guard only bans these names.
 * - The Orders path written any other way than the literal `/v1/orders`. In particular the
 *   battery's `MONEY_ROUTE` (`packages/payments/src/battery/watch-operations.ts`) names it as a
 *   regex, `v1\/orders`, ON PURPOSE: it is what refuses an Orders write as a money write. That
 *   spelling is not matched.
 * - Code outside the listed surfaces (another app, another service folder, scripts).
 *
 * ## Scope and positive control
 *
 * The files git sees in the tree. Each surface must yield at least one file: an empty surface is
 * a moved folder or a wrong cwd, not a clean tree. `run({ root })` takes any tree;
 * `scripts/__tests__/check-one-time-addon-no-card-data.test.ts` runs it over throwaway trees.
 *
 * Exit codes: 0 = clean; 1 = a violation, or a surface with no file.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_FILE, lineOf, TEST_FILE } from './payments-guard-scan.js';

/** The literal the payments package may no longer contain. */
export const ORDERS_API_PATH = '/v1/orders';

/** Where the Orders path is banned (every file, any extension). */
export const PAYMENTS_SRC = 'packages/payments/src/';

/** The card-data names banned on the customer-facing and addon surfaces. */
export const CARD_DATA_TERMS = [
    'card_token',
    'cardToken',
    'paymentToken',
    'sdk.mercadopago.com'
] as const;

/** The surfaces where a card-data name is banned (production code only). */
export const CARD_DATA_SURFACES = [
    'apps/web/src/',
    'apps/admin/src/',
    'apps/api/src/routes/billing-addon/',
    'packages/service-core/src/services/billing/addon/'
] as const;

/** One offending occurrence. */
export interface Violation {
    readonly rule: 'orders-api' | 'card-data';
    readonly file: string;
    readonly line: number;
    readonly detail: string;
}

/** What the predicate means. */
export const RULE_MESSAGE =
    'HOS-2179 §6.2: a one-time addon is paid on the provider page and never touches card data. ' +
    `${ORDERS_API_PATH} may not appear in ${PAYMENTS_SRC}, and ${CARD_DATA_TERMS.join(', ')} may ` +
    `not appear in ${CARD_DATA_SURFACES.join(', ')}.`;

/**
 * Every occurrence of the given needles in one file's text.
 *
 * @param args.file - Repo-relative path, for the report
 * @param args.source - The file text
 * @param args.rule - Which rule the needles belong to
 * @param args.needles - The literal texts to find
 * @returns One violation per occurrence, by line
 */
export function findNeedles(args: {
    readonly file: string;
    readonly source: string;
    readonly rule: Violation['rule'];
    readonly needles: readonly string[];
}): readonly Violation[] {
    const found: Violation[] = [];
    for (const needle of args.needles) {
        let at = args.source.indexOf(needle);
        while (at !== -1) {
            found.push({
                rule: args.rule,
                file: args.file,
                line: lineOf({ source: args.source, offset: at }),
                detail: `contains '${needle}'`
            });
            at = args.source.indexOf(needle, at + needle.length);
        }
    }
    return found.sort((a, b) => a.line - b.line);
}

/** The files git sees under `prefix`, deleted ones left out. */
function filesUnder({
    root,
    prefix
}: {
    readonly root: string;
    readonly prefix: string;
}): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', prefix], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return out
        .split('\0')
        .filter(Boolean)
        .filter((file) => !/(^|\/)(node_modules|dist)\//.test(file))
        .filter((file) => existsSync(join(root, file)));
}

/**
 * Runs the guard.
 *
 * @param args.root - Repository root; defaults to this repo
 * @returns The exit code and the report
 */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const lines = ['=== HOS-2179 §6.2 - a one-time addon never touches card data ==='];
    const empty: string[] = [];
    const violations: Violation[] = [];

    const payments = filesUnder({ root, prefix: PAYMENTS_SRC });
    if (payments.length === 0) empty.push(PAYMENTS_SRC);
    for (const file of payments) {
        violations.push(
            ...findNeedles({
                file,
                source: readFileSync(join(root, file), 'utf8'),
                rule: 'orders-api',
                needles: [ORDERS_API_PATH]
            })
        );
    }

    let surfaceFiles = 0;
    for (const surface of CARD_DATA_SURFACES) {
        const files = filesUnder({ root, prefix: surface }).filter(
            (file) => CODE_FILE.test(file) && !TEST_FILE.test(file)
        );
        if (files.length === 0) empty.push(surface);
        surfaceFiles += files.length;
        for (const file of files) {
            violations.push(
                ...findNeedles({
                    file,
                    source: readFileSync(join(root, file), 'utf8'),
                    rule: 'card-data',
                    needles: CARD_DATA_TERMS
                })
            );
        }
    }

    if (empty.length > 0) {
        lines.push(
            `ERROR: no file scanned under ${empty.join(', ')} in ${root}. The cwd is wrong or a ` +
                'folder moved; this is not a clean tree.'
        );
        return { exitCode: 1, output: lines.join('\n') };
    }
    if (violations.length > 0) {
        lines.push('', `FAIL ${RULE_MESSAGE}`);
        for (const v of violations) lines.push(`  [${v.rule}] ${v.file}:${v.line}  ${v.detail}`);
        return { exitCode: 1, output: lines.join('\n') };
    }
    lines.push(
        `OK: ${payments.length} payments file(s) without ${ORDERS_API_PATH}; ${surfaceFiles} ` +
            'production file(s) on the customer and addon surfaces without card-data names.'
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
