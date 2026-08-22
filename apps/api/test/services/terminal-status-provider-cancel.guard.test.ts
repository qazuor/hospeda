/**
 * HOS-753 — static guard: a literal terminal-status write must close the
 * provider side too.
 *
 * ## The regression this exists to stop
 *
 * `applyRefundLifecycle` moved `billing_subscriptions.status` to `cancelled`
 * with a plain Drizzle UPDATE and never told MercadoPago. The preapproval stayed
 * authorized and charged the customer again the next cycle (HOS-751,
 * preapproval `275b27a37f6f4e94bc1ab7543c6bd092`).
 *
 * What made it unrecoverable rather than merely wrong is worth stating, because
 * it is the reason a guard is warranted at all: the ONLY other code that
 * hard-cancels a preapproval is the `finalize-cancelled-subs` cron, whose
 * selection filter is `status IN ('active','past_due','trialing')`. A row the
 * refund had already written to `cancelled` was excluded from that sweep by
 * construction. The buggy path skipped the one gate that would have caught it
 * AND shut that gate behind itself, so no backstop could ever notice.
 *
 * ## What this guard actually asserts
 *
 * Exactly this, and nothing more: **every non-test file under `apps/api/src`
 * that both calls `update(billingSubscriptions)` and assigns a LITERAL
 * cancelled status (`status: SubscriptionStatusEnum.CANCELLED` or
 * `status: 'cancelled'`) must also reference `hardCancelPreapprovalBestEffort`.**
 *
 * It is a source-level scan, in the same spirit as
 * `inv1-cache-invalidation.guard.test.ts`. It proves the reference EXISTS in the
 * file; it does not prove the call sits on the same branch as the write — the
 * per-path unit tests in `refund-lifecycle.service.test.ts` and
 * `finalize-cancelled-subs.test.ts` do that.
 *
 * ## What it deliberately does NOT catch (stated so nobody over-trusts it)
 *
 * - **A write whose status comes from a variable** (`status: mappedStatus`).
 *   Excluded on purpose, not by oversight: the two live examples —
 *   `subscription-logic.ts::processSubscriptionUpdated` and
 *   `trial.service.ts::reconcileExpiredTrials` — write a value they just READ
 *   from MercadoPago. Those are mirrors of an already-terminal provider state,
 *   and calling `cancel()` back at the provider there would be redundant, not
 *   correct. A guard that flagged them would be wrong.
 * - A write split across two files (literal in one, UPDATE in another).
 * - A write through an aliased or re-exported table binding.
 *
 * Anyone adding a THIRD kind of terminal write should read the table in
 * `preapproval-hard-cancel.ts` rather than assume this guard covers them.
 *
 * @module test/services/terminal-status-provider-cancel.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC_ROOT = resolve(__dirname, '../../src');

/** The canonical provider hard-cancel every terminal writer must go through. */
const CANONICAL_HELPER = 'hardCancelPreapprovalBestEffort';

/** A Drizzle UPDATE targeting the subscriptions table. */
const UPDATES_SUBSCRIPTIONS = 'update(billingSubscriptions)';

/**
 * A LITERAL assignment of the terminal `cancelled` status.
 *
 * Case-sensitive and anchored on `status:` at the start of an indented line, so
 * the audit-event field `newStatus:` (which merely RECORDS the transition) does
 * not match — only the field that actually writes the column does.
 */
const LITERAL_CANCELLED_WRITE = /^\s+status: (?:SubscriptionStatusEnum\.CANCELLED|'cancelled')/m;

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

describe('HOS-753 guard — literal terminal-status writes must hard-cancel the preapproval', () => {
    const sourceFiles = collectSourceFiles(API_SRC_ROOT);

    /** Files that write a literal `cancelled` status onto `billing_subscriptions`. */
    const terminalWriters = sourceFiles.filter((file) => {
        const source = readFileSync(file, 'utf8');
        return source.includes(UPDATES_SUBSCRIPTIONS) && LITERAL_CANCELLED_WRITE.test(source);
    });

    it('scans a non-empty set of files (anti-vacuity)', () => {
        // Without this, renaming `billingSubscriptions` or reformatting the
        // status assignment would leave the guard scanning ZERO files and
        // reporting green — the most believable false negative there is.
        expect(sourceFiles.length).toBeGreaterThan(100);
        expect(terminalWriters.length).toBeGreaterThanOrEqual(2);
    });

    it('every literal terminal writer references the canonical provider hard-cancel', () => {
        const offenders = terminalWriters.filter(
            (file) => !readFileSync(file, 'utf8').includes(CANONICAL_HELPER)
        );

        expect(
            offenders.map((file) => relative(API_SRC_ROOT, file)),
            `These files write a LITERAL 'cancelled' status onto billing_subscriptions but never reference ${CANONICAL_HELPER}. ` +
                'A local row that is terminal while its MercadoPago preapproval is still authorized keeps charging the customer with no local row that explains it (HOS-751), ' +
                'and the finalize-cancelled-subs cron cannot recover it: its filter is status IN (active, past_due, trialing), which the cancelled you just wrote excludes. ' +
                'Call hardCancelPreapprovalBestEffort from apps/api/src/services/billing/preapproval-hard-cancel.ts. If you are MIRRORING a status you just read from the provider, do not write it as a literal — bind it to a variable, which this guard deliberately does not flag.'
        ).toEqual([]);
    });
});
