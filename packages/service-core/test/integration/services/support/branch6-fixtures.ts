import { coverageLosses, eq, inArray, reconciliationMarkPayments } from '@repo/db';
import { recordChargeFact } from '../../../../src/services/billing/payment/record-charge-fact.service.js';
import { cancelDirectSubscription } from '../../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { createSuccessionCloser } from '../../../../src/services/billing/subscription/succession-closer.service.js';
import { getServiceTestDb } from '../helpers.js';
import { closePorts } from './succession-close-fixtures.js';
import {
    paymentFor,
    predecessorInGrace,
    retireSuccessionCases,
    type SeededSuccession
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

/** The real S23/S24 act with a real S18 closer and fake provider. */
export async function cancelBranch6(s: Awaited<ReturnType<typeof predecessorInGrace>>) {
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
