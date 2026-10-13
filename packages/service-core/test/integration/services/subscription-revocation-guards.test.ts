// TEST:B5:11 (AC:B5:20, AC:B5:21): what S36 refuses, who may run it, two acts at once, and
// its confirmation. Every rejection leaves nothing written: no refund, no state change, no
// closed pause, no outbox row, no coverage loss, no provider call.
import { domainEventModel, eq, refunds, subscriptions, userRole } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    previewSubscriptionRevocation,
    revokeSubscription
} from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import type { Actor } from '../../../src/types/index.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import {
    CHARGE_DAY_0,
    DAY_MS,
    type RevocationFixture,
    retireRevocationRows,
    revocationFixture,
    seedCreditedPayment,
    seedRevocationActor,
    untouchedState
} from './support/revocation-fixtures.js';

afterEach(retireRevocationRows);
afterAll(closeServiceTestPool);

const live = !isServiceTestDbAvailable();

function revoke(f: RevocationFixture, actor: Actor, expectedPaymentId?: string) {
    return revokeSubscription(
        {
            actor,
            subscriptionId: f.subscriptionId,
            ...(expectedPaymentId ? { expectedPaymentId } : {})
        },
        f.ports
    );
}

/** The act rejects with `reason` and leaves every row and the provider as they were. */
async function expectRejectedUntouched(
    f: RevocationFixture,
    actor: Actor,
    reason: string,
    expectedPaymentId?: string
) {
    const before = await untouchedState(f);
    await expect(revoke(f, actor, expectedPaymentId)).rejects.toMatchObject({ reason });
    expect(await untouchedState(f)).toEqual(before);
    expect(f.sequence).toEqual([]);
    expect(f.coverageSeen).toEqual([]);
    const decided = (
        await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: f.subscriptionId
        })
    ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided');
    expect(decided).toEqual([]);
}

