import { createLogger } from '@repo/logger';

const logger = createLogger('billing-unresolved-period-charge');

/** Why the `B/09` §4 read could not say whether the period charged. */
export type UnresolvedPeriodChargeReason =
    | 'INCOMPLETE_INVENTORY'
    | 'PENDING_CHARGE'
    | 'READ_FAILED';

/** One period charge still "unknown" more than a day after it started (`B/09` §6.2). */
export interface UnresolvedPeriodChargeNotice {
    readonly subscriptionId: string;
    /** The latest charge record read, or null when none could be read. */
    readonly chargeId: string | null;
    /** The instant the wait is measured from: the record's `date_created`, else `grace_started_at`. */
    readonly since: Date;
    readonly reason: UnresolvedPeriodChargeReason;
}

/**
 * The DEC-OBS-001 channel for a period charge still unresolved after a day
 * (AC:B7:8, I-10). The real channel (actionable list and aggregated email)
 * belongs to B11/B13a and replaces the logging default.
 */
export interface UnresolvedPeriodCharges {
    notify(input: UnresolvedPeriodChargeNotice): Promise<void>;
}

/** Default until B11/B13a wire the real channel: a structured warning. */
export const loggedUnresolvedPeriodCharges: UnresolvedPeriodCharges = {
    async notify(input) {
        logger.warn(
            {
                subscriptionId: input.subscriptionId,
                chargeId: input.chargeId,
                since: input.since.toISOString(),
                reason: input.reason
            },
            'Period charge still unresolved more than a day after it started'
        );
    }
};
