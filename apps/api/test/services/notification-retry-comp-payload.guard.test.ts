/**
 * HOS-1171 static guard: a retried comp email says the same thing the first one
 * did.
 *
 * ## The bug this pins
 *
 * `reconstructPayload` in `notification-retry.service.ts` rebuilds a failed
 * notification from `billing_notification_log.metadata` and handles a handful of
 * types by name; everything else falls into `default: return basePayload`, which
 * carries no type-specific field at all.
 *
 * `CompGranted` branches on `hadActiveBilling`. With it true the email says we
 * cancelled the customer's automatic debit, that their card will not be charged
 * again, and to write to us if a charge appears anyway. Fall into `default` and
 * the field is gone, the paragraph disappears, and the retry sends the "you
 * never gave us a card" variant to someone whose preapproval we had just
 * hard-cancelled — with `planName` rendering as `undefined` beside it.
 *
 * ## Why a static guard
 *
 * `reconstructPayload` is module-private and its only public entry point,
 * `processDbNotificationRetries`, needs a full DB and Redis round trip to reach.
 * `test/setup.ts` mocks `@repo/db` wholesale, so a test that drove it would
 * assert against a stub of the very query whose result is the input. The claims
 * below are source-level facts, which is what a source-level guard can prove.
 * The WRITE half is covered behaviourally in
 * `packages/notifications/test/utils/comp-grant-metadata.test.ts`.
 *
 * @module test/services/notification-retry-comp-payload.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RETRY_SERVICE = resolve(__dirname, '../../src/services/notification-retry.service.ts');

/**
 * Remove comments so the guard cannot be satisfied by prose.
 *
 * Block comments before line comments — the reverse order lets a `/*` inside a
 * `//` line survive as an unterminated opener that swallows the rest of the
 * file, and a guard reading a truncated file cannot fail for anything it never
 * saw. This module's own header names every token below, which is exactly the
 * prose that would otherwise satisfy it.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * The body of the `COMP_GRANTED` case, from its label to the next `case` or
 * `default`. Scoping to the case matters: a file-wide search would be satisfied
 * by another branch's `metadata.planName`.
 */
function compGrantedCaseBody(source: string): string {
    const start = source.indexOf('case NotificationType.COMP_GRANTED:');
    if (start === -1) return '';
    const rest = source.slice(start + 1);
    const end = rest.search(/\n\s{8}(?:case |default:)/);
    return end === -1 ? rest : rest.slice(0, end);
}

describe('HOS-1171 retried comp email — payload reconstruction guard', () => {
    const source = stripComments(readFileSync(RETRY_SERVICE, 'utf-8'));
    const caseBody = compGrantedCaseBody(source);

    it('reconstructPayload handles COMP_GRANTED explicitly', () => {
        expect(
            caseBody.length,
            'notification-retry.service.ts has no `case NotificationType.COMP_GRANTED:`. ' +
                'Without it the type falls into `default: return basePayload`, and the retried ' +
                'email loses both `planName` and `hadActiveBilling`.'
        ).toBeGreaterThan(0);
    });

    it('reads planName back out of metadata', () => {
        expect(caseBody).toContain('metadata.planName');
    });

    it('reads hadActiveBilling back out of metadata', () => {
        expect(
            caseBody,
            'The comp email branches on `hadActiveBilling`. Not reading it back means every ' +
                'retry sends the variant for a customer who never gave us a card.'
        ).toContain('metadata.hadActiveBilling');
    });

    it('defaults hadActiveBilling with ?? and never with ||', () => {
        // The subtle half. `||` treats a correctly-persisted `false` as absent
        // and rewrites it to the fallback, which is the same lie from the other
        // direction — and it is the operator anyone would reach for by copying
        // the `(metadata.x as string) || 'y'` lines directly above.
        expect(caseBody).toMatch(/hadActiveBilling:\s*\(metadata\.hadActiveBilling[^)]*\)\s*\?\?/);
        expect(
            /hadActiveBilling:[^\n]*\|\|/.test(caseBody),
            'hadActiveBilling is defaulted with `||`, which rewrites a persisted `false` into ' +
                'the fallback. Use `??`.'
        ).toBe(false);
    });
});

describe('HOS-1171 comp fields are persisted on the way in', () => {
    it('logNotification spreads buildCompGrantMetadata', () => {
        // Reading the metadata back is only half the round trip: nothing writes
        // these fields unless `logNotification` is told to. Guarded here, beside
        // the read, because the two are useless apart and live in different
        // packages — the failure mode is fixing one and shipping.
        const notificationService = stripComments(
            readFileSync(
                resolve(
                    __dirname,
                    '../../../../packages/notifications/src/services/notification.service.ts'
                ),
                'utf-8'
            )
        );

        expect(notificationService).toContain('buildCompGrantMetadata(payload)');
    });
});
