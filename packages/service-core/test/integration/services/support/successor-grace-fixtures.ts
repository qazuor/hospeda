import { emailOutbox, eq, inArray, subscriptions } from '@repo/db';
import { vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger.js';
import { activateSubscription } from '../../../../src/services/billing/subscription/activate-subscription.service.js';
import type { BeforeCancelNotice } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';
import { graceFixture } from './grace-fixtures.js';
import { paymentFixture } from './payment-fixtures.js';
import { noTouristVip } from './tourist-vip.js';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };

/** The status the succession was declared from (only the successor's first charge records it). */
export type SuccessionBase = 'ACTIVE' | 'CANCEL_SCHEDULED' | 'SUSPENDED';

/** Rows seeded by the fixture, retired by {@link retireSuccessorGraceRows}. */
export interface SeededSuccessorCase {
    readonly subscriptionIds: readonly string[];
    readonly userId: string;
}

/**
 * Seeds, on ONE fake provider, a card predecessor and an ACTIVE card successor
 * with an authorized provider link and no payment of its own (AC:B7:4, TEST:B7:2).
 *
 * The predecessor is left `CANCELLED` (as S17 leaves it), so S5 on the successor does not fail condition 3. The successor's first charge
 * is the window + 24 h when declared from `ACTIVE`/`CANCEL_SCHEDULED`, and its
 * birth instant when declared from `SUSPENDED` (AC:B3:24).
 */
export async function successorGraceFixture({
    graceDays = 7,
    declaredFrom = 'ACTIVE',
    predecessorPaid = true,
    predecessorPaymentMethod = 'CARD',
    successorPaymentMethod = 'CARD',
    succession = 'IN_PROGRESS'
}: {
    readonly graceDays?: number;
    readonly declaredFrom?: SuccessionBase;
    readonly predecessorPaid?: boolean;
    readonly predecessorPaymentMethod?: 'CARD' | 'MANUAL';
    readonly successorPaymentMethod?: 'CARD' | 'MANUAL';
    /** `IN_PROGRESS`: both traces; `CLOSED`: only the predecessor's `sucedida_por` (INV:D15). */
    readonly succession?: 'IN_PROGRESS' | 'CLOSED';
} = {}) {
    const base = predecessorPaid
        ? await graceFixture({ graceDays })
        : await paymentFixture().then((fixture) => {
              fixture.clock.advance({ ms: 31 * DAY_MS });
              return fixture;
          });
    const { provider, clock, user, coverageNotices } = base;
    const predecessorId = base.started.subscriptionId;
    const planPolicy = vi.fn(async () => ({
        graceDays,
        allowsPause: false,
        current: true,
        sellable: true
    }));

    const [predecessorRow] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, predecessorId));
    if (!predecessorRow?.billingOptionId) throw new Error('Predecessor fixture row missing');
    // The base the succession was declared from, then S17's cancellation.
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: declaredFrom })
        .where(eq(subscriptions.id, predecessorId));
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: 'CANCELLED', paymentMethod: predecessorPaymentMethod })
        .where(eq(subscriptions.id, predecessorId));

    const bornAt = clock.now();
    const started = await startSubscription(
        {
            userId: user.id,
            billingOptionId: predecessorRow.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        {
            provider,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy
        }
    );
    await provider.approve({ authorizationId: started.authorizationId });
    await activateSubscription(started.subscriptionId, {
        provider,
        clock,
        beforeCancelNotice,
        touristVipInheritance: noTouristVip
    });
    const [successorRow] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (successorRow?.status !== 'ACTIVE') throw new Error('Successor fixture is not ACTIVE');
    const authorizationWindowEndsAt =
        successorRow.authorizationWindowEndsAt ?? new Date(bornAt.getTime() + 72 * HOUR_MS);
    const firstChargeAt =
        declaredFrom === 'SUSPENDED'
            ? bornAt
            : new Date(authorizationWindowEndsAt.getTime() + 24 * HOUR_MS);

    await getServiceTestDb()
        .update(subscriptions)
        .set({
            firstChargeAt,
            authorizationWindowEndsAt,
            paymentMethod: successorPaymentMethod,
            succeedsId: succession === 'IN_PROGRESS' ? predecessorId : null
        })
        .where(eq(subscriptions.id, started.subscriptionId));
    // `sucedida_por` is written at declaration and survives the succession's close (INV:D15).
    await getServiceTestDb()
        .update(subscriptions)
        .set({ succeededById: started.subscriptionId })
        .where(eq(subscriptions.id, predecessorId));
    return {
        provider,
        clock,
        user,
        coverageNotices,
        planPolicy,
        predecessorId,
        successorId: started.subscriptionId,
        successorAuthorizationId: started.authorizationId,
        bornAt,
        firstChargeAt,
        authorizationWindowEndsAt,
        ports: {
            provider,
            clock,
            beforeCancelNotice,
            payments: creditedPaymentsFromLedger,
            planPolicy,
            coverageNotices
        }
    };
}

/** Retires the seeded rows: CANCELLED with an empty clock, and the users' outbox rows deleted. */
export async function retireSuccessorGraceRows(cases: readonly SeededSuccessorCase[]) {
    if (cases.length === 0) return;
    const db = getServiceTestDb();
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
        .where(
            inArray(
                subscriptions.id,
                cases.flatMap(({ subscriptionIds }) => subscriptionIds)
            )
        );
    await db.delete(emailOutbox).where(
        inArray(
            emailOutbox.recipientUserId,
            cases.map(({ userId }) => userId)
        )
    );
}
