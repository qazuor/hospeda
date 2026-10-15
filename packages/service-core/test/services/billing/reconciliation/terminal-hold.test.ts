import { describe, expect, it } from 'vitest';
import {
    decideTerminalStay,
    terminalHoldCutoffs
} from '../../../../src/services/billing/reconciliation/sweep/terminal-hold.js';

const now = new Date('2026-10-15T00:00:00.000Z');
const day = 86_400_000;

describe('terminal hold rules', () => {
    it('builds per-cycle cutoffs and lets deadline 16 widen monthly', () => {
        const cuts = terminalHoldCutoffs({ now, window16Days: 45 });
        expect(cuts.monthly.getTime()).toBe(now.getTime() - 45 * day);
        expect(cuts.quarterly.getTime()).toBe(now.getTime() - 92 * day);
        expect(cuts.semiannual.getTime()).toBe(now.getTime() - 184 * day);
        expect(cuts.annual.getTime()).toBe(now.getTime() - 366 * day);
        expect(cuts.none.getTime()).toBe(now.getTime() - 366 * day);
    });

    it('chooses the first stay reason and expires rejection window at its end', () => {
        expect(
            decideTerminalStay({
                hasOpenMark: true,
                hasOpenRetention: true,
                rejectionTerminal: true,
                cancelledSeenAt: new Date(now.getTime() - day),
                now,
                window16Days: 7
            })
        ).toBe('OPEN_MARK');
        expect(
            decideTerminalStay({
                hasOpenMark: false,
                hasOpenRetention: true,
                rejectionTerminal: true,
                cancelledSeenAt: new Date(now.getTime() - day),
                now,
                window16Days: 7
            })
        ).toBe('OPEN_RETENTION');
        expect(
            decideTerminalStay({
                hasOpenMark: false,
                hasOpenRetention: false,
                rejectionTerminal: true,
                cancelledSeenAt: new Date(now.getTime() - 6 * day),
                now,
                window16Days: 7
            })
        ).toBe('REJECTION_WINDOW');
        expect(
            decideTerminalStay({
                hasOpenMark: false,
                hasOpenRetention: false,
                rejectionTerminal: true,
                cancelledSeenAt: new Date(now.getTime() - 7 * day),
                now,
                window16Days: 7
            })
        ).toBeNull();
        expect(
            decideTerminalStay({
                hasOpenMark: false,
                hasOpenRetention: false,
                rejectionTerminal: false,
                cancelledSeenAt: new Date(now.getTime() - day),
                now,
                window16Days: 7
            })
        ).toBeNull();
        expect(
            decideTerminalStay({
                hasOpenMark: false,
                hasOpenRetention: false,
                rejectionTerminal: true,
                cancelledSeenAt: null,
                now,
                window16Days: 7
            })
        ).toBeNull();
        expect(
            decideTerminalStay({
                hasOpenMark: false,
                hasOpenRetention: false,
                rejectionTerminal: false,
                cancelledSeenAt: null,
                now,
                window16Days: 7
            })
        ).toBeNull();
    });
});
