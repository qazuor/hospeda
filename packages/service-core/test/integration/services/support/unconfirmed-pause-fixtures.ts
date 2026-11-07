import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import { vi } from 'vitest';
import type { BillingFact } from '../../../../src/services/billing/facts/billing-fact-sink.js';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import { createProviderPauseCheck } from '../../../../src/services/billing/reconciliation/sweep/provider-pause-check.js';
import type { ComplementPolicyPorts } from '../../../../src/services/billing/subscription/complement-ports.js';
import { pauseSubscription } from '../../../../src/services/billing/subscription/pause-subscription.service.js';
import { resumeSubscription } from '../../../../src/services/billing/subscription/resume-subscription.service.js';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { graceFixture } from './grace-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';
import { sweepInput } from './successor-grace-fixtures.js';

/** Allows S8 for the paid principal while retaining the normal grace duration. */
export const allowsPause: VerticalsForBilling['planPolicy'] = async () => ({
    graceDays: 7,
    allowsPause: true,
    current: true,
    sellable: true
});

const complements: ComplementPolicyPorts = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};

/** Builds a paid card principal and instruments its provider mutation and S6 notice. */
export async function unconfirmedPauseFixture() {
    const fixture = await graceFixture({ planPolicy: allowsPause });
    const authorizationId = fixture.started.authorizationId;
    let pauseAcknowledgesOnly = false;
    let resumeAcknowledgesOnly = false;
    const cancel = vi.fn<PaymentProvider['cancel']>((input) => fixture.provider.cancel(input));
    const provider = new Proxy(fixture.provider, {
        get(target, property, receiver) {
            if (property === 'pause' && pauseAcknowledgesOnly)
                return async () => ({ accepted: true as const, resourceId: authorizationId });
            if (property === 'resume' && resumeAcknowledgesOnly)
                return async () => ({ accepted: true as const, resourceId: authorizationId });
            if (property === 'cancel') return cancel;
            const method = Reflect.get(target, property, receiver);
            return typeof method === 'function' ? method.bind(target) : method;
        }
    }) satisfies PaymentProvider;
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>((notice) =>
        outboxBeforeCancelNotice({ deliver: true }).beforeCancel(notice)
    );
    const facts: BillingFact[] = [];
    const ports = {
        provider,
        clock: fixture.clock,
        beforeCancelNotice: { beforeCancel } satisfies BeforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        billingFacts: {
            emit: (fact: BillingFact) => {
                facts.push(fact);
            }
        },
        planPolicy: allowsPause,
        coverageNotices: fixture.coverageNotices
    };
    const subscriptionId = fixture.started.subscriptionId;
    return {
        fixture,
        subscriptionId,
        authorizationId,
        provider,
        cancel,
        beforeCancel,
        facts,
        ports,
        pause: async (acknowledgeOnly: boolean) => {
            pauseAcknowledgesOnly = acknowledgeOnly;
            return pauseSubscription(
                { subscriptionId, requestedMonths: 2 },
                {
                    provider,
                    clock: fixture.clock,
                    planPolicy: allowsPause,
                    complements,
                    coverageNotices: fixture.coverageNotices
                }
            );
        },
        resume: async (acknowledgeOnly: boolean) => {
            resumeAcknowledgesOnly = acknowledgeOnly;
            return resumeSubscription(
                { subscriptionId, cause: 'EARLY' },
                {
                    provider,
                    clock: fixture.clock,
                    complements,
                    coverageNotices: fixture.coverageNotices
                }
            );
        },
        applyLatePause: () => fixture.provider.pause({ authorizationId }),
        prepareUnpaidCycle: () =>
            fixture.provider.failChargeCycle({
                authorizationId,
                declineReason: 'issuer_declined'
            }),
        runPauseCheck: async () =>
            createProviderPauseCheck(ports)(
                await sweepInput(subscriptionId, provider, fixture.clock)
            )
    };
}
