import type { DrizzleClient } from '@repo/db';
import { and, billingOptions, coveredPeriods, desc, eq, isNull, subscriptions } from '@repo/db';
import { BILLING_CYCLE_MONTHS, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import {
    type BillingOptionReader,
    readAnchoredBillingOption
} from '../read-anchored-billing-option.js';
import { billingPeriodEnd } from './billing-period-end.js';
import { successorDeclaredFromPayingBase } from './paying-predecessor-successor.js';

const inputSchema = z.strictObject({
    now: z.date(),
    paidPeriodStart: z.date().nullable(),
    everyMonths: z.number().int().min(1).max(12),
    creditEndsAt: z.date().nullable()
});

/** Validated facts consumed by the pure S11 service-end calculation. */
export interface S11ServiceEndInput {
    /** Instant at which the person requested cancellation. */
    readonly now: Date;
    /** Start of the latest unreleased covered period, regardless of payment source. */
    readonly paidPeriodStart: Date | null;
    /** Month count resolved from the subscription's anchored billing option. */
    readonly everyMonths: number;
    /** First charge date when the row is a paying-base successor, otherwise null. */
    readonly creditEndsAt: Date | null;
}
/** Result of calculating the end instant and its deciding basis. */
export interface S11ServiceEndResult {
    /** Latest end among paid service and successor credit, or `now` without either. */
    readonly serviceEndsAt: Date;
    /** Fact that determined the returned end; paid service wins ties. */
    readonly basis: 'PAID_PERIOD' | 'CREDIT' | 'NOW';
}

/**
 * Calculate S11's service end from the latest retained paid period and successor credit.
 *
 * @param input - The request instant, paid period, anchored cycle and successor credit
 * @returns The service end and the fact that determined it
 * @throws ZodError when a date or cycle length is invalid
 */
export function computeS11ServiceEnd(input: S11ServiceEndInput): S11ServiceEndResult {
    const value = inputSchema.parse(input);
    if (value.paidPeriodStart) {
        const paidEnd = billingPeriodEnd({
            periodStart: value.paidPeriodStart,
            everyMonths: value.everyMonths
        }).periodEnd;
        if (!value.creditEndsAt || paidEnd.getTime() >= value.creditEndsAt.getTime())
            return { serviceEndsAt: paidEnd, basis: 'PAID_PERIOD' };
        return { serviceEndsAt: value.creditEndsAt, basis: 'CREDIT' };
    }
    if (value.creditEndsAt) return { serviceEndsAt: value.creditEndsAt, basis: 'CREDIT' };
    return { serviceEndsAt: value.now, basis: 'NOW' };
}

/** Subscription columns needed to read the paid period, anchor and succession credit. */
export interface S11ServiceEndSubscription {
    /** Subscription identifier used to find covered periods and a closed successor link. */
    readonly id: string;
    /** Anchored plan version; absent values indicate corrupt subscription data. */
    readonly planVersionId: string | null;
    /** Anchored billing option; absent values indicate corrupt subscription data. */
    readonly billingOptionId: string | null;
    /** Subscription class used by the paying-base predicate. */
    readonly class: string;
    /** Payment method used by the paying-base predicate. */
    readonly paymentMethod: string | null;
    /** Successor's first charge date, also the end of its credit. */
    readonly firstChargeAt: Date | null;
    /** End of the authorization window used to identify a shifted first charge. */
    readonly authorizationWindowEndsAt: Date | null;
    /** Direct predecessor id, or null when checking the predecessor's reverse link. */
    readonly succeedsId: string | null;
}
/** Database facts used by {@link computeS11ServiceEnd}. */
export interface S11ServiceEndFacts {
    /** Latest unreleased covered period start, from payment or manual payment. */
    readonly paidPeriodStart: Date | null;
    /** Month count of the subscription's immutable anchored billing option. */
    readonly everyMonths: number;
    /** Credit end for a qualifying successor; null for every other row. */
    readonly creditEndsAt: Date | null;
}

/**
 * Read all S11 date facts from the caller's transaction and the row's anchored option.
 *
 * @param input.tx - Transaction that owns the locked S11 read
 * @param input.subscription - Subscription row read under that transaction
 * @returns The latest retained paid period, anchored cycle and eligible credit
 * @throws ServiceError with `INTERNAL_ERROR` for missing or corrupt billing option data
 */
export async function readS11ServiceEndFacts(input: {
    readonly tx: DrizzleClient;
    readonly subscription: S11ServiceEndSubscription;
}): Promise<S11ServiceEndFacts> {
    const [period] = await input.tx
        .select()
        .from(coveredPeriods)
        .where(
            and(
                eq(coveredPeriods.subscriptionId, input.subscription.id),
                isNull(coveredPeriods.releasedAt)
            )
        )
        .orderBy(desc(coveredPeriods.periodStart))
        .limit(1);
    if (!input.subscription.planVersionId || !input.subscription.billingOptionId)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Anchored billing option identifiers are missing',
            undefined,
            'S11_ANCHORED_BILLING_OPTION_MISSING'
        );
    const anchoredSubscription = {
        ...input.subscription,
        planVersionId: input.subscription.planVersionId,
        billingOptionId: input.subscription.billingOptionId
    };
    const reader: BillingOptionReader = {
        async findByVersionAndId({ planVersionId, billingOptionId }) {
            const [option] = await input.tx
                .select()
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, planVersionId),
                        eq(billingOptions.id, billingOptionId)
                    )
                )
                .limit(1);
            return option
                ? {
                      id: option.id,
                      planVersionId: option.planVersionId,
                      cycle: option.cycle,
                      amount: option.amount,
                      currency: option.currency
                  }
                : null;
        }
    };
    const option = await readAnchoredBillingOption({ subscription: anchoredSubscription, reader });
    if (!option)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Anchored billing option is missing',
            undefined,
            'S11_ANCHORED_BILLING_OPTION_MISSING'
        );
    const everyMonths = BILLING_CYCLE_MONTHS[option.cycle as keyof typeof BILLING_CYCLE_MONTHS];
    if (everyMonths === undefined)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Anchored billing option has an unknown cycle',
            undefined,
            'S11_UNKNOWN_BILLING_CYCLE'
        );
    const [predecessor] =
        input.subscription.succeedsId === null
            ? await input.tx
                  .select({
                      class: subscriptions.class,
                      paymentMethod: subscriptions.paymentMethod
                  })
                  .from(subscriptions)
                  .where(eq(subscriptions.succeededById, input.subscription.id))
                  .limit(1)
            : await input.tx
                  .select({
                      class: subscriptions.class,
                      paymentMethod: subscriptions.paymentMethod
                  })
                  .from(subscriptions)
                  .where(eq(subscriptions.id, input.subscription.succeedsId))
                  .limit(1);
    const successor = {
        class: input.subscription.class,
        paymentMethod: input.subscription.paymentMethod,
        firstChargeAt: input.subscription.firstChargeAt,
        authorizationWindowEndsAt: input.subscription.authorizationWindowEndsAt
    };
    const hasPredecessor = input.subscription.succeedsId !== null || predecessor !== undefined;
    const creditEndsAt =
        hasPredecessor && successorDeclaredFromPayingBase({ successor })
            ? input.subscription.firstChargeAt
            : null;
    return { paidPeriodStart: period?.periodStart ?? null, everyMonths, creditEndsAt };
}
