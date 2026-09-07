/**
 * `buildCompGrantMetadata` — the write half of the comp-grant retry round trip
 * (HOS-1171).
 *
 * A notification that fails to send is rebuilt on retry from
 * `billing_notification_log.metadata` and nothing else, so a field that is not
 * persisted here does not exist for the retry. For `CompGranted` that is not a
 * cosmetic loss: without `hadActiveBilling` the retry sends the "you never gave
 * us a card" variant to someone whose MercadoPago preapproval was just
 * hard-cancelled, dropping both the notice that their card will not be charged
 * again and the instruction for what to do if it is.
 *
 * @module test/utils/comp-grant-metadata.test
 */

import { describe, expect, it } from 'vitest';
import { type NotificationPayload, NotificationType } from '../../src/types/notification.types.js';
import { buildCompGrantMetadata } from '../../src/utils/comp-grant-metadata.js';

function compPayload(overrides: Record<string, unknown> = {}): NotificationPayload {
    return {
        type: NotificationType.COMP_GRANTED,
        recipientEmail: 'host@example.com',
        recipientName: 'Laura',
        planName: 'Plan Premium',
        hadActiveBilling: true,
        ...overrides
    } as NotificationPayload;
}

describe('buildCompGrantMetadata', () => {
    it('persists both fields a comp email needs', () => {
        expect(buildCompGrantMetadata(compPayload())).toStrictEqual({
            planName: 'Plan Premium',
            hadActiveBilling: true
        });
    });

    it('persists hadActiveBilling:false — it is an answer, not an absence', () => {
        // The assertion this file exists for. A truthiness check here (`if
        // (fields.hadActiveBilling)`) would drop `false`, and the retry's `??`
        // fallback would then supply `true` — telling a customer who never
        // subscribed that we cancelled a debit they never had.
        expect(buildCompGrantMetadata(compPayload({ hadActiveBilling: false }))).toStrictEqual({
            planName: 'Plan Premium',
            hadActiveBilling: false
        });
    });

    it('omits a non-boolean hadActiveBilling rather than coercing it', () => {
        const metadata = buildCompGrantMetadata(compPayload({ hadActiveBilling: 'yes' }));

        expect(metadata.hadActiveBilling).toBeUndefined();
    });

    it('adds no keys for an unrelated notification type', () => {
        // Spread into every log row, so it must not litter `undefined` keys onto
        // the metadata of notifications that have nothing to do with comps.
        const unrelated = {
            type: NotificationType.SUBSCRIPTION_CANCELLED,
            recipientEmail: 'x@example.com',
            recipientName: 'X'
        } as NotificationPayload;

        expect(buildCompGrantMetadata(unrelated)).toStrictEqual({});
    });

    it.each([
        NotificationType.TRIAL_ENDING_REMINDER,
        NotificationType.PAYMENT_FAILURE,
        NotificationType.RENEWAL_REMINDER
    ])('does not persist planName for %s, which carries one of its own', (type) => {
        // The three types this would otherwise have changed. Each reads
        // `metadata.planName` back on retry with a 'Plan' fallback, and each has
        // always hit that fallback because nothing ever persisted it. Matching
        // on SHAPE rather than on type is what would silently start rewording
        // three production emails, in a change about comps — so the assertion
        // names them instead of settling for "some other payload".
        const payload = {
            type,
            recipientEmail: 'x@example.com',
            recipientName: 'X',
            planName: 'Plan Premium'
        } as NotificationPayload;

        expect(buildCompGrantMetadata(payload)).toStrictEqual({});
    });

    it('omits an empty plan name instead of persisting a blank', () => {
        const metadata = buildCompGrantMetadata(compPayload({ planName: '' }));

        expect(metadata.planName).toBeUndefined();
    });
});