describe('TEST:B5:11 AC:B5:21 S36 guards: the 10-day window and the rejections', () => {
    it.skipIf(live)(
        'AC:B5:21 (h) a charge 12 days old: WINDOW_CLOSED, nothing changes',
        async () => {
            const f = await revocationFixture({ origin: 'PAUSED' });
            f.at(f.day(12));
            await expectRejectedUntouched(
                f,
                await seedRevocationActor(),
                'REVOCATION_WINDOW_CLOSED'
            );
        }
    );

    it.skipIf(live)(
        'AC:B5:21 (i) 23:59 AR of day D+10 revokes; 00:00 AR of D+11 does not',
        async () => {
            // Arrange: D = 2026-10-01 AR; D+10 ends at 2026-10-12T03:00Z
            const inside = await revocationFixture();
            inside.at(new Date('2026-10-12T02:59:00.000Z'));
            const outside = await revocationFixture();
            outside.at(new Date('2026-10-12T03:00:00.000Z'));

            // Act / Assert
            await expect(revoke(inside, await seedRevocationActor())).resolves.toMatchObject({
                refundAmount: 10000
            });
            await expectRejectedUntouched(
                outside,
                await seedRevocationActor(),
                'REVOCATION_WINDOW_CLOSED'
            );
        }
    );

    it.skipIf(live)('(j) without any credited payment: NO_CREDITED_PAYMENT', async () => {
        const f = await revocationFixture({ withPayment: false });
        f.at(f.day(5));
        await expectRejectedUntouched(
            f,
            await seedRevocationActor(),
            'REVOCATION_NO_CREDITED_PAYMENT'
        );
    });

    for (const status of ['REFUNDED', 'CHARGED_BACK'] as const) {
        it.skipIf(live)(
            `(k) the last credited payment is ${status}: PAYMENT_NOT_REFUNDABLE, the older SUCCEEDED one is not used`,
            async () => {
                // Arrange: an older refundable charge and a newer, already returned one
                const f = await revocationFixture({ chargedAt: CHARGE_DAY_0 });
                await seedCreditedPayment({
                    subscriptionId: f.subscriptionId,
                    factAt: new Date(CHARGE_DAY_0.getTime() + DAY_MS),
                    status
                });
                f.at(f.day(5));

                // Act / Assert
                await expectRejectedUntouched(
                    f,
                    await seedRevocationActor(),
                    'PAYMENT_NOT_REFUNDABLE'
                );
            }
        );
    }

    for (const open of ['REQUESTED', 'CONFIRMED'] as const) {
        it.skipIf(live)(
            `(k2) an ${open} refund already claims the total: REFUND_EXCEEDS_BALANCE, no second RF1`,
            async () => {
                // Arrange
                const f = await revocationFixture();
                await getServiceTestDb().insert(refunds).values({
                    paymentId: f.payment!.id,
                    amount: 10000,
                    reason: 'REVOCATION',
                    status: open
                });
                f.at(f.day(5));

                // Act / Assert
                await expectRejectedUntouched(
                    f,
                    await seedRevocationActor(),
                    'REFUND_EXCEEDS_BALANCE'
                );
            }
        );
    }

    it.skipIf(live)('(k3) an open partial refund: S36 asks only for what is left', async () => {
        // Arrange
        const f = await revocationFixture();
        await getServiceTestDb().insert(refunds).values({
            paymentId: f.payment!.id,
            amount: 4000,
            reason: 'REVOCATION',
            status: 'REQUESTED'
        });
        f.at(f.day(5));

        // Act
        const result = await revoke(f, await seedRevocationActor());

        // Assert
        expect(result.refundAmount).toBe(6000);
        const rows = await getServiceTestDb()
            .select({ amount: refunds.amount })
            .from(refunds)
            .where(eq(refunds.paymentId, f.payment!.id));
        expect(rows.map(({ amount }) => amount).sort()).toEqual([4000, 6000]);
    });

    it.skipIf(live)(
        '(l) SUSPENDED is not an origin; a CANCELLED row is not revoked twice',
        async () => {
            // Arrange
            const suspended = await revocationFixture();
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, suspended.subscriptionId));
            suspended.at(suspended.day(5));
            const twice = await revocationFixture();
            twice.at(twice.day(5));
            const actor = await seedRevocationActor();
            await revoke(twice, actor);
            twice.sequence.length = 0;
            twice.coverageSeen.length = 0;

            // Act / Assert
            await expectRejectedUntouched(suspended, actor, 'REVOCATION_STATE_NOT_ALLOWED');
            await expect(revoke(twice, actor)).rejects.toMatchObject({
                reason: 'REVOCATION_STATE_NOT_ALLOWED'
            });
            const rows = await getServiceTestDb()
                .select()
                .from(refunds)
                .where(eq(refunds.paymentId, twice.payment!.id));
            expect(rows).toHaveLength(1);
        }
    );

    it.skipIf(live)('(m) a COMPLEMENTO row: REVOCATION_NOT_PRINCIPAL', async () => {
        const f = await revocationFixture();
        await getServiceTestDb()
            .update(subscriptions)
            .set({ class: 'COMPLEMENTO' })
            .where(eq(subscriptions.id, f.subscriptionId));
        f.at(f.day(5));
        await expectRejectedUntouched(f, await seedRevocationActor(), 'REVOCATION_NOT_PRINCIPAL');
    });

    it.skipIf(live)(
        '(n) the preview showed another payment: REVOCATION_PAYMENT_CHANGED',
        async () => {
            const f = await revocationFixture();
            f.at(f.day(5));
            await expectRejectedUntouched(
                f,
                await seedRevocationActor(),
                'REVOCATION_PAYMENT_CHANGED',
                crypto.randomUUID()
            );
        }
    );
});

