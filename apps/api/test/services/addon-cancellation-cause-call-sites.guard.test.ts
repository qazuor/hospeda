/**
 * HOS-847 PR 7a — static guard: every production call of
 * `handleSubscriptionCancellationAddons` must name the cancellation CAUSE.
 *
 * ## Why a guard and not a required parameter
 *
 * `cause` is optional in the type so the ~70 pre-existing test call sites keep
 * compiling — none of them is asserting anything about the cause, and rewriting
 * them would have buried a three-file behavioural change under seventy lines of
 * mechanical churn. That leaves exactly one hole: a THIRD production call site
 * added later would silently inherit `'unknown'`.
 *
 * The owner answered that question on 2026-09-07:
 * `UNKNOWN_CANCELLATION_CAUSE_POLICY` is `'honour-paid-period'`. So an inherited
 * `'unknown'` is no longer merely wrong-by-omission — it is the PERMISSIVE
 * branch, and a new call site that forgets the field hands out a period nobody
 * decided to give away. This guard is what makes that impossible to do by
 * accident: forget the field at a production call site and CI says so.
 *
 * ## What it asserts, exactly
 *
 * For every non-test file under `apps/api/src` that CALLS the function — the
 * defining module and the barrel that merely re-exports it are excluded by
 * name — each call's argument object literal contains a `cause:` field. The
 * argument is delimited by brace matching from the opening `({`, so a long
 * explanatory comment inside the call (there is one) does not fool it and a
 * `cause:` belonging to a neighbouring call cannot be counted for this one.
 *
 * ## What it does NOT catch
 *
 * A call whose argument is a variable built elsewhere (`handleX(input)`), and a
 * `cause` whose value is wrong rather than absent. The behavioural tests in
 * `addon-lifecycle-cancellation.cause.test.ts` cover the second; the first is
 * not a shape anything in this repo uses, and the caller-count assertion below
 * turns it into a failure anyway if it ever appears.
 *
 * @module test/services/addon-cancellation-cause-call-sites.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC_ROOT = resolve(__dirname, '../../src');

/** The function whose call sites must declare a cause. */
const FUNCTION_NAME = 'handleSubscriptionCancellationAddons';

/** Where the function is defined, and the barrel that re-exports it. */
const NON_CALLERS: ReadonlySet<string> = new Set([
    'services/addon-lifecycle-cancellation.service.ts',
    'services/addon-lifecycle.service.ts'
]);

/**
 * Recursively collects production `.ts` files under a directory.
 *
 * @param dir - Absolute directory to walk.
 * @returns Absolute paths of every non-test, non-declaration `.ts` file found.
 */
function collectSourceFiles(dir: string): readonly string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);

        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full));
            continue;
        }

        if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.includes('.test.')) {
            continue;
        }

        found.push(full);
    }

    return found;
}

/**
 * Extracts the text of each `FUNCTION_NAME({ ... })` argument object in a file.
 *
 * Delimits the argument by counting braces from the opening `{`, so nothing
 * outside this particular call can satisfy the assertion on its behalf.
 *
 * @param source - Full file contents.
 * @returns One string per call, holding that call's argument object literal.
 */
function extractCallArguments(source: string): readonly string[] {
    const args: string[] = [];
    const opener = `${FUNCTION_NAME}({`;
    let cursor = source.indexOf(opener);

    while (cursor !== -1) {
        let depth = 0;
        let index = cursor + opener.length - 1;

        for (; index < source.length; index++) {
            const char = source[index];
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    break;
                }
            }
        }

        args.push(source.slice(cursor, index + 1));
        cursor = source.indexOf(opener, index);
    }

    return args;
}

describe(`HOS-847 PR 7a guard — every production ${FUNCTION_NAME} call names its cause`, () => {
    const callers = collectSourceFiles(API_SRC_ROOT)
        .map((file) => ({ file, relativePath: relative(API_SRC_ROOT, file) }))
        .filter(
            ({ file, relativePath }) =>
                !NON_CALLERS.has(relativePath) &&
                readFileSync(file, 'utf8').includes(`${FUNCTION_NAME}(`)
        );

    it('finds the two known call sites (anti-vacuity)', () => {
        // A guard whose input silently becomes empty passes forever while
        // checking nothing — and a renamed function would do exactly that here.
        // The paths are named rather than counted so a MOVED call site reads as
        // a deliberate change rather than an off-by-one.
        expect(callers.map(({ relativePath }) => relativePath).sort()).toEqual([
            'cron/jobs/finalize-cancelled-subs.ts',
            'routes/webhooks/mercadopago/subscription-logic.ts'
        ]);
    });

    it('every call passes an explicit `cause`', () => {
        const offenders: string[] = [];

        for (const { file, relativePath } of callers) {
            const calls = extractCallArguments(readFileSync(file, 'utf8'));

            // A caller that matched the name but yielded no parsable call is
            // itself a finding: it means the call shape changed under the guard.
            if (calls.length === 0) {
                offenders.push(`${relativePath} (no \`${FUNCTION_NAME}({\` call found)`);
                continue;
            }

            for (const call of calls) {
                if (!call.includes('cause:')) {
                    offenders.push(`${relativePath} (a call omits \`cause:\`)`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});
