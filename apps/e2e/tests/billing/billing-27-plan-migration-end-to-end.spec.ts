import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    type CreatedUser,
    createUser,
    markAdminToursSeen,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { readSubscriptionRow } from '../../fixtures/cancellation-flow.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { useAdminSession } from '../../fixtures/revocation-flow.ts';
import {
    abandonPendingAttempt,
    cancelOwn,
    changePlan,
    cleanupMigrationCase,
    readMigrationRows
} from './helpers/plan-migration-cases.ts';
import {
    anchorOf,
    buildMigrationCohort,
    type MigrationCohort
} from './helpers/plan-migration-launch.ts';
import {
    advanceThroughRenewals,
    changeAmountRequests,
    detailCount,
    formatMinorAmount,
    mailText,
    type RenewalPayer,
    runCronDetails,
    waitForMailCount
} from './helpers/plan-migration-timeline.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:18000';
const PRICE = 250_000;
const NEW_PRICE = 350_000;
const DAY = 24 * 60 * 60 * 1000;
/** `S37` runs seven local days before the application date (NUCLEO/02 §1.5). */
const S37_LEAD_DAYS = 7;
const ANNOUNCED = 'Tu plan deja de venderse';
const UPCOMING = 'Se acerca el cambio de tu plan';
const SOURCE_NAME = 'Migration retired';
const TARGET_NAME = 'Migration successor';

type Launched = MigrationCohort & {
    readonly world: FakeWorld;
    readonly admin: CreatedUser;
    readonly migrationId: string;
};

/**
 * Requires E2E API/admin/web builds, seeded commercial limit, fake provider and mail capture.
 * One cohort crosses five serial steps: launch from the panel, the three exits, the first
 * contact notice, `S37` seven days before the date, and the sweep plus `S38`.
 */
