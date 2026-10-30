import type { TerminalHoldCutoffs } from '@repo/db';
import { cancellationRereadWindowEndsAt } from '../../coverage/can-charge.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_DAYS = 31;
const QUARTER_DAYS = 92;
const HALF_YEAR_DAYS = 184;
const FULL_YEAR_DAYS = 366;

export const TERMINAL_HOLD_DAYS_BY_CYCLE = {
    monthly: MONTH_DAYS,
    quarterly: QUARTER_DAYS,
    semiannual: HALF_YEAR_DAYS,
    annual: FULL_YEAR_DAYS,
    none: FULL_YEAR_DAYS
} as const;

export function terminalHoldCutoffs(input: {
    readonly now: Date;
    readonly window16Days: number;
}): TerminalHoldCutoffs {
    const cutoff = (days: number) =>
        new Date(input.now.getTime() - Math.max(days, input.window16Days) * DAY_MS);
    return {
        monthly: cutoff(TERMINAL_HOLD_DAYS_BY_CYCLE.monthly),
        quarterly: cutoff(TERMINAL_HOLD_DAYS_BY_CYCLE.quarterly),
        semiannual: cutoff(TERMINAL_HOLD_DAYS_BY_CYCLE.semiannual),
        annual: cutoff(TERMINAL_HOLD_DAYS_BY_CYCLE.annual),
        none: cutoff(TERMINAL_HOLD_DAYS_BY_CYCLE.none)
    };
}

export type TerminalStayReason =
    | 'OPEN_MARK'
    | 'OPEN_RETENTION'
    | 'REJECTION_WINDOW'
    | 'PREAPPROVAL_ALIVE'
    | 'RECORD_OPEN';

export function decideTerminalStay(input: {
    readonly hasOpenMark: boolean;
    readonly hasOpenRetention: boolean;
    readonly rejectionTerminal: boolean;
    readonly cancelledSeenAt: Date | null;
    readonly now: Date;
    readonly window16Days: number;
}): TerminalStayReason | null {
    if (input.hasOpenMark) return 'OPEN_MARK';
    if (input.hasOpenRetention) return 'OPEN_RETENTION';
    if (
        input.rejectionTerminal &&
        input.cancelledSeenAt !== null &&
        input.now.getTime() <
            cancellationRereadWindowEndsAt({
                seenAt: input.cancelledSeenAt,
                days: input.window16Days
            }).getTime()
    )
        return 'REJECTION_WINDOW';
    return null;
}
