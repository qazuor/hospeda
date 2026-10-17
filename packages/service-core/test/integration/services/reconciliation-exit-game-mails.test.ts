import {
    and,
    billingDeadlineVersions,
    type DrizzleClient,
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    payments,
    reconciliationMarkModel,
    reconciliationSummaryWindows,
    refunds,
    sql,
    userRole,
    users
} from '@repo/db';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { enqueueRevocationRefundFailedNotice } from '../../../src/services/billing/reconciliation/revocation-refund-failed-notice.js';
import { runReconciliationSummaryTick } from '../../../src/services/billing/reconciliation/summary/run-summary-tick.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    withServiceTestTransaction
} from './helpers.js';
import {
    exitGameClock,
    exitGameFake,
    retireExitGameRows,
    runExitGameSweep,
    trackExitGameRow
} from './reconciliation-exit-game-fixtures.js';
import { seedSubscription } from './reconciliation-sweep-fixtures.js';
import { seedCoveragePayment, seedCoverageUser } from './support/coverage-fixtures.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';
import { publishDeadline, seedClosedWindowBefore } from './support/summary-window-fixtures.js';

afterEach(retireExitGameRows);
afterAll(closeServiceTestPool);

interface DbError {
    readonly constraint?: string;
}
async function rejected(client: PoolClient, text: string, values: unknown[]) {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(text, values);
        return null;
    } catch (error) {
        return error as DbError;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}
async function seedRecipients(tx: DrizzleClient) {
    const chosen = [await seedCoverageUser(tx), await seedCoverageUser(tx)];
    const unrelated = await seedCoverageUser(tx);
    await tx
        .insert(userRole)
        .values(
            [...chosen, unrelated].map(({ userId }) => ({ userId, role: 'SUPER_ADMIN' as const }))
        );
    const recipients = await Promise.all(
        chosen.map(async ({ userId }) => {
            const [user] = await tx
                .select({ email: users.email })
                .from(users)
                .where(eq(users.id, userId));
            if (!user) throw new Error('test recipient missing');
            return { userId, email: user.email };
        })
    );
    return { recipients, unrelatedId: unrelated.userId };
}
async function seedRefund(tx: DrizzleClient) {
    const subject = await seedRenewalSubscription(tx, { nextChargeAt: null });
    await seedCoveragePayment(tx, { subscriptionId: subject.subscriptionId, status: 'SUCCEEDED' });
    const [payment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.subscriptionId, subject.subscriptionId));
    if (!payment) throw new Error('test payment missing');
    const [refund] = await tx
        .insert(refunds)
        .values({
            paymentId: payment.id,
            amount: 250000,
            reason: 'REVOCATION',
            status: 'REQUESTED'
        })
        .returning({ id: refunds.id });
    if (!refund) throw new Error('test refund missing');
    return refund.id;
}
async function simulateRf5(
    tx: DrizzleClient,
    refundId: string,
    recipients: readonly { userId: string; email: string }[]
) {
    await tx.update(refunds).set({ status: 'FAILED' }).where(eq(refunds.id, refundId));
    return enqueueRevocationRefundFailedNotice(
        {
            tx,
            refundId,
            failedAt: new Date('2026-10-01T00:00:00.000Z'),
            correlationId: crypto.randomUUID()
        },
        { recipients: { list: async () => recipients } }
    );
}
const deadlinePort = (version: number, values: unknown) => ({
    getCurrent: async () => ({ version, values })
});

