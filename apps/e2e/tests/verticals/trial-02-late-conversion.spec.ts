/**
 * TEST:V4:23 (AC:V4:17): the late conversion of an expired trial, T5
 * (`TRIAL_EXPIRED` -> `TRIAL_CONVERTED`): "corta la campaña de recuperación;
 * la publicación la restituye `PB3`".
 *
 * Coord-99 (HOS-1536) moved this step to the B4 exit: under the bootstrap
 * billing the trial never converted (contract §8.2) and nothing called
 * `convertTrialOnTitle`. Since B4 the coverage is billing's real one and the
 * trial listener (`subscribeTrialCoverageConversion`) runs T5 on the coverage
 * notice of the first credited payment (P1), so the step is exercisable.
 *
 * A spec of its own, not a step of `trial-01-end-to-end.spec.ts`: that spec
 * sits at 489 of the 500-line ceiling and is the one that fell four times in
 * CI. The path to an expired trial reuses trial-01's steps (activation by
 * publishing on the web, `trial-machine-expiry`, the outbox sender), and the
 * real signup reuses billing-02's (S1, `approve`, `deliverDueAsMercadoPago`).
 * The first charge goes through the fake provider and a Mercado Pago delivery
 * to the receiver, never through SQL: the point is that P1 converts.
 */
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    E2E_RECEIVER_PATH,
    E2E_WEBHOOK_SECRET,
    startE2eFakeProvider
} from '../../fixtures/fake-provider-server.ts';
import {
    type E2eMailCaptureServer,
    startE2eMailCapture
} from '../../fixtures/mail-capture-server.ts';
import { attachSession, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import {
    expectWinBackContent,
    publicationStatus,
    runCron,
    sendAfterOf,
    subscriptionStatus,
    trialOutboxRows,
    trialStatus,
    WIN_BACK_MAILS
} from '../../fixtures/trial-late-conversion.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const DAY_MS = 86_400_000;
const MAIL_TIMEOUT_MS = 30_000;

let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
let capture: E2eMailCaptureServer | null = null;
let owner: Awaited<ReturnType<typeof createUser>> | null = null;
let admin: Awaited<ReturnType<typeof createUser>> | null = null;
let accommodationId = '';

test.describe('TEST:V4:23 AC:V4:17 the late conversion of an expired trial (T5) @p0 @verticals @clock', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        const t0 = new Date();
        t0.setSeconds(0, 0);
        const clock = createAdjustableClock({ start: t0 });
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [
                    { lie: 'M6', why: 'TEST:V4:23 delivers the authorization notice at once.' },
                    { lie: 'M8', why: 'TEST:V4:23 settles the first charge at once.' }
                ]
            }),
            clock
        });
        capture = await startE2eMailCapture();
        await execSQL(
            `INSERT INTO billing_deadline_version (version, "values")
             VALUES (1, $1::jsonb) ON CONFLICT (version) DO NOTHING`,
            [
                JSON.stringify({
                    '10': { cardHours: 72, manualDays: 7 },
                    '11': { noticeDays: 60, contactDays: [30, 7] },
                    '12': { noticeDays: 60, contactDays: [30, 7] },
                    '13': { daysBefore: [5, 1] },
                    '14': { daysBefore: 7 },
                    '15': { hoursRemaining: 24 },
                    '16': { days: 7 },
                    '17': { days: 7 },
                    '18': { days: 180 },
                    '19': { minutes: 60 }
                })
            ]
        );
        owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        await markProfileCompleted({ userId: owner.id });
        admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'trial-late',
            withTrial: false
        });
        accommodationId = accommodation.id;
        // Publishing requires a main image, seeded as trial-01 does.
        await execSQL(
            `INSERT INTO accommodation_media
                 (accommodation_id, url, state, is_featured, sort_order, moderation_state)
             VALUES ($1, 'https://cdn.example.test/e2e-trial-late-main.jpg', 'visible', true, 0, 'APPROVED')`,
            [accommodationId]
        );
    });

    test.afterAll(async () => {
        try {
            const ids = [owner?.id, admin?.id].filter((id): id is string => Boolean(id));
            if (owner) {
                await execSQL(
                    `UPDATE email_outbox
                        SET status = 'failed', last_error = 'cancelled:e2e-cleanup',
                            locked_by = NULL, locked_until = NULL
                      WHERE recipient_user_id = $1 AND status IN ('pending', 'retry')`,
                    [owner.id]
                );
            }
            if (ids.length > 0) {
                await execSQL(
                    `DELETE FROM provider_link
                      WHERE subscription_id IN (
                          SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])
                      )`,
                    [ids]
                );
                await cleanupTestUsers(getDbPool(), ids);
            }
        } finally {
            try {
                await capture?.close();
            } finally {
                await fakeServer?.close();
            }
        }
    });

    test('an expired trial converts on the first credited payment and stops its recovery campaign', async ({
        page
    }) => {
        test.setTimeout(300_000);
        if (!owner || !admin || !fakeServer || !capture) {
            throw new Error('TEST:V4:23 setup did not create its users, clock, and capture server');
        }
        const ownerUser = owner;
        const adminCookie = admin.sessionCookie;
        const providerServer = fakeServer;
        const mailCapture = capture;
        const ownerId = ownerUser.id;
        let trialEnd = 0;
        let subscriptionId = '';
        let authorizationId = '';

        await test.step('(a) publishing on the web activates the trial and publishes the listing', async () => {
            await seedCookieConsent(page);
            await attachSession(page, ownerUser.sessionCookie);
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            await page
                .getByRole('list', { name: 'Mis propiedades' })
                .getByRole('button', { name: 'Publicar', exact: true })
                .click();
            await page.getByRole('button', { name: 'Sí, publicar', exact: true }).click();
            await expect
                .poll(() => trialStatus({ ownerId }), {
                    timeout: 30_000,
                    message: 'publishing should activate the owner trial'
                })
                .toBe('TRIAL_ACTIVE');
            await expect.poll(() => publicationStatus({ accommodationId })).toBe('PUBLISHED');
            const rows = await execSQL<{ ends_at: Date | string }>(
                `SELECT ends_at FROM trial WHERE user_id = $1 AND vertical = 'accommodation'`,
                [ownerId]
            );
            trialEnd = new Date(rows[0]?.ends_at ?? 0).getTime();
            expect(trialEnd).toBeGreaterThan(0);
        });

        await test.step('(b) the trial expires and PB2 unpublishes the listing', async () => {
            await providerServer.setClock({ at: new Date(trialEnd + 60_000) });
            await runCron({ jobName: 'trial-machine-expiry', adminCookie });
            await expect.poll(() => trialStatus({ ownerId })).toBe('TRIAL_EXPIRED');
            await expect
                .poll(() => publicationStatus({ accommodationId }), {
                    message: 'PB2 should unpublish the listing after the trial coverage expires'
                })
                .not.toBe('PUBLISHED');
        });

        await test.step('(c) the first recovery notice is sent with its content', async () => {
            const first = (await trialOutboxRows({ ownerId }))
                .filter((row) => row.template.startsWith('trial_win_back_'))
                .sort((a, b) => sendAfterOf(a) - sendAfterOf(b))[0];
            expect(first?.template).toBe('trial_win_back_1d');
            if (!first) throw new Error('TEST:V4:23 expected a queued trial_win_back_1d');
            await providerServer.setClock({ at: new Date(sendAfterOf(first) + 60_000) });
            await runCron({ jobName: 'email-outbox-sender', adminCookie });
            const expected = WIN_BACK_MAILS.trial_win_back_1d;
            if (!expected) throw new Error('TEST:V4:23 has no expectations for trial_win_back_1d');
            const mail = await mailCapture.waitForMail({
                to: ownerUser.email,
                subject: expected.subject,
                timeoutMs: MAIL_TIMEOUT_MS
            });
            expectWinBackContent({ mail, ownerEmail: ownerUser.email, title: expected.title });
        });

        await test.step('(d) a real signup reaches ACTIVE and, without a charge, does not convert', async () => {
            const billingOptionId = await monthlyOptionForSlug('owner-basico');
            const response = await fetch(`${API_URL}/api/v1/protected/billing/subscriptions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', cookie: ownerUser.sessionCookie },
                body: JSON.stringify({ billingOptionId })
            });
            const body = (await response.json()) as {
                readonly data?: {
                    readonly subscriptionId?: string;
                    readonly authorizationId?: string;
                };
            };
            expect(response.status, JSON.stringify(body)).toBe(201);
            subscriptionId = body.data?.subscriptionId ?? '';
            authorizationId = body.data?.authorizationId ?? '';
            expect(subscriptionId).not.toBe('');
            expect(authorizationId).not.toBe('');
            await providerServer.provider.approve({ authorizationId });
            const delivery = await providerServer.deliverDueAsMercadoPago({
                to: `${API_URL}${E2E_RECEIVER_PATH}`,
                webhookSecret: E2E_WEBHOOK_SECRET
            });
            expect(delivery.delivered).toBeGreaterThanOrEqual(1);
            await expect.poll(() => subscriptionStatus({ subscriptionId })).toBe('ACTIVE');
            // An ACTIVE subscription without a credited payment is `charged: no`:
            // it does not convert (DEC-TRIAL-010).
            expect(await trialStatus({ ownerId })).toBe('TRIAL_EXPIRED');
        });

        await test.step('(e) the first charge is credited through a Mercado Pago delivery (P1)', async () => {
            const options = await execSQL<{ amount: number; currency: string }>(
                `SELECT billing_option.amount, billing_option.currency
                   FROM subscription
                   JOIN billing_option ON billing_option.id = subscription.billing_option_id
                  WHERE subscription.id = $1`,
                [subscriptionId]
            );
            const option = options[0];
            if (!option) throw new Error('TEST:V4:23 could not read the subscription amount');
            await providerServer.provider.charge({
                authorizationId,
                amount: { amountMinor: Number(option.amount), currency: option.currency },
                reference: subscriptionId
            });
            const delivery = await providerServer.deliverDueAsMercadoPago({
                to: `${API_URL}${E2E_RECEIVER_PATH}`,
                webhookSecret: E2E_WEBHOOK_SECRET
            });
            expect(delivery.delivered).toBeGreaterThanOrEqual(1);
            await expect
                .poll(
                    async () =>
                        (
                            await execSQL<{ status: string }>(
                                `SELECT status FROM payment WHERE subscription_id = $1`,
                                [subscriptionId]
                            )
                        ).map((row) => row.status),
                    { timeout: 30_000, message: 'P1 should credit the first charge' }
                )
                .toContain('SUCCEEDED');
        });

        await test.step('(f) T5 converts, ends the recovery campaign and PB3 republishes', async () => {
            await expect
                .poll(() => trialStatus({ ownerId }), {
                    timeout: 30_000,
                    message: 'the first credited payment should convert the expired trial (T5)'
                })
                .toBe('TRIAL_CONVERTED');
            await expect
                .poll(
                    async () =>
                        (await trialOutboxRows({ ownerId })).filter(
                            (row) =>
                                row.template.startsWith('trial_win_back_') &&
                                (row.status === 'pending' || row.status === 'retry')
                        ).length,
                    { message: 'T5 cancels the recovery rows that were still pending' }
                )
                .toBe(0);
            await expect
                .poll(() => publicationStatus({ accommodationId }), {
                    timeout: 30_000,
                    message: 'PB3 should republish the listing on the coverage change'
                })
                .toBe('PUBLISHED');

            const winBackSubjects = Object.values(WIN_BACK_MAILS).map((mail) => mail.subject);
            const winBackCount = () =>
                mailCapture
                    .mailsTo({ to: ownerUser.email })
                    .filter((mail) => winBackSubjects.includes(mail.subject)).length;
            const before = winBackCount();
            expect(before, 'the trial_win_back_1d notice was captured before').toBe(1);
            await providerServer.setClock({ at: new Date(trialEnd + 61 * DAY_MS) });
            await runCron({ jobName: 'email-outbox-sender', adminCookie });
            expect(winBackCount(), 'no recovery notice arrives after the conversion').toBe(before);
        });
    });
});
