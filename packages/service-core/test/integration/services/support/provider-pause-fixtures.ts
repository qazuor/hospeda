import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { eq, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import type { CoverageNotices } from '../../../../src/services/billing/payment/payment-ports.js';
import { createGraceExpiryCheck } from '../../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { createProviderPauseCheck } from '../../../../src/services/billing/reconciliation/sweep/provider-pause-check.js';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';
import { graceFixture, graceWithFailedCycle } from './grace-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';
import {
    retireSuccessorGraceRows,
    type SeededSuccessorCase,
    sweepInput
} from './successor-grace-fixtures.js';

/** Creates a paused-preapproval test subject and the two ordered sweep checks. */
export async function providerPauseFixture(
    input: {
        readonly grace?: boolean;
        readonly approveOnAttempt?: 2 | 3 | 4;
        readonly deliver?: boolean;
        readonly activeApprovedCycle?: boolean;
    } = {}
) {
    let fixture: Awaited<ReturnType<typeof graceFixture>>;
    let advanceAttempt: ((attempt: 2 | 3 | 4) => void) | undefined;
    let chargeId: string | null = null;
    if (input.grace) {
        const failedFixture = await graceWithFailedCycle({
            approveOnAttempt: input.approveOnAttempt
        });
        fixture = failedFixture;
        chargeId = failedFixture.chargeId;
        advanceAttempt = failedFixture.advanceToAttempt;
    } else {
        fixture = await graceFixture();
    }
    if (!input.grace && !input.activeApprovedCycle) {
        const failed = await fixture.provider.failChargeCycle({
            authorizationId: fixture.started.authorizationId,
            declineReason: 'issuer_declined'
        });
        chargeId = failed.chargeId;
    }
    if (input.activeApprovedCycle) {
        const failed = await fixture.provider.failChargeCycle({
            authorizationId: fixture.started.authorizationId,
            declineReason: 'issuer_declined',
            approveOnAttempt: 2
        });
        chargeId = failed.chargeId;
        const read = await fixture.provider.readCharge({ chargeId: failed.chargeId });
        const createdAt = Date.parse(read.snapshot.createdAt);
        const expiresAt = Date.parse(read.snapshot.expiresAt ?? read.snapshot.createdAt);
        advanceAttempt = () => {
            const at = createdAt + (expiresAt - createdAt) / 4;
            fixture.clock.advance({ ms: Math.max(0, at - fixture.clock.now().getTime()) });
        };
    }
    const subscriptionId = fixture.started.subscriptionId;
    const [subscription] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!subscription) throw new Error('Provider pause fixture subscription missing');

    const cancel = vi.fn<PaymentProvider['cancel']>((call) => fixture.provider.cancel(call));
    const provider: PaymentProvider = new Proxy(fixture.provider, {
        get(target, property, receiver) {
            if (property === 'cancel') return cancel;
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    let deliver = input.deliver ?? true;
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>((notice) =>
        outboxBeforeCancelNotice({ deliver }).beforeCancel(notice)
    );
    const coverage: { event: CoverageChangedEvent; statusCommitted: string | undefined }[] = [];
    const coverageNotices: CoverageNotices = {
        async emitCoverageChanged(event) {
            const [committed] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, subscriptionId));
            coverage.push({ event, statusCommitted: committed?.status });
        }
    };
    const ports = {
        provider,
        clock: fixture.clock,
        beforeCancelNotice: { beforeCancel } satisfies BeforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy,
        coverageNotices
    };
    const seeded: SeededSuccessorCase = {
        subscriptionIds: [subscriptionId],
        userId: fixture.user.id
    };
    const runPauseCheck = async () =>
        createProviderPauseCheck(ports)(await sweepInput(subscriptionId, provider, fixture.clock));
    const runSweepDay = async () => {
        await runPauseCheck();
        await createGraceExpiryCheck(ports)(
            await sweepInput(subscriptionId, provider, fixture.clock)
        );
    };
    return {
        fixture,
        subscription,
        subscriptionId,
        provider,
        cancel,
        beforeCancel,
        coverage,
        ports,
        seeded,
        runPauseCheck,
        runSweepDay,
        pause: () => fixture.provider.pause({ authorizationId: fixture.started.authorizationId }),
        advanceToAttempt: (attempt: 2 | 3 | 4) => {
            if (!advanceAttempt) throw new Error('Fixture has no failed charge cycle');
            advanceAttempt(attempt);
        },
        failedChargeId: chargeId,
        setDeliver: (value: boolean) => {
            deliver = value;
        },
        retire: () => retireSuccessorGraceRows([seeded])
    };
}
