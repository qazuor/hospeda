import { coverageLosses, eq, inArray, reconciliationMarkPayments } from '@repo/db';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import { graceExpiredOccurrenceId } from '../../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { cancelDirectSubscription } from '../../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { createSuccessionCloser } from '../../../../src/services/billing/subscription/succession-closer.service.js';
import { suspendForArrears } from '../../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { getServiceTestDb } from '../helpers.js';
import { graceWithFailedCycle } from './grace-fixtures.js';
import { closePorts } from './succession-close-fixtures.js';
import {
    paymentFor,
    predecessorInGrace,
    retireSuccessionCases,
    type SeededSuccession,
    seedLiveSuccessor,
    subscriptionRow
} from './succession-retention-fixtures.js';

const seeded: SeededSuccession[] = [];

/** S19-retaining grace predecessor with a live successor. */
export async function retainingBranch6Predecessor() {
    const s = await predecessorInGrace({ approveOnAttempt: 2 });
    seeded.push(s.seeded);
    s.fixture.advanceToAttempt(2);
    const retained = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
    if (!('exit' in retained) || retained.exit?.outcome !== 'RETAINED_FOR_S19')
        throw new Error('S19 did not retain');
    const payment = await paymentFor(s.fixture.chargeId);
    return { s, paymentId: payment.id };
}

/** S6 suspends before succession opens; the later credited retry reaches S19 on SUSPENDED. */
export async function retainingSuspendedBranch6Predecessor() {
    const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
    const subscriptionId = fixture.started.subscriptionId;
    const inGrace = await subscriptionRow(subscriptionId);
    if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
    fixture.clock.advance({
        ms: inGrace.graceEndsAt.getTime() + 3_600_000 - fixture.clock.now().getTime()
    });
    const suspended = await suspendForArrears(
        {
            subscriptionId,
            event: 'GRACE_EXPIRED',
            occurrenceId: graceExpiredOccurrenceId({
                subscriptionId,
                graceEndsAt: inGrace.graceEndsAt
            })
        },
        {
            provider: fixture.provider,
            clock: fixture.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            coverageNotices: fixture.coverageNotices
        }
    );
    if (suspended.outcome !== 'SUSPENDED') throw new Error(`S6 returned ${suspended.outcome}`);
    const successor = await seedLiveSuccessor(fixture, subscriptionId);
    seeded.push({ subscriptionIds: [subscriptionId, successor.id], userId: fixture.user.id });
    fixture.advanceToAttempt(3);
    const retained = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
    if (retained.outcome !== 'CREDITED' || retained.reactivation?.outcome !== 'RETAINED_FOR_S19')
        throw new Error('S19 did not retain on SUSPENDED');
    const payment = await paymentFor(fixture.chargeId);
    return { s: { fixture, subscriptionId, chargePorts: fixture.ports }, paymentId: payment.id };
}

/** The real S23/S24 act with a real S18 closer and fake provider. */
export async function cancelBranch6(s: {
    fixture: Awaited<ReturnType<typeof graceWithFailedCycle>>;
    subscriptionId: string;
    chargePorts: Awaited<ReturnType<typeof predecessorInGrace>>['chargePorts'];
}) {
    return cancelDirectSubscription(
        {
            actor: { id: s.fixture.user.id, roles: [], permissions: [] },
            subscriptionId: s.subscriptionId
        },
        {
            provider: s.chargePorts.provider,
            clock: s.fixture.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            coverageNotices: s.chargePorts.coverageNotices,
            orphanhood: {
                addonPolicy: async () => {
                    throw new Error('unexpected addon policy');
                },
                listing: async () => {
                    throw new Error('unexpected listing');
                }
            },
            successionCloser: createSuccessionCloser(closePorts)
        }
    );
}

/** Reads the payment linkage for just one reconciliation mark. */
export async function hungPaymentIds(markId: string) {
    return getServiceTestDb()
        .select({ paymentId: reconciliationMarkPayments.paymentId })
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, markId));
}

/** Retire only rows seeded here and their coverage loss. */
export async function retireBranch6(): Promise<void> {
    const cases = seeded.splice(0);
    await retireSuccessionCases(cases);
    if (cases.length > 0)
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(
                inArray(
                    coverageLosses.userId,
                    cases.map((c) => c.userId)
                )
            );
}