test.describe('TEST:B12:12 AC:B12:11 la migración de un plan retirado, de punta a punta @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let providerNamespace = '';
    let sourceVersionId = '';
    let actors: CreatedUser[] = [];
    let launched: Launched | null = null;
    let payers: RenewalPayer[] = [];
    const need = (): Launched => {
        if (!launched) throw new Error('TEST:B12:12: the launch step did not complete.');
        return launched;
    };

    test.afterAll(async () => {
        try {
            await world?.fakeServer.close();
            await cleanupMigrationCase({
                userIds: actors.map(({ id }) => id),
                providerNamespace,
                sourceVersionId
            });
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
        }
    });

    test('the panel launches the migration over one customer of every case and announces it', async ({
        page,
        browser
    }) => {
        await ensureDeadlineVersion();
        const [limit] = await execSQL<{ key: string }>(
            `SELECT key FROM catalog_key
              WHERE kind = 'limit' AND key_class = 'COMMERCIAL' AND aggregation_strategy = 'MAX'
              ORDER BY key LIMIT 1`
        );
        if (!limit) throw new Error('Expected a seeded commercial limit.');
        providerNamespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    {
                        lie: 'M1',
                        why: 'TEST:B12:12 needs real checkouts and the S37 amount change.'
                    },
                    { lie: 'M6', why: 'TEST:B12:12 activates card checkouts by notice.' },
                    { lie: 'M8', why: 'TEST:B12:12 needs credited renewals at the instant asked.' }
                ]
            }),
            clock
        });
        try {
            world = { clock, fakeServer, mailCapture: await startE2eMailCapture() };
        } catch (error) {
            await fakeServer.close();
            throw error;
        }
        const caseWorld = world;
        const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        const users: CreatedUser[] = [];
        for (let index = 0; index < 7; index += 1)
            users.push(await createUser({}, { apiBaseUrl: API_URL }));
        actors = [admin, ...users];
        await Promise.all(actors.map(({ id }) => markProfileCompleted({ userId: id })));
        await markAdminToursSeen({ userId: admin.id });
        const cohort = await buildMigrationCohort({
            page,
            browser,
            world: caseWorld,
            admin,
            users,
            limitKey: limit.key,
            rank: 1_200_000_000 + Number.parseInt(providerNamespace.slice(0, 7), 16),
            price: PRICE,
            newPrice: NEW_PRICE,
            onSourceVersion: (versionId) => {
                sourceVersionId = versionId;
            }
        });
        const { card, planChanger, canceller, abandoner, paused, grace, manual } = cohort;
        const { applicationDay } = cohort;

        await useAdminSession({ page, admin, adminUrl: ADMIN_URL });
        await page.goto(`${ADMIN_URL}/billing/plan-migration`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('plan-migration-screen')).toBeVisible();
        const sourceSelect = page.getByTestId('plan-migration-source');
        await expect(sourceSelect).toBeVisible({ timeout: 30_000 });
        await expect(sourceSelect.locator(`option[value="${cohort.sourceVersionId}"]`)).toHaveCount(
            1
        );
        await sourceSelect.selectOption(cohort.sourceVersionId);
        await page.getByTestId('plan-migration-target').selectOption(cohort.targetVersionId);
        await page.getByTestId('plan-migration-preview-button').click();
        const members = [card, planChanger, canceller, abandoner, paused, grace, manual];
        await expect(page.locator('tr[data-testid^="plan-migration-row-"]')).toHaveCount(7);
        for (const { subscriptionId } of members)
            await expect(page.getByTestId(`plan-migration-row-${subscriptionId}`)).toBeVisible();
        await page.getByTestId('plan-migration-confirm').click();
        await expect(page.getByTestId('plan-migration-result')).toBeVisible();
        const [migration] = await execSQL<{
            id: string;
            deadline_version: number;
            notice_days: number;
        }>(
            'SELECT id, deadline_version, notice_days FROM plan_migration WHERE source_plan_version_id = $1 AND signed_by = $2 ORDER BY created_at DESC LIMIT 1',
            [cohort.sourceVersionId, admin.id]
        );
        if (!migration) throw new Error('Admin confirmation did not persist a plan migration.');
        expect(migration.deadline_version).toBe(cohort.deadlineVersion);
        expect(migration.notice_days).toBe(cohort.noticeDays);
        const rows = await readMigrationRows({ admin, migrationId: migration.id });
        expect(rows.size).toBe(7);
        for (const { subscriptionId } of members)
            expect(rows.get(subscriptionId)?.status).toBe('PENDIENTE');
        for (const { subscriptionId } of [card, planChanger, canceller, paused, grace, manual])
            expect(
                rows.get(subscriptionId)?.applicationDate,
                'one application day for the cohort'
            ).toBe(applicationDay);

        await runCron({ jobName: 'email-outbox-sender', adminCookie: admin.sessionCookie });
        const announcement = mailText(
            (
                await caseWorld.mailCapture.waitForMail({
                    to: card.user.email,
                    subject: ANNOUNCED,
                    timeoutMs: 30_000
                })
            ).html
        );
        expect(announcement).toContain(`Tu plan ${SOURCE_NAME} deja de venderse.`);
        expect(announcement).toContain(`Tu suscripción pasará al plan ${TARGET_NAME}.`);
        expect(announcement).toContain('es una subida de precio');
        expect(announcement).toContain(`Tu precio actual es ${formatMinorAmount(PRICE)}.`);
        expect(announcement).toContain(`El precio nuevo será ${formatMinorAmount(NEW_PRICE)}.`);
        expect(announcement).toContain(
            `El cambio se aplicará el ${formatMarketDate(anchorOf(applicationDay))}.`
        );
        expect(announcement, 'no promo to lose in this cohort').not.toContain(
            'perdés tu promoción'
        );
        expect(announcement).toContain('Podés darte de baja o elegir otro plan antes del cambio.');
        await caseWorld.mailCapture.waitForMail({
            to: manual.user.email,
            subject: ANNOUNCED,
            timeoutMs: 30_000
        });

        // The grace payer declines its last renewal before the date; the card payer renews.
        payers = [
            { subscriptionId: card.subscriptionId, authorizationId: card.authorizationId },
            {
                subscriptionId: grace.subscriptionId,
                authorizationId: grace.authorizationId,
                declineLastBefore: applicationDay
            }
        ];
        launched = { ...cohort, world: caseWorld, admin, migrationId: migration.id };
    });

    test('changed-plan, cancelled and naturally terminated customers leave as FUERA with their reason', async () => {
        const s = need();
        await changePlan({
            user: s.planChanger.user,
            subscriptionId: s.planChanger.subscriptionId,
            billingOptionId: s.targetOptionId
        });
        await cancelOwn({ user: s.canceller.user, subscriptionId: s.canceller.subscriptionId });
        await abandonPendingAttempt({
            user: s.abandoner.user,
            subscriptionId: s.abandoner.subscriptionId
        });
        expect(
            (await readSubscriptionRow({ subscriptionId: s.abandoner.subscriptionId })).status
        ).toBe('ABANDONED');

        const rows = await readMigrationRows({ admin: s.admin, migrationId: s.migrationId });
        const exit = (subscriptionId: string) => {
            const row = rows.get(subscriptionId);
            return { status: row?.status, outReason: row?.outReason };
        };
        expect(exit(s.planChanger.subscriptionId)).toEqual({
            status: 'FUERA',
            outReason: 'CAMBIO_DE_PLAN'
        });
        expect(exit(s.canceller.subscriptionId)).toEqual({
            status: 'FUERA',
            outReason: 'SE_DIO_DE_BAJA'
        });
        expect(exit(s.abandoner.subscriptionId)).toEqual({ status: 'FUERA', outReason: 'TERMINO' });
        for (const { subscriptionId } of [s.card, s.paused, s.grace, s.manual])
            expect(exit(subscriptionId)).toEqual({ status: 'PENDIENTE', outReason: null });
    });

    test('the first contact notice states the date and both prices', async () => {
        const s = need();
        const firstContact = Math.max(...s.contactDays);
        const { declined } = await advanceThroughRenewals({
            world: s.world,
            adminCookie: s.admin.sessionCookie,
            payers,
            at: new Date(anchorOf(s.applicationDay).getTime() - firstContact * DAY)
        });
        payers = payers.filter(({ subscriptionId }) => !declined.includes(subscriptionId));
        await runCron({ jobName: 'plan-migration-notice', adminCookie: s.admin.sessionCookie });
        await runCron({ jobName: 'email-outbox-sender', adminCookie: s.admin.sessionCookie });
        const [first] = await waitForMailCount({
            world: s.world,
            to: s.card.user.email,
            subject: UPCOMING,
            count: 1
        });
        const text = mailText(first?.html ?? '');
        expect(text).toContain(
            `Faltan ${firstContact} días para el cambio de tu plan ${SOURCE_NAME} al plan ${TARGET_NAME}: será el ${formatMarketDate(anchorOf(s.applicationDay))}.`
        );
        expect(text).toContain(`Tu precio actual es ${formatMinorAmount(PRICE)}.`);
        expect(text).toContain(`El precio nuevo será ${formatMinorAmount(NEW_PRICE)}.`);
        expect(text).toContain('Podés darte de baja o elegir otro plan antes del cambio.');
    });

    test('S37 mutates the card amount only after our mails, waits for paused and grace, and applies the manual payer without the provider', async () => {
        const s = need();
        const { fakeServer, mailCapture } = s.world;
        const { declined } = await advanceThroughRenewals({
            world: s.world,
            adminCookie: s.admin.sessionCookie,
            payers,
            at: new Date(anchorOf(s.applicationDay).getTime() - S37_LEAD_DAYS * DAY)
        });
        payers = payers.filter(({ subscriptionId }) => !declined.includes(subscriptionId));
        expect((await readSubscriptionRow({ subscriptionId: s.grace.subscriptionId })).status).toBe(
            'GRACE_PERIOD'
        );
        expect(
            (await readSubscriptionRow({ subscriptionId: s.paused.subscriptionId })).status
        ).toBe('PAUSED');
        await runCron({ jobName: 'plan-migration-notice', adminCookie: s.admin.sessionCookie });
        await runCron({ jobName: 'email-outbox-sender', adminCookie: s.admin.sessionCookie });
        const reminders = await waitForMailCount({
            world: s.world,
            to: s.card.user.email,
            subject: UPCOMING,
            count: 2
        });
        const lastContact = Math.min(...s.contactDays);
        const last = mailText(reminders[1]?.html ?? '');
        expect(last).toContain(
            `Faltan ${lastContact} días para el cambio de tu plan ${SOURCE_NAME} al plan ${TARGET_NAME}: será el ${formatMarketDate(anchorOf(s.applicationDay))}.`
        );
        expect(last).toContain(`El precio nuevo será ${formatMinorAmount(NEW_PRICE)}.`);
        expect(last).toContain('Mercado Pago también te va a mandar un aviso del cambio de monto.');

        const ours = mailCapture
            .mailsTo({ to: s.card.user.email })
            .filter(({ subject }) => subject === ANNOUNCED || subject === UPCOMING);
        expect(ours).toHaveLength(3);
        expect(changeAmountRequests(fakeServer.requests()), 'no amount change before S37').toEqual(
            []
        );
        const requestsBefore = fakeServer.requests().length;
        const s37StartedAt = new Date();
        const s37 = await runCronDetails({
            jobName: 'plan-migration-application',
            adminCookie: s.admin.sessionCookie
        });
        expect(detailCount(s37, 'failed'), JSON.stringify(s37.details)).toBe(0);
        expect(detailCount(s37, 'appliedCard')).toBeGreaterThanOrEqual(1);
        expect(detailCount(s37, 'appliedManual')).toBeGreaterThanOrEqual(1);
        expect(
            detailCount(s37, 'waiting'),
            'paused and grace answer S37 WAITING'
        ).toBeGreaterThanOrEqual(2);

        const mutations = changeAmountRequests(fakeServer.requests());
        expect(mutations, 'one changeAmount: the card payer, never the manual one').toHaveLength(1);
        expect(mutations[0]?.request.path).toBe(`/preapproval/${s.card.authorizationId}`);
        expect(mutations[0]?.index ?? -1).toBeGreaterThanOrEqual(requestsBefore);
        for (const mail of ours)
            expect(
                mail.receivedAt.getTime(),
                `"${mail.subject}" captured before the provider notice`
            ).toBeLessThan(s37StartedAt.getTime());
        const { snapshot } = await fakeServer.provider.readAuthorization({
            authorizationId: s.card.authorizationId
        });
        expect(snapshot.amount?.amountMinor).toBe(NEW_PRICE);

        const rows = await readMigrationRows({ admin: s.admin, migrationId: s.migrationId });
        expect(rows.get(s.card.subscriptionId)?.status).toBe('APLICADA');
        expect(rows.get(s.manual.subscriptionId)?.status).toBe('APLICADA');
        expect(rows.get(s.paused.subscriptionId)?.status).toBe('PENDIENTE');
        expect(rows.get(s.grace.subscriptionId)?.status).toBe('PENDIENTE');
        expect(
            await execSQL('SELECT 1 FROM provider_link WHERE subscription_id = $1', [
                s.manual.subscriptionId
            ]),
            'the manual payer has no provider authorization to mutate'
        ).toEqual([]);
    });

    test('the sweep between S37 and S38 opens no DIVERGENCIA_DE_MONTO and S38 moves card and manual to the new version', async () => {
        const s = need();
        const lead = anchorOf(s.applicationDay).getTime() - S37_LEAD_DAYS * DAY;
        await s.world.fakeServer.setClock({ at: new Date(lead + DAY) });
        await runCron({
            jobName: 'billing-reconciliation-sweep',
            adminCookie: s.admin.sessionCookie
        });
        const live = [s.card, s.manual, s.paused, s.grace].map(
            ({ subscriptionId }) => subscriptionId
        );
        const marks = await execSQL<{ subscription_id: string; reason: string }>(
            `SELECT subscription_id, reason FROM reconciliation_mark
              WHERE subscription_id = ANY($1::uuid[]) AND lifted_at IS NULL AND reason = 'DIVERGENCIA_DE_MONTO'`,
            [live]
        );
        expect(marks).toEqual([]);

        const charges = await execSQL<{ next_charge_at: Date }>(
            'SELECT next_charge_at FROM subscription WHERE id = ANY($1::uuid[])',
            [[s.card.subscriptionId, s.manual.subscriptionId]]
        );
        const latest = Math.max(
            ...charges.map(({ next_charge_at }) => new Date(next_charge_at).getTime())
        );
        await s.world.fakeServer.setClock({ at: new Date(latest + 2 * 60 * 60 * 1000) });
        await runCron({
            jobName: 'subscription-scheduled-change',
            adminCookie: s.admin.sessionCookie
        });
        for (const { subscriptionId } of [s.card, s.manual])
            expect(
                (await readSubscriptionRow({ subscriptionId })).plan_version_id,
                'S38 anchors the migrated payer to the new version'
            ).toBe(s.targetVersionId);
        const rows = await readMigrationRows({ admin: s.admin, migrationId: s.migrationId });
        expect(rows.get(s.manual.subscriptionId)?.status).toBe('APLICADA');
    });
});
