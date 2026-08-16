/**
 * Regression tests for H-137 — "se promete 14 días gratis y MercadoPago cobra
 * en el minuto 2".
 *
 * The production incident is reproduced verbatim in the first test, with the
 * exact timestamps taken from `billing_subscriptions 78599031` and
 * `billing_payments 14e0ebc8`. Everything else guards the two directions this
 * classifier must never get wrong: it must not miss a real broken promise, and
 * it must not slander a legitimate end-of-trial charge.
 */
import { describe, expect, it } from 'vitest';
import { classifySettledTrialCharge } from '../../../src/services/billing/trial-promise-verification.js';

/** The production H-137 subscription, to the second. */
const PROD_TRIAL_START = new Date('2026-08-14T16:46:17.963Z');
const PROD_TRIAL_END = new Date('2026-08-28T16:46:17.963Z');
const PROD_CHARGED_AT = new Date('2026-08-14T16:48:16.220Z');

const DAY_MS = 24 * 60 * 60 * 1000;

describe('classifySettledTrialCharge — H-137 regression', () => {
    it('flags the production incident: 14 days promised, charged 118 seconds in', () => {
        // Arrange — the exact prod row that cost $18.000.
        const input = {
            trialStart: PROD_TRIAL_START,
            trialEnd: PROD_TRIAL_END,
            chargedAt: PROD_CHARGED_AT
        };

        // Act
        const result = classifySettledTrialCharge(input);

        // Assert
        expect(result.outcome).toBe('trial-not-granted');
        expect(result.promisedTrialMs).toBe(14 * DAY_MS);
        // 118.257 seconds between `trial_start` and the settled charge. The
        // finding rounds this to "a los 119 segundos"; the rows say 118.257.
        expect(result.elapsedAtChargeMs).toBe(118_257);
    });

    it('does NOT flag the legitimate day-14 conversion charge', () => {
        // Arrange — same subscription, but MercadoPago honoured the trial and
        // charged when it ended.
        const input = {
            trialStart: PROD_TRIAL_START,
            trialEnd: PROD_TRIAL_END,
            chargedAt: PROD_TRIAL_END
        };

        // Act
        const result = classifySettledTrialCharge(input);

        // Assert
        expect(result.outcome).toBe('trial-elapsed');
    });

    it('does NOT flag a conversion charge that lands slightly AFTER the trial end', () => {
        // Arrange — the normal case: MercadoPago counts the trial from
        // authorization, which is later than our checkout timestamp, so the real
        // charge lands past the local window.
        const input = {
            trialStart: PROD_TRIAL_START,
            trialEnd: PROD_TRIAL_END,
            chargedAt: new Date(PROD_TRIAL_END.getTime() + 6 * 60 * 60 * 1000)
        };

        // Act
        const result = classifySettledTrialCharge(input);

        // Assert
        expect(result.outcome).toBe('trial-elapsed');
    });
});

describe('classifySettledTrialCharge — the threshold', () => {
    it('treats a charge at exactly half the promised window as legitimate', () => {
        // Arrange — the boundary is inclusive on the legitimate side, so the
        // rule can never accuse a charge that reached the halfway mark.
        const trialStart = new Date('2026-01-01T00:00:00.000Z');
        const trialEnd = new Date('2026-01-15T00:00:00.000Z');

        // Act
        const result = classifySettledTrialCharge({
            trialStart,
            trialEnd,
            chargedAt: new Date('2026-01-08T00:00:00.000Z')
        });

        // Assert
        expect(result.outcome).toBe('trial-elapsed');
    });

    it('flags a charge one millisecond below half the promised window', () => {
        // Arrange — the mirror of the test above. Together they pin the exact
        // boundary, so a change to the fraction cannot pass unnoticed.
        const trialStart = new Date('2026-01-01T00:00:00.000Z');
        const trialEnd = new Date('2026-01-15T00:00:00.000Z');

        // Act
        const result = classifySettledTrialCharge({
            trialStart,
            trialEnd,
            chargedAt: new Date(trialStart.getTime() + 7 * DAY_MS - 1)
        });

        // Assert
        expect(result.outcome).toBe('trial-not-granted');
    });

    it('scales to the 1-day QA plan, where a fixed 24h tolerance would never fire', () => {
        // Arrange — `owner-test-daily` promises a single day. A denied trial
        // charges within seconds; a fixed "more than 24 hours early" rule could
        // not distinguish the two at all.
        const trialStart = new Date('2026-08-13T18:43:22.401Z');
        const trialEnd = new Date('2026-08-14T18:43:22.401Z');

        // Act
        const denied = classifySettledTrialCharge({
            trialStart,
            trialEnd,
            chargedAt: new Date('2026-08-13T18:45:00.000Z')
        });
        const honoured = classifySettledTrialCharge({
            trialStart,
            trialEnd,
            chargedAt: trialEnd
        });

        // Assert
        expect(denied.outcome).toBe('trial-not-granted');
        expect(honoured.outcome).toBe('trial-elapsed');
    });

    it('scales to the 30-day host plan the owner decision moves to', () => {
        // Arrange — owner-* goes from 14 to 30 days. The same rule must hold
        // without retuning anything.
        const trialStart = new Date('2026-09-01T10:00:00.000Z');
        const trialEnd = new Date(trialStart.getTime() + 30 * DAY_MS);

        // Act
        const denied = classifySettledTrialCharge({
            trialStart,
            trialEnd,
            chargedAt: new Date(trialStart.getTime() + 2 * 60 * 1000)
        });
        const honoured = classifySettledTrialCharge({
            trialStart,
            trialEnd,
            chargedAt: trialEnd
        });

        // Assert
        expect(denied.outcome).toBe('trial-not-granted');
        expect(honoured.outcome).toBe('trial-elapsed');
    });
});