describe('TEST:B11:20 el juego de salida contra el falso — correos, resumen, base y B4', () => {
    it('LISTA:B11 cláusula 6: la base rechaza principales y complementos sin identidad', async () => {
        const client = await getServiceTestPool().connect();
        try {
            await client.query('BEGIN');
            const token = crypto.randomUUID();
            const user = await client.query<{ id: string }>(
                'INSERT INTO users (slug,email) VALUES ($1,$2) RETURNING id',
                [`exit-${token}`, `exit-${token}@example.test`]
            );
            const plan = await client.query<{ id: string }>(
                "INSERT INTO plan (vertical,slug,name) VALUES ('accommodation',$1,'Exit test') RETURNING id",
                [`exit-${token}`]
            );
            const version = await client.query<{ id: string }>(
                "INSERT INTO plan_version (plan_id,vertical,rank,sellable,current,trial_days,allows_pause) VALUES ($1,'accommodation',1,true,true,0,true) RETURNING id",
                [plan.rows[0]?.id]
            );
            const option = await client.query<{ id: string }>(
                "INSERT INTO billing_option (plan_version_id,cycle,amount,currency) VALUES ($1,'monthly',1000,'ARS') RETURNING id",
                [version.rows[0]?.id]
            );
            const uid = user.rows[0]!.id,
                vid = version.rows[0]!.id,
                oid = option.rows[0]!.id;
            const insert =
                "INSERT INTO subscription (user_id, vertical, payment_method, plan_version_id, billing_option_id, status, class) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6)";
            expect(
                (
                    await rejected(client, insert, [
                        null,
                        'accommodation',
                        'CARD',
                        vid,
                        oid,
                        'PRINCIPAL'
                    ])
                )?.constraint
            ).toBe('ck_subscription_identity_not_null');
            expect(
                (
                    await rejected(client, insert, [
                        uid,
                        'accommodation',
                        'CARD',
                        vid,
                        null,
                        'PRINCIPAL'
                    ])
                )?.constraint
            ).toBe('ck_subscription_principal_anchor');
            expect(
                (
                    await rejected(client, insert, [
                        null,
                        'accommodation',
                        'CARD',
                        vid,
                        oid,
                        'COMPLEMENTO'
                    ])
                )?.constraint
            ).toBe('ck_subscription_identity_not_null');
            await client.query(insert, [uid, 'accommodation', 'CARD', vid, oid, 'PRINCIPAL']);
            const tombstone = await client.query<{ class: string }>(
                "INSERT INTO subscription (status,class) VALUES ('CANCELLED','LAPIDA') RETURNING class"
            );
            expect(tombstone.rows[0]?.class).toBe('LAPIDA');
            const columns = await client.query<{ column_name: string }>(
                "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='subscription' AND column_name = ANY($1)",
                [['origen_de_lapida', 'origen_de_lápida']]
            );
            expect(columns.rows).toEqual([]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });

    it('LISTA:B11 cláusula 19: el refund fallido y COBRO_DUPLICADO mandan sus inmediatos', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { recipients, unrelatedId } = await seedRecipients(tx);
            const recipientIds = recipients.map(({ userId }) => userId);
            const beforeWindows = await tx
                .select({ id: reconciliationSummaryWindows.id })
                .from(reconciliationSummaryWindows);
            const refundId = await seedRefund(tx);
            await simulateRf5(tx, refundId, recipients);
            const refundRows = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, 'billing.revocation-refund-failed'),
                        sql`${emailOutbox.payload}->>'refundId' = ${refundId}`,
                        inArray(emailOutbox.recipientUserId, recipientIds)
                    )
                );
            expect(refundRows).toHaveLength(2);
            expect(
                refundRows.every(
                    (row) => row.sendAfter === null && row.payload.refundId === refundId
                )
            ).toBe(true);
            expect(refundRows.map((row) => row.recipientUserId).sort()).toEqual(
                [...recipientIds].sort()
            );
            expect(refundRows.some((row) => row.recipientUserId === unrelatedId)).toBe(false);
            const subject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            const opened = await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                    reason: 'COBRO_DUPLICADO',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID(),
                    tx
                },
                { notice: { recipients: { list: async () => recipients } } }
            );
            const markRows = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, 'billing.duplicate-charge-detected'),
                        sql`${emailOutbox.payload}->>'markId' = ${opened.mark.id}`,
                        inArray(emailOutbox.recipientUserId, recipientIds)
                    )
                );
            expect(markRows).toHaveLength(2);
            expect(
                markRows.every(
                    (row) => row.sendAfter === null && row.payload.markId === opened.mark.id
                )
            ).toBe(true);
            expect(markRows.map((row) => row.recipientUserId).sort()).toEqual(
                [...recipientIds].sort()
            );
            expect(
                await tx
                    .select()
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.template, 'billing.reconciliation-summary'),
                            inArray(emailOutbox.recipientUserId, recipientIds)
                        )
                    )
            ).toHaveLength(0);
            expect(
                await tx
                    .select({ id: reconciliationSummaryWindows.id })
                    .from(reconciliationSummaryWindows)
            ).toHaveLength(beforeWindows.length);
        });
    });

    it('LISTA:B11 cláusula 20: cien eventos se resumen una vez al plazo vigente', async () => {
        await withServiceTestTransaction(async (tx) => {
            const result = await tx.execute(sql`select now() as now`);
            const txNow = new Date((result.rows[0] as { now: Date }).now);
            const [current] = await tx
                .select()
                .from(billingDeadlineVersions)
                .orderBy(sql`${billingDeadlineVersions.version} DESC`)
                .limit(1);
            if (!current) throw new Error('Current deadline version missing');
            await seedClosedWindowBefore(tx, txNow, 1_000);
            const { recipients } = await seedRecipients(tx);
            const subject = await seedRenewalSubscription(tx, { nextChargeAt: null });
            const correlationId = crypto.randomUUID();
            await publishDeadline(tx, current.version + 1, 13, current.values);
            for (let i = 0; i < 100; i++)
                await openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                    reason: 'DIVERGENCIA_DE_MONTO',
                    actor: { type: 'job' },
                    correlationId,
                    tx
                });
            const events = await domainEventModel.findByCorrelationId({ correlationId, tx });
            expect(events.filter((e) => e.eventType === 'reconciliation.mark_opened')).toHaveLength(
                100
            );
            expect(
                await reconciliationMarkModel.listOpen({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
                    tx
                })
            ).toHaveLength(1);
            const now = new Date(txNow.getTime() + 1_000);
            const run = (at: Date) =>
                runReconciliationSummaryTick(
                    { now: at, correlationId },
                    {
                        tx,
                        recipients: { list: async () => recipients },
                        deadlines: deadlinePort(current.version + 1, {
                            ...current.values,
                            '19': { minutes: 13 }
                        })
                    }
                );
            expect(await run(now)).toBe('WINDOW_OPENED');
            const [window] = await tx
                .select()
                .from(reconciliationSummaryWindows)
                .where(eq(reconciliationSummaryWindows.windowMinutes, 13));
            if (!window) throw new Error('summary window missing');
            expect(window).toMatchObject({
                windowMinutes: 13,
                deadlinesVersion: current.version + 1
            });
            expect(window.closesAt.getTime() - window.openedAt.getTime()).toBe(13 * 60_000);
            expect(await run(new Date(window.closesAt.getTime() - 1))).toBe('WAITING');
            expect(
                await tx
                    .select()
                    .from(emailOutbox)
                    .where(
                        and(
                            eq(emailOutbox.template, 'billing.reconciliation-summary'),
                            inArray(
                                emailOutbox.recipientUserId,
                                recipients.map((r) => r.userId)
                            )
                        )
                    )
            ).toHaveLength(0);
            expect(await run(window.closesAt)).toBe('SENT');
            const mails = await tx
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.template, 'billing.reconciliation-summary'),
                        inArray(
                            emailOutbox.recipientUserId,
                            recipients.map((r) => r.userId)
                        )
                    )
                );
            expect(mails).toHaveLength(2);
            for (const mail of mails) {
                const marks = mail.payload.marks;
                expect(Array.isArray(marks)).toBe(true);
                if (!Array.isArray(marks)) throw new Error('summary marks missing');
                expect(
                    marks.find(
                        (mark) =>
                            typeof mark === 'object' &&
                            mark !== null &&
                            'subjectId' in mark &&
                            mark.subjectId === subject.subscriptionId
                    )
                ).toMatchObject({ count: 100 });
            }
        });
    });

    it('LISTA:B11 cláusula 21: la relectura cancela y conserva el instante previo', async () => {
        const { clock } = exitGameClock();
        const fake = exitGameFake({ clock });
        const empty = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const prior = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        if (
            !empty.subscription.userId ||
            !empty.providerId ||
            !prior.subscription.userId ||
            !prior.providerId
        )
            throw new Error('linked rows incomplete');
        trackExitGameRow(empty.subscription.id, empty.subscription.userId);
        trackExitGameRow(prior.subscription.id, prior.subscription.userId);
        const t0 = new Date('2026-10-01T00:00:00.000Z');
        await getServiceTestDb()
            .update((await import('@repo/db')).providerLinks)
            .set({ cancelledSeenAt: t0 })
            .where(
                eq((await import('@repo/db')).providerLinks.subscriptionId, prior.subscription.id)
            );
        await fake.cancel({ authorizationId: empty.providerId });
        await fake.cancel({ authorizationId: prior.providerId });
        await runExitGameSweep({ provider: fake, clock });
        const links = (await import('@repo/db')).providerLinks;
        const [a] = await getServiceTestDb()
            .select({ at: links.cancelledSeenAt })
            .from(links)
            .where(eq(links.subscriptionId, empty.subscription.id));
        const [b] = await getServiceTestDb()
            .select({ at: links.cancelledSeenAt })
            .from(links)
            .where(eq(links.subscriptionId, prior.subscription.id));
        expect(a?.at).toEqual(clock.now());
        expect(b?.at).toEqual(t0);
        expect(providerLinkCancellationSeen).toBeDefined();
    });
});
