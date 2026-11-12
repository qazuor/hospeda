import type { DrizzleClient, SelectSubscription } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    eq,
    partnerApplicationModel,
    plans,
    planVersions,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { isManualPaymentOnlyVertical } from '@repo/schemas';
import type {
    ExpectedAmount,
    ExpectedAmountPolicy
} from '../reconciliation/sweep/comparisons/expected-amount.js';
import { createCutExpectedAmountPolicy } from '../reconciliation/sweep/comparisons/expected-amount.js';

const logger = createLogger('manual-installment-opened-notice');
const READ_TIMEOUT_MS = 5_000;

async function readExpectedAmount(
    policy: ExpectedAmountPolicy,
    args: Parameters<ExpectedAmountPolicy['expectedAmount']>[0]
): Promise<ExpectedAmount> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            policy.expectedAmount(args),
            new Promise<never>((_resolve, reject) => {
                timeout = setTimeout(
                    () => reject(new Error('Expected installment amount lookup timed out')),
                    READ_TIMEOUT_MS
                );
            })
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

/** Outbox template mailed to the owner when a manual installment opens (HOS-2130). */
export const MANUAL_INSTALLMENT_OPENED_TEMPLATE = 'billing.manual-installment-opened';

/** Whether the owner of a manual installment is mailed: only verticals that pay manually (HOS-2130). */
export function isManualInstallmentOwnerNotified(input: {
    readonly vertical: string | null;
}): boolean {
    return input.vertical !== null && isManualPaymentOnlyVertical({ vertical: input.vertical });
}

/** Amount snapshot for the mail: ARS only, null when the policy cannot compute it (same rule as the c1 card). */
export function resolveInstallmentAmountSnapshot(input: {
    readonly expected: ExpectedAmount;
}): { readonly amountMinor: number; readonly currency: 'ARS' } | null {
    if (input.expected.kind !== 'COMPARABLE' || input.expected.currency !== 'ARS') return null;
    return { amountMinor: input.expected.amountMinor, currency: 'ARS' };
}

/** Pure payload of the owner mail. Dates serialize to ISO. */
export function buildManualInstallmentOpenedPayload(input: {
    readonly manualPaymentId: string;
    readonly subscriptionId: string;
    readonly locale: 'es' | 'en' | 'pt';
    readonly planSlug: string;
    readonly planName: string;
    readonly amount: { readonly amountMinor: number; readonly currency: 'ARS' } | null;
    readonly dueAt: Date;
    readonly firstInstallment: boolean;
}): {
    manualPaymentId: string;
    subscriptionId: string;
    locale: 'es' | 'en' | 'pt';
    planSlug: string;
    planName: string;
    amountMinor: number | null;
    currency: 'ARS' | null;
    dueAt: string;
    firstInstallment: boolean;
} {
    return {
        manualPaymentId: input.manualPaymentId,
        subscriptionId: input.subscriptionId,
        locale: input.locale,
        planSlug: input.planSlug,
        planName: input.planName,
        amountMinor: input.amount?.amountMinor ?? null,
        currency: input.amount?.currency ?? null,
        dueAt: input.dueAt.toISOString(),
        firstInstallment: input.firstInstallment
    };
}

/** Enqueues the owner mail inside the caller's installment transaction (HOS-2130). */
export async function enqueueManualInstallmentOpenedNotice(
    input: {
        readonly tx: DrizzleClient;
        readonly subscription: SelectSubscription;
        readonly manualPaymentId: string;
        readonly periodStart: Date;
        readonly dueAt: Date;
        readonly firstInstallment: boolean;
    },
    ports: {
        readonly expectedAmounts?: ExpectedAmountPolicy;
    } = {}
): Promise<{ readonly enqueued: boolean }> {
    const { subscription, tx } = input;
    if (!isManualInstallmentOwnerNotified({ vertical: subscription.vertical }))
        return { enqueued: false };
    const userId = subscription.userId;
    const [user] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId ?? ''))
        .limit(1);
    if (!userId || !user?.email) {
        logger.warn(
            { subscriptionId: subscription.id },
            'No user email for installment opened notice'
        );
        return { enqueued: false };
    }
    const locale = await partnerApplicationModel.readAccountLocaleByEmail({
        tx,
        email: user.email
    });
    const [plan] = subscription.planVersionId
        ? await tx
              .select({ slug: plans.slug, name: plans.name })
              .from(planVersions)
              .innerJoin(plans, eq(plans.id, planVersions.planId))
              .where(eq(planVersions.id, subscription.planVersionId))
              .limit(1)
        : [];
    if (!plan) {
        logger.warn({ subscriptionId: subscription.id }, 'No plan for installment opened notice');
        return { enqueued: false };
    }
    let amount: { readonly amountMinor: number; readonly currency: 'ARS' } | null = null;
    try {
        const expected = await readExpectedAmount(
            ports.expectedAmounts ?? createCutExpectedAmountPolicy(),
            {
                subscription,
                purpose: { kind: 'PERIOD', chargeCreatedAt: input.periodStart }
            }
        );
        amount = resolveInstallmentAmountSnapshot({ expected });
        if (!amount)
            logger.warn(
                { subscriptionId: subscription.id },
                'Installment amount is not comparable in ARS'
            );
    } catch (error) {
        logger.warn(
            { subscriptionId: subscription.id, error },
            'Could not calculate installment amount'
        );
    }
    const template = MANUAL_INSTALLMENT_OPENED_TEMPLATE;
    const result = await emailOutboxModel.enqueue(
        {
            recipientUserId: userId,
            recipientEmail: user.email,
            template,
            payload: buildManualInstallmentOpenedPayload({
                manualPaymentId: input.manualPaymentId,
                subscriptionId: subscription.id,
                locale,
                planSlug: plan.slug,
                planName: plan.name,
                amount,
                dueAt: input.dueAt,
                firstInstallment: input.firstInstallment
            }),
            dedupKey: buildEmailDedupKey({
                recipient: userId,
                template,
                occurrence: buildEventOccurrence({ eventId: input.manualPaymentId })
            })
        },
        tx
    );
    return { enqueued: result.enqueued };
}
