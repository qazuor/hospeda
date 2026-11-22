import { and, coveredPeriods, type DrizzleClient, eq, isNull } from '@repo/db';
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

async function evaluateManualPaymentPeriod(input: {
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
    readonly periodAt?: Date;
    readonly acceptPeriod: (periodStart: Date) => Promise<boolean>;
}): Promise<ManualPaymentPeriod> {
    const candidate = candidateManualPaymentPeriod({
        ...input,
        now: input.periodAt ?? input.now
    });
    if (await input.acceptPeriod(candidate.periodStart)) return candidate;
    if (candidate.reimputedFrom) {
        const original = candidateManualPaymentPeriod({
            ...input,
            now: input.originalPeriodStart
        });
        if (await input.acceptPeriod(input.originalPeriodStart))
            return { ...original, reimputedFrom: null };
    }
    throw new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'MANUAL_PAYMENT_COVERAGE_CONFLICT',
        undefined,
        'MANUAL_PAYMENT_COVERAGE_CONFLICT'
    );
}

/**
 * Which of MP4's three period answers applies (B13a fila 10-bis):
 * - `WITHIN_PERIOD`: the installment's own period had not ended at the instant used;
 * - `REIMPUTED`: it had ended, and the payment moves to the period starting then;
 * - `C5_FALLBACK`: it had ended, the reimputed period was already covered (C5), and the
 *   payment went back to the original period with `reimputedFrom: null`.
 */
export type ManualPaymentPeriodCase = 'WITHIN_PERIOD' | 'REIMPUTED' | 'C5_FALLBACK';

/**
 * Classifies MP4's final period against its candidate. Pure.
 *
 * @param input.candidate - {@link candidateManualPaymentPeriod} at the instant used
 * @param input.chosen - The period MP4 ends up covering
 * @returns The period case
 */
export function resolveManualPaymentPeriodCase(input: {
    readonly candidate: ManualPaymentPeriod;
    readonly chosen: ManualPaymentPeriod;
}): ManualPaymentPeriodCase {
    if (input.candidate.reimputedFrom === null) return 'WITHIN_PERIOD';
    return input.chosen.reimputedFrom === null ? 'C5_FALLBACK' : 'REIMPUTED';
}

/** Evaluates MP4's C5 choice without claiming coverage. */
export async function previewManualPaymentPeriod(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
    readonly periodAt?: Date;
}): Promise<ManualPaymentPeriod & { readonly periodCase: ManualPaymentPeriodCase }> {
    const candidate = candidateManualPaymentPeriod({
        originalPeriodStart: input.originalPeriodStart,
        everyMonths: input.everyMonths,
        now: input.periodAt ?? input.now
    });
    const chosen = await evaluateManualPaymentPeriodReadOnly(input);
    return { ...chosen, periodCase: resolveManualPaymentPeriodCase({ candidate, chosen }) };
}

async function evaluateManualPaymentPeriodReadOnly(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
    readonly periodAt?: Date;
}): Promise<ManualPaymentPeriod> {
    return evaluateManualPaymentPeriod({
        ...input,
        acceptPeriod: async (periodStart) => {
            const [covered] = await input.tx
                .select({ id: coveredPeriods.id })
                .from(coveredPeriods)
                .where(
                    and(
                        eq(coveredPeriods.subscriptionId, input.subscriptionId),
                        eq(coveredPeriods.periodStart, periodStart),
                        isNull(coveredPeriods.releasedAt)
                    )
                )
                .limit(1);
            return !covered;
        }
    });
}

/** Claims C5 in a savepoint; a reimputation collision retries the original period. */
export async function claimManualPaymentPeriod(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
    readonly originalPeriodStart: Date;
    readonly everyMonths: number;
    readonly now: Date;
    readonly periodAt?: Date;
}): Promise<ManualPaymentPeriod> {
    return evaluateManualPaymentPeriod({
        ...input,
        acceptPeriod: async (periodStart) => insertCoverage({ ...input, periodStart })
    });
}
