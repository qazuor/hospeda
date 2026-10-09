import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    billingOptions,
    eq,
    getDb,
    type PendingAuthorizationRow,
    plans,
    planVersions,
    subscriptionModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type AuthorizeInput,
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationCreation,
    type PaymentProvider,
    sanitizeApprovalUrl
} from '@repo/payments';
import { BILLING_CYCLE_MONTHS, type BillingCycle, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import { readAnchoredBillingOption } from '../read-anchored-billing-option';
import { resolveLiveCommitmentReuse } from './resolve-live-commitment';

const logger = createLogger('subscription-start');

/** The four settled outcomes of the notice required before a cancellation. */
export type BeforeCancelNoticeStatus =
    | 'SENT'
    | 'NO_RECIPIENT'
    | 'DELIVERY_EXHAUSTED'
    | 'NOT_YET_SENT';

/** Enqueue and inspect the once-per-cancellation notice. */
export interface BeforeCancelNotice {
    beforeCancel(input: {
        readonly subscriptionId: string;
        readonly userId: string;
    }): Promise<BeforeCancelNoticeStatus>;
}

export interface StartSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly planPolicy: VerticalsForBilling['planPolicy'];
    readonly beforeCancelNotice: BeforeCancelNotice;
}

export interface StartSubscriptionInput {
    readonly userId: string;
    readonly billingOptionId: string;
    readonly returnUrl: string;
    readonly payerEmail?: string;
    readonly paymentToken?: string;
}

export interface StartSubscriptionResult {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly checkoutUrl: string;
}

/** Shared guard for both the new signup and the later succession branch. */
export async function assertPlanForSale(input: {
    readonly planVersionId: string;
    readonly planPolicy: VerticalsForBilling['planPolicy'];
}): Promise<void> {
    const policy = await input.planPolicy({ planVersionId: input.planVersionId });
    if (!policy.current || !policy.sellable) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'This plan is no longer for sale',
            undefined,
            'PLAN_NOT_FOR_SALE'
        );
    }
}

/** Provider phase, after the durable row/key transaction has committed. */
export async function authorizePendingSubscription(input: {
    readonly pending: PendingAuthorizationRow;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly reason: string;
    readonly returnUrl: string;
    readonly payerEmail?: string;
    readonly paymentToken?: string;
    readonly firstChargeAt?: string;
}): Promise<StartSubscriptionResult> {
    const { pending } = input;
    const { planVersionId, billingOptionId } = pending.subscription;
    if (!planVersionId || !billingOptionId)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Pending authorization has no plan anchor'
        );
    const option = await readAnchoredBillingOption({
        subscription: { planVersionId, billingOptionId }
    });
    if (!option)
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Anchored billing option missing');
    const cadence = BILLING_CYCLE_MONTHS[option.cycle as BillingCycle];
    if (!cadence)
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Unsupported billing cycle');
    const sent: AuthorizeInput = {
        reference: pending.subscription.id,
        amount: { amountMinor: option.amount, currency: option.currency },
        cadence: { everyMonths: cadence },
        reason: input.reason,
        returnUrl: input.returnUrl,
        payerEmail: input.payerEmail,
        paymentToken: input.paymentToken,
        firstChargeAt: input.firstChargeAt
    };
    const act = { kind: 'decision' as const, startedAt: input.clock.now() };
    actStartInstant({ act });
    const created = await input.provider.authorize(sent);
    const confirmation = await confirmAuthorizationCreation({
        provider: input.provider,
        authorizationId: created.authorizationId,
        sent
    });
    assertFreshForAct({ read: confirmation.read, act });
    const applied = confirmation.outcome === 'applied';
    const fields = applied ? [] : confirmation.unapplied.map(({ field }) => field);
    const checkoutUrl = applied ? sanitizeApprovalUrl(created).url : undefined;
    await subscriptionModel.recordAuthorizationResult({
        idempotencyKey: pending.idempotencyKey,
        subscriptionId: pending.subscription.id,
        provider: 'MERCADO_PAGO',
        providerId: created.authorizationId,
        result: applied
            ? { authorizationId: created.authorizationId, applied: true, checkoutUrl }
            : { authorizationId: created.authorizationId, applied: false, fields },
        completedAt: input.clock.now()
    });
    if (!applied) {
        logger.error(
            {
                subscriptionId: pending.subscription.id,
                authorizationId: created.authorizationId,
                fields
            },
            'Created authorization differs from requested fields'
        );
        throw new ServiceError(
            ServiceErrorCode.PROVIDER_ERROR,
            'Created authorization differs from requested fields',
            undefined,
            'CREATION_NOT_APPLIED'
        );
    }
    if (!checkoutUrl)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Approval URL missing after confirmation'
        );
    return {
        subscriptionId: pending.subscription.id,
        authorizationId: created.authorizationId,
        checkoutUrl
    };
}

