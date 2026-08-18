/**
 * @file benefit-usage-view.test.ts
 * @description Pure view logic behind `/mi-cuenta/usos-de-beneficio` (HOS-376 T-046).
 *
 * Three decisions live here rather than inside the island, because each is the
 * kind that a refactor breaks without changing anything visible in a smoke test:
 *
 *  - Who may undo a rejection. The protected payload carries `rejectedAt` but
 *    NOT `rejectedById`, so the answer is DERIVED from the state machine: only
 *    the counterpart of `declaredBy` can reject, so on the host's own page a
 *    REJECTED row declared by the PROVIDER is one the host himself refused.
 *  - Reading `servicedAt` as a calendar day. It is a `YYYY-MM-DD` string; the
 *    naive `new Date(str)` is UTC midnight, which renders as the PREVIOUS day
 *    for every UTC-3 reader — the exact bug the write path was built to avoid.
 *  - Which rows belong in the inbox at all.
 */

import { describe, expect, it } from 'vitest';
import {
    canUndoRejection,
    canUndoRejectionFrom,
    isAwaitingAnswerFrom,
    isAwaitingHostAnswer,
    parseCalendarDate
} from '../../../src/lib/host/benefit-usage-view';

/** A usage row carrying only the fields the view logic reads. */
function usage(overrides: Partial<Parameters<typeof canUndoRejection>[0]> = {}) {
    return {
        status: 'PENDING' as const,
        declaredBy: 'PROVIDER' as const,
        ...overrides
    };
}

/**
 * The mirror half of the flow (H-06/H-65/H-159).
 *
 * These two tables exist because the provider's side of "A declara, B confirma"
 * was never built: a usage a host declared sat PENDING until it expired, since
 * the only screen that could answer it belonged to the host. Asserting BOTH
 * sides of the same predicate is what makes the symmetry a property of the code
 * rather than a coincidence of whichever screen was written first.
 */
describe('isAwaitingAnswerFrom / canUndoRejectionFrom — both sides', () => {
    it.each([
        // declaredBy, side, awaits an answer from side
        ['PROVIDER', 'HOST', true],
        ['HOST', 'PROVIDER', true],
        ['HOST', 'HOST', false],
        ['PROVIDER', 'PROVIDER', false]
    ] as const)('a PENDING row declared by %s awaits %s: %s', (declaredBy, side, expected) => {
        expect(isAwaitingAnswerFrom(usage({ status: 'PENDING', declaredBy }), side)).toBe(expected);
    });

    it.each([
        ['PROVIDER', 'HOST', true],
        ['HOST', 'PROVIDER', true],
        ['HOST', 'HOST', false],
        ['PROVIDER', 'PROVIDER', false]
    ] as const)('a REJECTED row declared by %s may be undone by %s: %s', (declaredBy, side, expected) => {
        expect(canUndoRejectionFrom(usage({ status: 'REJECTED', declaredBy }), side)).toBe(
            expected
        );
    });

    it.each(['CONFIRMED', 'EXPIRED'] as const)('leaves a %s row inert for both sides', (status) => {
        for (const side of ['HOST', 'PROVIDER'] as const) {
            expect(isAwaitingAnswerFrom(usage({ status, declaredBy: 'HOST' }), side)).toBe(false);
            expect(canUndoRejectionFrom(usage({ status, declaredBy: 'HOST' }), side)).toBe(false);
        }
    });
});

describe('canUndoRejection', () => {
    it('allows undoing a provider-declared usage the host rejected', () => {
        expect(canUndoRejection(usage({ status: 'REJECTED', declaredBy: 'PROVIDER' }))).toBe(true);
    });

    it('refuses to offer undo when the PROVIDER was the one who rejected', () => {
        // The host declared it, so the provider is the counterpart who refused.
        // Offering "undo" here would render a button whose request answers 404 —
        // only the account that rejected may reverse it, which is what keeps a
        // rejection from being reversible by the party it was aimed at.
        expect(canUndoRejection(usage({ status: 'REJECTED', declaredBy: 'HOST' }))).toBe(false);
    });

    it.each([
        'PENDING',
        'CONFIRMED',
        'EXPIRED'
    ] as const)('offers nothing to undo on a %s row', (status) => {
        expect(canUndoRejection(usage({ status, declaredBy: 'PROVIDER' }))).toBe(false);
    });
});

describe('isAwaitingHostAnswer', () => {
    it('claims a PENDING usage the provider declared', () => {
        expect(isAwaitingHostAnswer(usage({ status: 'PENDING', declaredBy: 'PROVIDER' }))).toBe(
            true
        );
    });

    it('does NOT claim the host’s own pending declaration', () => {
        // It waits on the provider. Showing it among "awaiting your answer"
        // would put a row in the inbox that the host cannot act on at all.
        expect(isAwaitingHostAnswer(usage({ status: 'PENDING', declaredBy: 'HOST' }))).toBe(false);
    });

    it.each([
        'CONFIRMED',
        'REJECTED',
        'EXPIRED'
    ] as const)('does not claim a %s row, whoever declared it', (status) => {
        expect(isAwaitingHostAnswer(usage({ status, declaredBy: 'PROVIDER' }))).toBe(false);
    });
});

describe('parseCalendarDate', () => {
    it('reads the day as written, not as UTC midnight', () => {
        const parsed = parseCalendarDate('2026-08-01');

        // The assertion is on the LOCAL day, which is what gets rendered.
        // `new Date('2026-08-01')` would be 2026-07-31 21:00 in UTC-3.
        expect(parsed?.getFullYear()).toBe(2026);
        expect(parsed?.getMonth()).toBe(7);
        expect(parsed?.getDate()).toBe(1);
    });

    it('reads the first day of a month without rolling back into the previous one', () => {
        const parsed = parseCalendarDate('2026-01-01');

        expect(parsed?.getFullYear()).toBe(2026);
        expect(parsed?.getMonth()).toBe(0);
        expect(parsed?.getDate()).toBe(1);
    });

    it('answers null for a value that is not a calendar date', () => {
        // The alternative is an `Invalid Date` that formats as "Invalid Date"
        // in the middle of the history.
        expect(parseCalendarDate('')).toBeNull();
        expect(parseCalendarDate('01/08/2026')).toBeNull();
        expect(parseCalendarDate('2026-08-01T00:00:00Z')).toBeNull();
    });

    it('answers null for a well-shaped string that names no real day', () => {
        expect(parseCalendarDate('2026-02-31')).toBeNull();
        expect(parseCalendarDate('2026-13-01')).toBeNull();
    });
});
