import { coveredPeriods, type DrizzleClient } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { billingPeriodEnd } from './billing-period-end';

const COVERAGE_INDEX = 'uq_covered_period_open_subscription_period';

/** The period MP4 ultimately covers after the C5 insert and any fallback. */
export interface ManualPaymentPeriod {
    readonly periodStart: Date;
    readonly reimputedFrom: Date | null;
    readonly nextChargeAt: Date;
}

/** Computes MP4's candidate period at the instant of reactivation. */
export function candidateManualPaymentPeriod(input: {
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
}): ManualPaymentPeriod {
    const expired =
        billingPeriodEnd({
            periodStart: input.originalPeriodStart,
            everyMonths: input.everyMonths
        }).periodEnd.getTime() <= input.now.getTime();
    const periodStart = expired ? input.now : input.originalPeriodStart;
    return {
        periodStart,
        reimputedFrom: expired ? input.originalPeriodStart : null,
        nextChargeAt: billingPeriodEnd({ periodStart, everyMonths: input.everyMonths }).periodEnd
    };
}

async function insertCoverage(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly periodStart: Date;
    readonly now: Date;
}): Promise<boolean> {
    try {
        await input.tx.transaction(async (savepoint) => {
            await savepoint.insert(coveredPeriods).values({
                subscriptionId: input.subscriptionId,
                manualPaymentId: input.manualPaymentId,
                periodStart: input.periodStart,
                creditedAt: input.now
            });
        });
        return true;
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === COVERAGE_INDEX) return false;
        throw error;
    }
}

/** Claims C5 in a savepoint; a reimputation collision retries the original period. */
export async function claimManualPaymentPeriod(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
}): Promise<ManualPaymentPeriod> {
    const candidate = candidateManualPaymentPeriod(input);
    if (await insertCoverage({ ...input, periodStart: candidate.periodStart })) return candidate;
    if (candidate.reimputedFrom) {
        const original = candidateManualPaymentPeriod({
            ...input,
            now: input.originalPeriodStart
        });
        if (await insertCoverage({ ...input, periodStart: input.originalPeriodStart }))
            return { ...original, reimputedFrom: null };
    }
    throw new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'MANUAL_PAYMENT_COVERAGE_CONFLICT',
        undefined,
        'MANUAL_PAYMENT_COVERAGE_CONFLICT'
    );
}