/** S1: a new card subscription, with the durable lock committed before the provider call. */
export async function startSubscription(
    input: StartSubscriptionInput,
    ports: StartSubscriptionPorts
): Promise<StartSubscriptionResult> {
    const [choice] = await getDb()
        .select({
            id: billingOptions.id,
            planVersionId: billingOptions.planVersionId,
            vertical: planVersions.vertical,
            planName: plans.name
        })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(eq(billingOptions.id, input.billingOptionId))
        .limit(1);
    if (!choice) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Billing option not found');
    await assertPlanForSale({ planVersionId: choice.planVersionId, planPolicy: ports.planPolicy });

    const declined = await subscriptionModel.findDeclinedWithProviderLinks({
        userId: input.userId,
        vertical: choice.vertical
    });
    let closing = false;
    for (const row of declined) {
        if (!row.providerLink) {
            closing = true;
            continue;
        }
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readAuthorization({
            authorizationId: row.providerLink.providerId
        });
        const { snapshot } = assertFreshForAct({ read, act });
        if (snapshot.status === 'cancelled') continue;
        closing = true;
        const notice = await ports.beforeCancelNotice.beforeCancel({
            subscriptionId: row.subscription.id,
            userId: input.userId
        });
        if (notice === 'SENT' || notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
            try {
                await ports.provider.cancel({ authorizationId: row.providerLink.providerId });
            } catch (error) {
                logger.error(
                    {
                        subscriptionId: row.subscription.id,
                        authorizationId: row.providerLink.providerId,
                        error
                    },
                    'Previous declined authorization could not be cancelled'
                );
            }
        }
    }
    if (closing)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Previous attempt is closing; try again in a few minutes',
            undefined,
            'PREVIOUS_ATTEMPT_CLOSING'
        );

    // AC:B3:6 — the live commitment decides first. If it is a reusable pending
    // row, S1 answers with what is stored; otherwise it is the same 409 as
    // before. No lock, no wait: the reuse is a consequence of the row and the
    // partial unique index.
    const existing = await subscriptionModel.findLiveCommitment({
        userId: input.userId,
        vertical: choice.vertical
    });
    if (existing)
        return resolveLiveCommitmentReuse({
            commitment: existing,
            billingOptionId: choice.id,
            clock: ports.clock
        });

    const deadlines = await getCurrentBillingDeadlines();
    const authorizationWindowEndsAt = new Date(
        ports.clock.now().getTime() + deadlines.values['10'].cardHours * 60 * 60 * 1000
    );
    let pending: PendingAuthorizationRow;
    try {
        pending = await subscriptionModel.createPendingAuthorization({
            userId: input.userId,
            vertical: choice.vertical,
            planVersionId: choice.planVersionId,
            billingOptionId: choice.id,
            authorizationWindowDeadlineVersion: deadlines.version,
            authorizationWindowEndsAt
        });
    } catch (error) {
        // The loser of a simultaneous race hits the partial unique index, not a
        // pre-check: read the commitment the winner just committed and resolve
        // it the same way (reuse, or COMMITMENT_TAKEN while it is in flight).
        const cause = extractPostgresErrorCause(error);
        if (cause?.code !== '23505' || cause.constraint !== 'uq_subscription_commitment_origin')
            throw error;
        const raced = await subscriptionModel.findLiveCommitment({
            userId: input.userId,
            vertical: choice.vertical
        });
        if (!raced) throw error;
        return resolveLiveCommitmentReuse({
            commitment: raced,
            billingOptionId: choice.id,
            clock: ports.clock
        });
    }
    return authorizePendingSubscription({
        pending,
        provider: ports.provider,
        clock: ports.clock,
        reason: choice.planName,
        returnUrl: input.returnUrl,
        payerEmail: input.payerEmail,
        paymentToken: input.paymentToken
    });
}
