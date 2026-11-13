import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { type CreatedUser, createUser } from '../../fixtures/api-helpers.ts';
import {
    createSubscriber,
    ensureDeadlineVersion,
    type FakeWorld,
    runCron,
    startFakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import * as m from './helpers/manual-installment-admin.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const MAIL_TIMEOUT_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Exercises the live admin billing routes against the E2E database and local fake services. */
test.describe('TEST:HOS-2160 admin manual installments: previews, unpaid, reimputation, unallocated and reruns @p0 @billing @clock', () => {
    let world: FakeWorld | null = null;
    let subscriber: Awaited<ReturnType<typeof createSubscriber>> | null = null;
    let admin2: CreatedUser | null = null;
    let goneAdmin: CreatedUser | null = null;
    const userIds: string[] = [];
    const partnerIds: string[] = [];

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        world = await startFakeWorld();
        subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        admin2 = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIds.push(admin2.id);
        goneAdmin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        userIds.push(goneAdmin.id);
        await execSQL('UPDATE users SET deleted_at = now() WHERE id = $1', [goneAdmin.id]);
        await monthlyOptionForSlug('partner-silver');
    });

    test.afterAll(async () => {
        try {
            await m.cleanupManualAdminRows({ userIds, partnerIds });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            await world?.fakeServer.close().catch(() => undefined);
        }
    });

    test('action 6 to MP2: SUPER_ADMIN notices, S29 preview, on-time opening, reruns and unpaid', async () => {
        test.setTimeout(240_000);
        if (!world || !subscriber || !admin2 || !goneAdmin)
            throw new Error('Expected the manual installment admin test world.');
        const actors = subscriber;
        const secondAdmin = admin2;
        const deletedAdmin = goneAdmin;
        const { fakeServer, mailCapture } = world;
        const optionId = await monthlyOptionForSlug('partner-silver');
        const nonce = randomUUID();
        let subscriptionId = '';
        let firstId = '';
        let secondId = '';
        let periodStart1 = new Date(0);
        let nextCharge1 = new Date(0);

        await test.step('P7 and P1 (AC:B5:13, AC:B5:15): action 6 notifies every SUPER_ADMIN and the S29 preview writes nothing', async () => {
            const inserted = await execSQL<{ id: string }>(
                `INSERT INTO partners (slug, name, type, owner_user_id, presence_moderated)
                         VALUES ($1, 'HOS-2160 manual installments', 'business', $2, false)
                         RETURNING id`,
                [`hos2160-${nonce}`, actors.user.id]
            );
            const partnerId = inserted[0]?.id;
            if (!partnerId) throw new Error('Expected the test Partner row.');
            partnerIds.push(partnerId);

            const setup = await m.createManualPartnerSetup({
                partnerId,
                optionId,
                cookie: actors.admin.sessionCookie,
                nonce
            });
            subscriptionId = setup.subscriptionId;
            firstId = setup.manualPaymentId;
            const initial = await execSQL<{ period_start: Date }>(
                'SELECT period_start FROM manual_payment WHERE id = $1',
                [firstId]
            );
            expect(initial).toHaveLength(1);
            periodStart1 = initial[0]?.period_start ?? new Date(0);

            const expected = await m.superAdminRecipients();
            const expectedIds = expected.map(({ userId }) => userId);
            expect(expectedIds).toContain(actors.admin.id);
            expect(expectedIds).toContain(secondAdmin.id);
            expect(expectedIds).not.toContain(deletedAdmin.id);
            let notices = await m.unpaidNoticeRows({ manualPaymentId: firstId });
            expect(notices.map(({ recipient_user_id }) => recipient_user_id)).toEqual(expectedIds);
            for (const notice of notices) {
                expect(notice.payload).toEqual({
                    manualPaymentId: firstId,
                    subscriptionId,
                    vertical: 'partner',
                    periodStart: periodStart1.toISOString(),
                    openedAt: periodStart1.toISOString(),
                    firstInstallment: true
                });
            }
            for (
                let attempt = 0;
                attempt < 3 && notices.some(({ status }) => status !== 'sent');
                attempt++
            ) {
                await runCron({
                    jobName: 'email-outbox-sender',
                    adminCookie: actors.admin.sessionCookie
                });
                notices = await m.unpaidNoticeRows({ manualPaymentId: firstId });
            }
            expect(notices.map(({ status }) => status)).toEqual(notices.map(() => 'sent'));
            for (const recipient of expected) {
                const mail = mailCapture
                    .mailsTo({ to: recipient.email })
                    .filter(
                        (message) =>
                            message.subject === 'Cuota de pago manual sin pago' &&
                            m.mailText(message.html).includes(firstId)
                    );
                expect(mail).toHaveLength(1);
                expect(m.mailText(mail[0]?.html ?? '')).toContain(subscriptionId);
                expect(m.mailText(mail[0]?.html ?? '')).toContain(
                    'Registrá el pago o declarala impaga desde el panel de administración.'
                );
            }

            const beforePreview = await m.snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            const registerPath = `/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${firstId}/register`;
            const registerPreviewResponse = await m.adminJson({
                method: 'GET',
                path: registerPath,
                cookie: actors.admin.sessionCookie
            });
            const registerPreview = m.ManualPaymentDataSchema.parse(registerPreviewResponse.body);
            expect(registerPreviewResponse.status).toBe(200);
            nextCharge1 = m.addUtcMonths({ date: periodStart1, months: 1 });
            expect(registerPreview.data).toEqual({
                subscriptionId,
                manualPaymentId: firstId,
                periodStart: periodStart1.toISOString(),
                effect: 'S29',
                nextChargeAt: nextCharge1.toISOString()
            });
            const afterPreview = await m.snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            expect(afterPreview).toEqual(beforePreview);

            const registerBody = { proofRef: `hos2160-${nonce}` };
            const registerResultResponse = await m.adminJson({
                method: 'POST',
                path: registerPath,
                cookie: actors.admin.sessionCookie,
                body: registerBody
            });
            const registerResult = m.ManualPaymentDataSchema.parse(registerResultResponse.body);
            expect(registerResultResponse.status).toBe(200);
            expect(registerResult.data.outcome).toBe('REGISTERED');
            expect(registerResult.data.effect).toBe('S29');
            expect(registerResult.data.nextChargeAt).toBe(nextCharge1.toISOString());
            const persisted = await execSQL<{ status: string; next_charge_at: Date }>(
                'SELECT status, next_charge_at FROM subscription WHERE id = $1',
                [subscriptionId]
            );
            expect(persisted[0]?.status).toBe('ACTIVE');
            expect(persisted[0]?.next_charge_at.toISOString()).toBe(nextCharge1.toISOString());

            const repeated = await m.adminJson({
                method: 'POST',
                path: registerPath,
                cookie: actors.admin.sessionCookie,
                body: registerBody
            });
            const repeatedError = m.RejectionSchema.parse(repeated.body);
            expect(repeated.status).toBe(409);
            expect(repeatedError.error.reason).toBe('MANUAL_PAYMENT_NOT_AWAITING');
            const receiptRows = await execSQL<{ count: number }>(
                'SELECT count(*)::int AS count FROM receipt WHERE manual_payment_id = $1',
                [firstId]
            );
            expect(receiptRows[0]?.count).toBe(1);
        });

        await test.step('P3, P6 and P7 (AC:B5:13): the second installment opens at next_charge_at, not before, and a rerun adds nothing', async () => {
            await fakeServer.setClock({
                at: new Date(nextCharge1.getTime() - 60_000)
            });
            await runCron({
                jobName: 'manual-installment-open',
                adminCookie: actors.admin.sessionCookie
            });
            const beforeDue = await execSQL<{
                status: string;
                count: number;
            }>(
                `SELECT s.status,
                                (SELECT count(*)::int FROM manual_payment mp
                                  WHERE mp.subscription_id = s.id AND mp.period_start = $2) AS count
                           FROM subscription s WHERE s.id = $1`,
                [subscriptionId, nextCharge1]
            );
            expect(beforeDue[0]?.status).toBe('ACTIVE');
            expect(beforeDue[0]?.count).toBe(0);

            await fakeServer.setClock({ at: nextCharge1 });
            const expected = await m.superAdminRecipients();
            const expectedIds = expected.map(({ userId }) => userId);
            await runCron({
                jobName: 'manual-installment-open',
                adminCookie: actors.admin.sessionCookie
            });
            const opened = await execSQL<{
                id: string;
                status: string;
                subscription_status: string;
                grace_started_at: Date | null;
            }>(
                `SELECT mp.id, mp.status, s.status AS subscription_status, s.grace_started_at
                           FROM manual_payment mp JOIN subscription s ON s.id = mp.subscription_id
                          WHERE mp.subscription_id = $1 AND mp.period_start = $2`,
                [subscriptionId, nextCharge1]
            );
            expect(opened).toHaveLength(1);
            secondId = opened[0]?.id ?? '';
            expect(secondId).not.toBe('');
            expect(opened[0]?.status).toBe('AWAITING');
            expect(opened[0]?.subscription_status).toBe('GRACE_PERIOD');
            expect(opened[0]?.grace_started_at?.toISOString()).toBe(nextCharge1.toISOString());
            let notices = await m.unpaidNoticeRows({ manualPaymentId: secondId });
            expect(notices.map(({ recipient_user_id }) => recipient_user_id)).toEqual(expectedIds);
            for (const notice of notices) {
                expect(notice.payload).toEqual({
                    manualPaymentId: secondId,
                    subscriptionId,
                    vertical: 'partner',
                    periodStart: nextCharge1.toISOString(),
                    openedAt: nextCharge1.toISOString(),
                    firstInstallment: false
                });
            }

            await runCron({
                jobName: 'manual-installment-open',
                adminCookie: actors.admin.sessionCookie
            });
            const afterRerun = await execSQL<{ count: number }>(
                `SELECT count(*)::int AS count FROM manual_payment
                          WHERE subscription_id = $1 AND period_start = $2`,
                [subscriptionId, nextCharge1]
            );
            const allInstallments = await execSQL<{ count: number }>(
                'SELECT count(*)::int AS count FROM manual_payment WHERE subscription_id = $1',
                [subscriptionId]
            );
            notices = await m.unpaidNoticeRows({ manualPaymentId: secondId });
            expect(afterRerun[0]?.count).toBe(1);
            expect(allInstallments[0]?.count).toBe(2);
            expect(notices).toHaveLength(expectedIds.length);
            expect(notices.map(({ recipient_user_id }) => recipient_user_id)).toEqual(expectedIds);
        });

        await test.step('P1, P2 and P6 (AC:B5:16): the MP2 preview writes nothing; declaring unpaid suspends and mails the payer once', async () => {
            const beforePreview = await m.snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            const unpaidPath = `/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${secondId}/declare-unpaid`;
            const unpaidPreviewResponse = await m.adminJson({
                method: 'GET',
                path: unpaidPath,
                cookie: actors.admin.sessionCookie
            });
            const unpaidPreview = m.ManualPaymentDataSchema.parse(unpaidPreviewResponse.body);
            expect(unpaidPreviewResponse.status).toBe(200);
            expect(unpaidPreview.data).toEqual({
                subscriptionId,
                manualPaymentId: secondId,
                periodStart: nextCharge1.toISOString(),
                effect: 'S6'
            });
            const afterPreview = await m.snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            expect(afterPreview).toEqual(beforePreview);

            const declaration = await m.adminJson({
                method: 'POST',
                path: unpaidPath,
                cookie: actors.admin.sessionCookie
            });
            const result = m.ManualPaymentDataSchema.parse(declaration.body);
            expect(declaration.status).toBe(200);
            expect(result.data).toEqual({ outcome: 'SUSPENDED', notice: 'SENT' });
            const persisted = await execSQL<{
                installment_status: string;
                subscription_status: string;
            }>(
                `SELECT mp.status AS installment_status, s.status AS subscription_status
                           FROM manual_payment mp JOIN subscription s ON s.id = mp.subscription_id
                          WHERE mp.id = $1`,
                [secondId]
            );
            expect(persisted[0]?.installment_status).toBe('DECLARED_UNPAID');
            expect(persisted[0]?.subscription_status).toBe('SUSPENDED');
            const suspensionRows = await execSQL<{ template: string }>(
                `SELECT template FROM email_outbox
                          WHERE recipient_user_id = $1 AND template = 'billing.arrears-suspension'`,
                [actors.user.id]
            );
            expect(suspensionRows).toHaveLength(1);
            await runCron({
                jobName: 'email-outbox-sender',
                adminCookie: actors.admin.sessionCookie
            });
            const suspensionMail = await mailCapture.waitForMail({
                to: actors.user.email,
                subject: 'Tu suscripción se suspendió',
                timeoutMs: MAIL_TIMEOUT_MS
            });
            expect(m.mailText(suspensionMail.html)).toContain(
                'Para volver, registrá el pago de la cuota adeudada.'
            );
            expect(m.mailText(suspensionMail.html)).not.toContain('tarjeta');

            const repeated = await m.adminJson({
                method: 'POST',
                path: unpaidPath,
                cookie: actors.admin.sessionCookie
            });
            const repeatedError = m.RejectionSchema.parse(repeated.body);
            expect(repeated.status).toBe(409);
            expect(repeatedError.error.reason).toBe('MANUAL_PAYMENT_NOT_AWAITING');
            const suspensionCount = await execSQL<{ count: number }>(
                `SELECT count(*)::int AS count FROM email_outbox
                          WHERE recipient_user_id = $1 AND template = 'billing.arrears-suspension'`,
                [actors.user.id]
            );
            expect(suspensionCount[0]?.count).toBe(1);
            expect(fakeServer.requests()).toHaveLength(0);
        });
    });

    test('seeded rows: MP6 marks 20 and 2, manual-grace-expiry rerun and MP4 reimputation', async () => {
        test.setTimeout(240_000);
        if (!world || !subscriber) throw new Error('Missing manual test world.');
        const actors = subscriber;
        const T2 = new Date(Math.floor(Date.now() / 1000) * 1000 + 120 * DAY_MS);
        await world.fakeServer.setClock({ at: T2 });
        const optionId = await monthlyOptionForSlug('partner-silver');
        const seed = async (
            args: Omit<
                Parameters<typeof m.seedManualSubscription>[0],
                'userId' | 'optionId' | 'adminId'
            >
        ) => {
            const created = await createUser({}, { apiBaseUrl: API_URL });
            userIds.push(created.id);
            return {
                payer: created,
                ...(await m.seedManualSubscription({
                    ...args,
                    userId: created.id,
                    optionId,
                    adminId: actors.admin.id
                }))
            };
        };
        const daysBefore = (days: number) => new Date(T2.getTime() - days * DAY_MS);
        await test.step('P1 and P5 (AC:B5:19): MP6 previews write nothing; marks 20 and 2 hang the new row', async () => {
            const postTerminationMark = 'COBRO_POSTERIOR_A_LA_BAJA';
            const cases = [
                ['duplicate', 'ACTIVE', 10, 20, 'REGISTERED', true, 'COBRO_DUPLICADO'],
                ['cancelled', 'CANCELLED', 20, 20, 'DECLARED_UNPAID', false, postTerminationMark],
                ['abandoned', 'ABANDONED', 30, 30, 'DECLARED_UNPAID', false, postTerminationMark]
            ] as const;
            for (const [name, status, age, nextOffset, installment, covered, mark] of cases) {
                const period = daysBefore(age);
                const { payer, subscriptionId, installmentIds } = await seed({
                    status,
                    nextChargeAt:
                        status === 'ACTIVE' ? new Date(T2.getTime() + nextOffset * DAY_MS) : period,
                    installments: [{ periodStart: period, status: installment, covered }]
                });
                const seededId = installmentIds[0];
                if (!seededId) throw new Error(`Missing ${name} installment.`);
                await m.exerciseUnallocatedManualPayment({
                    subscriptionId,
                    userId: payer.id,
                    cookie: actors.admin.sessionCookie,
                    adminId: actors.admin.id,
                    seededInstallmentId: seededId,
                    seededStatus: installment,
                    periodStart: period,
                    mark,
                    proofRef: `hos2160-${name}-${randomUUID()}`
                });
            }
        });

        await test.step('P6 (AC:B5:17): manual-grace-expiry twice leaves one DECLARED_UNPAID installment and one notice', async () => {
            const graceStart = daysBefore(11);
            const { payer, subscriptionId } = await seed({
                status: 'GRACE_PERIOD',
                nextChargeAt: graceStart,
                grace: { startedAt: graceStart, endsAt: new Date(T2.getTime() - 60_000) },
                installments: [
                    {
                        periodStart: m.addUtcMonths({ date: graceStart, months: -1 }),
                        status: 'REGISTERED',
                        covered: true
                    },
                    { periodStart: graceStart, status: 'AWAITING', covered: false }
                ]
            });
            await m.runManualGraceExpiryTwice({
                subscriptionId,
                userId: payer.id,
                periodStart: graceStart,
                adminCookie: actors.admin.sessionCookie
            });
        });

        await test.step('P1 and P4 (AC:B5:18): the MP4 preview names the reimputation; the act moves period, coverage and date', async () => {
            const latePeriod = daysBefore(45);
            const previousPeriod = m.addUtcMonths({ date: latePeriod, months: -1 });
            const expectedNext = m.addUtcMonths({ date: T2, months: 1 });
            const { payer, subscriptionId, installmentIds } = await seed({
                status: 'SUSPENDED',
                nextChargeAt: latePeriod,
                installments: [
                    { periodStart: previousPeriod, status: 'REGISTERED', covered: true },
                    { periodStart: latePeriod, status: 'DECLARED_UNPAID', covered: false }
                ]
            });
            const [previousId, lateId] = installmentIds;
            if (!previousId || !lateId) throw new Error('Missing MP4 seeded installments.');
            const snapshotArgs = { subscriptionId, userId: payer.id };
            const before = await m.snapshotSubscription(snapshotArgs);
            const path = `/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${lateId}/register-late`;
            const previewResponse = await m.adminJson({
                method: 'GET',
                path,
                cookie: actors.admin.sessionCookie
            });
            expect(previewResponse.status).toBe(200);
            const preview = m.ManualPaymentDataSchema.parse(previewResponse.body);
            expect(preview.data.subscriptionId).toBe(subscriptionId);
            expect(preview.data.manualPaymentId).toBe(lateId);
            expect(preview.data.periodStart).toBe(latePeriod.toISOString());
            expect(preview.data.effect).toBe('S7');
            expect(preview.data.reimputedPeriodStart).toBe(T2.toISOString());
            expect(preview.data.nextChargeAt).toBe(expectedNext.toISOString());
            expect(await m.snapshotSubscription(snapshotArgs)).toEqual(before);

            const proofRef = `hos2160-late-${randomUUID()}`;
            const response = await m.adminJson({
                method: 'POST',
                path,
                cookie: actors.admin.sessionCookie,
                body: { proofRef }
            });
            expect(response.status).toBe(200);
            const result = m.ManualPaymentDataSchema.parse(response.body);
            const receiptId = await m.assertLateManualPaymentPersisted({
                subscriptionId,
                userId: payer.id,
                previousId,
                manualPaymentId: lateId,
                previousPeriod,
                originalPeriod: latePeriod,
                periodStart: T2,
                nextChargeAt: expectedNext,
                proofRef,
                adminId: actors.admin.id
            });
            expect(result.data).toEqual({
                effect: 'S7',
                nextChargeAt: expectedNext.toISOString(),
                periodStart: T2.toISOString(),
                reimputedFrom: latePeriod.toISOString(),
                receiptId
            });
            expect(world?.fakeServer.requests()).toHaveLength(0);
        });
    });
});