describe('classifySettledTrialCharge — rows with no promise to break', () => {
    it('returns no-trial-promised when the subscription never had a trial', () => {
        // Arrange — a plain paid subscription (`trialDays: 0`).
        // Act
        const result = classifySettledTrialCharge({
            trialStart: null,
            trialEnd: null,
            chargedAt: new Date('2026-08-14T16:48:16.220Z')
        });

        // Assert
        expect(result.outcome).toBe('no-trial-promised');
        expect(result.promisedTrialMs).toBeNull();
        expect(result.elapsedAtChargeMs).toBeNull();
    });

    it('returns no-trial-promised when only one end of the window is stored', () => {
        // Arrange — `trial_start` set but `trial_end` still null is the shape a
        // share-link row carries before HOS-211 resolves it. There is nothing to
        // measure against, and guessing would manufacture findings.
        // Act
        const startOnly = classifySettledTrialCharge({
            trialStart: PROD_TRIAL_START,
            trialEnd: null,
            chargedAt: PROD_CHARGED_AT
        });
        const endOnly = classifySettledTrialCharge({
            trialStart: null,
            trialEnd: PROD_TRIAL_END,
            chargedAt: PROD_CHARGED_AT
        });

        // Assert
        expect(startOnly.outcome).toBe('no-trial-promised');
        expect(endOnly.outcome).toBe('no-trial-promised');
    });

    it('returns no-trial-promised when the column was not selected at all (undefined, not null)', () => {
        // Arrange — a row projection that omits `trial_start` yields `undefined`,
        // which is NOT `null`. Collapsing only `null` let this fall through to
        // arithmetic on a missing date and threw inside the webhook handler.
        // Act
        const undefinedStart = classifySettledTrialCharge({
            trialStart: undefined,
            trialEnd: PROD_TRIAL_END,
            chargedAt: PROD_CHARGED_AT
        });
        const undefinedEnd = classifySettledTrialCharge({
            trialStart: PROD_TRIAL_START,
            trialEnd: undefined,
            chargedAt: PROD_CHARGED_AT
        });

        // Assert
        expect(undefinedStart.outcome).toBe('no-trial-promised');
        expect(undefinedEnd.outcome).toBe('no-trial-promised');
    });

    it('fails open on an unparseable timestamp rather than accusing', () => {
        // Arrange — a false accusation tells a paying customer we broke a promise
        // we kept; a missed detection only costs a log line.
        // Act
        const result = classifySettledTrialCharge({
            trialStart: new Date('not a date'),
            trialEnd: PROD_TRIAL_END,
            chargedAt: PROD_CHARGED_AT
        });

        // Assert
        expect(result.outcome).toBe('no-trial-promised');
    });

    it('returns no-trial-promised for a degenerate zero-length window', () => {
        // Arrange — equal timestamps advertise no free period.
        const instant = new Date('2026-08-14T16:46:17.963Z');

        // Act
        const result = classifySettledTrialCharge({
            trialStart: instant,
            trialEnd: instant,
            chargedAt: new Date('2026-08-14T16:48:16.220Z')
        });

        // Assert
        expect(result.outcome).toBe('no-trial-promised');
    });

    it('returns no-trial-promised when trial_end precedes trial_start', () => {
        // Arrange — an inverted window is corrupt data, not a broken promise.
        // Act
        const result = classifySettledTrialCharge({
            trialStart: PROD_TRIAL_END,
            trialEnd: PROD_TRIAL_START,
            chargedAt: PROD_CHARGED_AT
        });

        // Assert
        expect(result.outcome).toBe('no-trial-promised');
    });
});

describe('classifySettledTrialCharge — clock skew', () => {
    it('flags a charge that settles before the trial even started', () => {
        // Arrange — negative elapsed time. Whatever produced it, the customer
        // was charged during a period sold as free.
        // Act
        const result = classifySettledTrialCharge({
            trialStart: PROD_TRIAL_START,
            trialEnd: PROD_TRIAL_END,
            chargedAt: new Date(PROD_TRIAL_START.getTime() - 5_000)
        });

        // Assert
        expect(result.outcome).toBe('trial-not-granted');
        expect(result.elapsedAtChargeMs).toBe(-5_000);
    });
});
