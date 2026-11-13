import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
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
import {
    addUtcMonths,
    adminJson,
    cleanupManualAdminRows,
    mailText,
    snapshotSubscription,
    superAdminRecipients,
    unpaidNoticeRows
} from './helpers/manual-installment-admin.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const MAIL_TIMEOUT_MS = 30_000;
const Action6PreviewSchema = z.object({
    data: z.object({
        options: z.array(z.object({ billingOptionId: z.string(), planSlug: z.string() }))
    })
});
const Action6ResultSchema = z.object({
    data: z.object({ subscriptionId: z.string(), manualPaymentId: z.string() })
});
const RegisterPreviewSchema = z.object({
    data: z.strictObject({
        subscriptionId: z.string(),
        manualPaymentId: z.string(),
        periodStart: z.string(),
        effect: z.string(),
        nextChargeAt: z.string()
    })
});
const RegisterResultSchema = z.object({
    data: z.object({
        outcome: z.string(),
        effect: z.string(),
        nextChargeAt: z.string()
    })
});
const UnpaidPreviewSchema = z.object({
    data: z.strictObject({
        subscriptionId: z.string(),
        manualPaymentId: z.string(),
        periodStart: z.string(),
        effect: z.string()
    })
});
const UnpaidResultSchema = z.object({
    data: z.strictObject({ outcome: z.string(), notice: z.string() })
});
const RejectionSchema = z.object({ error: z.object({ reason: z.string() }) });

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
            await cleanupManualAdminRows({ userIds, partnerIds });
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

            const action6Path = `/api/v1/admin/partners/${partnerId}/billing-setup`;
            const previewResponse = await adminJson({
                method: 'GET',
                path: action6Path,
                cookie: actors.admin.sessionCookie
            });
            const preview = Action6PreviewSchema.parse(previewResponse.body);
            expect(previewResponse.status).toBe(200);
            expect(
                preview.data.options.map(({ billingOptionId, planSlug }) => ({
                    billingOptionId,
                    planSlug
                }))
            ).toContainEqual({ billingOptionId: optionId, planSlug: 'partner-silver' });

            const setupResponse = await adminJson({
                method: 'POST',
                path: action6Path,
                cookie: actors.admin.sessionCookie,
                body: {
                    billingOptionId: optionId,
                    reason: `HOS-2160 ${nonce}`,
                    confirm: true
                }
            });
            const setup = Action6ResultSchema.parse(setupResponse.body);
            expect(setupResponse.status).toBe(200);
            subscriptionId = setup.data.subscriptionId;
            firstId = setup.data.manualPaymentId;
            const initial = await execSQL<{ period_start: Date }>(
                'SELECT period_start FROM manual_payment WHERE id = $1',
                [firstId]
            );
            expect(initial).toHaveLength(1);
            periodStart1 = initial[0]?.period_start ?? new Date(0);

            const expected = await superAdminRecipients();
            const expectedIds = expected.map(({ userId }) => userId);
            expect(expectedIds).toContain(actors.admin.id);
            expect(expectedIds).toContain(admin2.id);
            expect(expectedIds).not.toContain(goneAdmin.id);
            let notices = await unpaidNoticeRows({ manualPaymentId: firstId });
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
                notices = await unpaidNoticeRows({ manualPaymentId: firstId });
            }
            expect(notices.map(({ status }) => status)).toEqual(notices.map(() => 'sent'));
            for (const recipient of expected) {
                const mail = mailCapture
                    .mailsTo({ to: recipient.email })
                    .filter(
                        (message) =>
                            message.subject === 'Cuota de pago manual sin pago' &&
                            mailText(message.html).includes(firstId)
                    );
                expect(mail).toHaveLength(1);
                expect(mailText(mail[0]?.html ?? '')).toContain(subscriptionId);
                expect(mailText(mail[0]?.html ?? '')).toContain(
                    'Registrá el pago o declarala impaga desde el panel de administración.'
                );
            }

            const beforePreview = await snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            const registerPath = `/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${firstId}/register`;
            const registerPreviewResponse = await adminJson({
                method: 'GET',
                path: registerPath,
                cookie: actors.admin.sessionCookie
            });
            const registerPreview = RegisterPreviewSchema.parse(registerPreviewResponse.body);
            expect(registerPreviewResponse.status).toBe(200);
            nextCharge1 = addUtcMonths({ date: periodStart1, months: 1 });
            expect(registerPreview.data).toEqual({
                subscriptionId,
                manualPaymentId: firstId,
                periodStart: periodStart1.toISOString(),
                effect: 'S29',
                nextChargeAt: nextCharge1.toISOString()
            });
            const afterPreview = await snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            expect(afterPreview).toEqual(beforePreview);

            const registerBody = { proofRef: `hos2160-${nonce}` };
            const registerResultResponse = await adminJson({
                method: 'POST',
                path: registerPath,
                cookie: actors.admin.sessionCookie,
                body: registerBody
            });
            const registerResult = RegisterResultSchema.parse(registerResultResponse.body);
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

            const repeated = await adminJson({
                method: 'POST',
                path: registerPath,
                cookie: actors.admin.sessionCookie,
                body: registerBody
            });
            const repeatedError = RejectionSchema.parse(repeated.body);
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
            const expected = await superAdminRecipients();
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
            let notices = await unpaidNoticeRows({ manualPaymentId: secondId });
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
            notices = await unpaidNoticeRows({ manualPaymentId: secondId });
            expect(afterRerun[0]?.count).toBe(1);
            expect(allInstallments[0]?.count).toBe(2);
            expect(notices).toHaveLength(expectedIds.length);
            expect(notices.map(({ recipient_user_id }) => recipient_user_id)).toEqual(expectedIds);
        });

        await test.step('P1, P2 and P6 (AC:B5:16): the MP2 preview writes nothing; declaring unpaid suspends and mails the payer once', async () => {
            const beforePreview = await snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            const unpaidPath = `/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments/${secondId}/declare-unpaid`;
            const unpaidPreviewResponse = await adminJson({
                method: 'GET',
                path: unpaidPath,
                cookie: actors.admin.sessionCookie
            });
            const unpaidPreview = UnpaidPreviewSchema.parse(unpaidPreviewResponse.body);
            expect(unpaidPreviewResponse.status).toBe(200);
            expect(unpaidPreview.data).toEqual({
                subscriptionId,
                manualPaymentId: secondId,
                periodStart: nextCharge1.toISOString(),
                effect: 'S6'
            });
            const afterPreview = await snapshotSubscription({
                subscriptionId,
                userId: actors.user.id
            });
            expect(afterPreview).toEqual(beforePreview);

            const declaration = await adminJson({
                method: 'POST',
                path: unpaidPath,
                cookie: actors.admin.sessionCookie
            });
            const result = UnpaidResultSchema.parse(declaration.body);
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
            expect(mailText(suspensionMail.html)).toContain(
                'Para volver, registrá el pago de la cuota adeudada.'
            );
            expect(mailText(suspensionMail.html)).not.toContain('tarjeta');

            const repeated = await adminJson({
                method: 'POST',
                path: unpaidPath,
                cookie: actors.admin.sessionCookie
            });
            const repeatedError = RejectionSchema.parse(repeated.body);
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
});