describe('TEST:B5:11 AC:B5:20 S36 authorizes action 8 inside the transaction', () => {
    it.skipIf(live)(
        '(o) billing neighbours without the action 8 permission: FORBIDDEN',
        async () => {
            const f = await revocationFixture();
            f.at(f.day(5));
            const actor = await seedRevocationActor([
                PermissionEnum.BILLING_SETTLE_EXTERNAL,
                PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                PermissionEnum.BILLING_SETTINGS_WRITE,
                PermissionEnum.PAYMENT_REFUND,
                PermissionEnum.REFUND_PROCESS
            ]);
            await expectRejectedUntouched(f, actor, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
        }
    );

    it.skipIf(live)(
        '(p) the owner of the subscription, even with the permission: FORBIDDEN',
        async () => {
            const f = await revocationFixture();
            f.at(f.day(5));
            const actor: Actor = {
                id: f.userId,
                roles: [RoleEnum.SUPER_ADMIN],
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            };
            await expectRejectedUntouched(f, actor, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
        }
    );

    it.skipIf(live)('(q) a system actor carrying the permission: FORBIDDEN', async () => {
        const f = await revocationFixture();
        f.at(f.day(5));
        const admin = await seedRevocationActor();
        // createSystemActor refuses an administrative permission (SystemActorDefinitionError),
        // so a marked actor holding BILLING_CANCEL_SUBSCRIPTION can only be hand-built here:
        // it proves step 3 rejects the marker, not just the missing permission.
        const actor: Actor = {
            id: admin.id,
            roles: [RoleEnum.SYSTEM],
            permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
            _isSystemActor: true
        };
        await expectRejectedUntouched(f, actor, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
    });

    it.skipIf(live)(
        '(r) an ADMIN without the permission over a SUPER_ADMIN subject: FORBIDDEN',
        async () => {
            const f = await revocationFixture();
            await getServiceTestDb()
                .insert(userRole)
                .values({ userId: f.userId, role: RoleEnum.SUPER_ADMIN });
            f.at(f.day(5));
            const actor = await seedRevocationActor(
                [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
                [RoleEnum.ADMIN]
            );
            await expectRejectedUntouched(f, actor, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
        }
    );
});

/**
 * Holds the payment row from another connection until both acts are parked (one behind it,
 * the other behind the first one's subscription lock), so their reads overlap.
 */
async function withBarrierOnPayment<T>(paymentId: string, run: () => Promise<T>): Promise<T> {
    const barrier = await getServiceTestPool().connect();
    try {
        await barrier.query('BEGIN');
        await barrier.query('SELECT id FROM payment WHERE id = $1 FOR UPDATE', [paymentId]);
        const pid = (await barrier.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]
            ?.pid;
        const running = run();
        for (let poll = 0; poll < 100; poll++) {
            const parked = await getServiceTestPool().query<{ parked: number }>(
                `WITH direct AS (
                     SELECT pid FROM pg_stat_activity WHERE $1 = ANY (pg_blocking_pids(pid))
                 )
                 SELECT count(*)::int AS parked FROM pg_stat_activity
                 WHERE pid IN (SELECT pid FROM direct)
                    OR pg_blocking_pids(pid) && ARRAY(SELECT pid FROM direct)`,
                [pid]
            );
            if ((parked.rows[0]?.parked ?? 0) >= 2) break;
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await barrier.query('COMMIT');
        return await running;
    } finally {
        barrier.release();
    }
}

describe('TEST:B5:11 AC:B5:20 two revocations of the same row at once', () => {
    it.skipIf(live)('(s) exactly one wins and exactly one RF1 exists', async () => {
        // Arrange
        const f = await revocationFixture();
        f.at(f.day(5));
        const actor = await seedRevocationActor();

        // Act
        const outcomes = await withBarrierOnPayment(f.payment!.id, () =>
            Promise.allSettled([revoke(f, actor), revoke(f, actor)])
        );

        // Assert
        const rejected = outcomes.filter(
            (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
        );
        expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(['REVOCATION_STATE_NOT_ALLOWED', 'REVOCATION_STATE_CHANGED']).toContain(
            (rejected[0]?.reason as { reason?: string }).reason
        );
        const rows = await getServiceTestDb()
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, f.payment!.id));
        expect(rows).toHaveLength(1);
    });
});

describe('TEST:B5:11 AC:B5:20 (t) the confirmation says the three things and writes nothing', () => {
    it.skipIf(live)(
        'returns the payment, the amount, the window end and the three effects',
        async () => {
            // Arrange
            const f = await revocationFixture();
            f.at(f.day(5));
            const before = await untouchedState(f);

            // Act
            const preview = await previewSubscriptionRevocation(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                { clock: f.fixture.clock }
            );

            // Assert
            expect(preview).toEqual({
                subscriptionId: f.subscriptionId,
                origin: 'ACTIVE',
                payment: {
                    source: 'PAYMENT',
                    id: f.payment!.id,
                    amount: 10000,
                    currency: 'ARS',
                    chargedAt: CHARGE_DAY_0,
                    ownerSubscriptionId: f.subscriptionId
                },
                windowEndsAt: new Date('2026-10-12T03:00:00.000Z'),
                effects: { cancelsAuthorization: true, endsServiceAt: 'NOW', requestsRefund: true }
            });
            expect(await untouchedState(f)).toEqual(before);
            expect(f.sequence).toEqual([]);
        }
    );

    it.skipIf(live)('rejects like the act: (h) window, (o) permission, (p) subject', async () => {
        const f = await revocationFixture();
        f.at(f.day(12));
        const preview = (actor: Actor) =>
            previewSubscriptionRevocation(
                { actor, subscriptionId: f.subscriptionId },
                { clock: f.fixture.clock }
            );
        await expect(preview(await seedRevocationActor())).rejects.toMatchObject({
            reason: 'REVOCATION_WINDOW_CLOSED'
        });
        await expect(
            preview(await seedRevocationActor([PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]))
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        await expect(
            preview({
                id: f.userId,
                roles: [RoleEnum.SUPER_ADMIN],
                permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
    });
});
