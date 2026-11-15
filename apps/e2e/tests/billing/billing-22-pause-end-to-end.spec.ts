import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    cleanupArrearsRows,
    createSubscriber,
    ensureDeadlineVersion,
    type FakeWorld,
    formatMarketDate,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { cleanupPlanChangeCase, openActivePlanCase } from '../../fixtures/plan-change-e2e.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const articleFor = (page: Page, id: string) =>
    page.locator(`article[data-testid="my-subscription"][data-subscription-id="${id}"]`);

type PauseRow = {
    readonly id: string;
    readonly reason: string;
    readonly requested_months: number;
    readonly expected_end_at: Date;
    readonly actual_end_at: Date | null;
};

test.describe('TEST:B8b:26 AC:B8b:26 pause and both resumptions end to end; sin correo propio: no existe plantilla @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(300_000);
    let world: FakeWorld | null = null;
    let providerNamespace = '';
    let userIds: string[] = [];

    test.beforeEach(async () => {
        await ensureDeadlineVersion();
        providerNamespace = randomUUID();
        const clock = createAdjustableClock({ start: new Date() });
        const fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: providerNamespace,
                honestAbout: [
                    { lie: 'M1', why: 'TEST:B8b:26 needs the starting card checkout.' },
                    { lie: 'M6', why: 'TEST:B8b:26 observes the starting authorization notice.' },
                    { lie: 'M8', why: 'TEST:B8b:26 needs the credited starting cycle.' }
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
    });

    test.afterEach(async () => {
        try {
            await world?.fakeServer.close();
            const providerIds = await cleanupPlanChangeCase({ userIds, providerNamespace });
            await cleanupArrearsRows({ userIds });
            expect(
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                }),
                'TEST:B8b:26 cleanup: no case sweep candidates survive.'
            ).toEqual([]);
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            world = null;
            providerNamespace = '';
            userIds = [];
        }
    });

    test('one monthly subscriber pauses twice, resumes at expiry and early through real routes', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:B8b:26 setup: case-local fake provider missing.');
        const caseWorld = world;
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(page);
        const { subscriptionId, authorizationId } = await openActivePlanCase({
            page,
            world: caseWorld,
            user: subscriber.user,
            admin: subscriber.admin,
            slug: 'owner-basico'
        });
        const article = articleFor(page, subscriptionId);
        await expect(
            article,
            'TEST:B8b:26 setup: paid monthly subscription is visible.'
        ).toBeVisible();

        const mutations = (status: 'paused' | 'authorized') =>
            caseWorld.fakeServer
                .requests()
                .filter(
                    (request) =>
                        request.method === 'PUT' &&
                        request.path === `/preapproval/${authorizationId}` &&
                        typeof request.body === 'object' &&
                        request.body !== null &&
                        'status' in request.body &&
                        request.body.status === status
                );
        const pauses = () =>
            execSQL<PauseRow>(
                'SELECT id, reason, requested_months, expected_end_at, actual_end_at FROM subscription_pause WHERE subscription_id = $1 ORDER BY starts_at',
                [subscriptionId]
            );
        const status = async () => {
            const [row] = await execSQL<{ status: string }>(
                'SELECT status FROM subscription WHERE id = $1',
                [subscriptionId]
            );
            return row?.status;
        };
        const pauseFromUi = async (step: string, count: number) => {
            await article.getByRole('button', { name: 'Pausar suscripción' }).click();
            const confirmation = article.getByTestId('pause-confirmation');
            await expect(
                confirmation.locator('p').nth(1),
                `TEST:B8b:26 ${step}: complete listing and retention consequence.`
            ).toHaveText(
                'Tu ficha sale del sitio público hoy. Vuelve sola al reanudar si el cupo del plan alcanza. Durante la pausa no se archiva, no se borra ni recibe avisos de retención; el reloj se detiene y arranca de cero al volver.'
            );
            await expect(
                confirmation.locator('p').nth(2),
                `TEST:B8b:26 ${step}: recurrent addon consequence.`
            ).toHaveText(
                'Los addons recurrentes de esta vertical se pausan por los mismos meses y vuelven con el plan:'
            );
            await expect(
                confirmation.locator('button'),
                `TEST:B8b:26 ${step}: complete confirmation controls.`
            ).toHaveText(['Confirmar pausa']);
            const displayedEnd = await confirmation.locator('p').first().textContent();
            const before = mutations('paused').length;
            expect(before, `TEST:B8b:26 ${step}: provider has no unconfirmed pause.`).toBe(
                count - 1
            );
            await confirmation.getByRole('button', { name: 'Confirmar pausa' }).click();
            await expect(
                article.getByRole('status'),
                `TEST:B8b:26 ${step}: pause response arrived.`
            ).toBeVisible();
            const rows = await pauses();
            const current = rows[count - 1];
            expect(current, `TEST:B8b:26 ${step}: pause row exists.`).toBeDefined();
            if (!current) throw new Error(`TEST:B8b:26 ${step}: missing pause row.`);
            expect(current.reason, `TEST:B8b:26 ${step}: customer requested pause.`).toBe(
                'CUSTOMER_REQUEST'
            );
            expect(current.requested_months, `TEST:B8b:26 ${step}: one month requested.`).toBe(1);
            expect(current.actual_end_at, `TEST:B8b:26 ${step}: pause remains open.`).toBeNull();
            expect(await status(), `TEST:B8b:26 ${step}: subscription is paused.`).toBe('PAUSED');
            expect(
                displayedEnd,
                `TEST:B8b:26 ${step}: customer's exact end date before confirmation.`
            ).toBe(
                `Si confirmás, tu suscripción queda pausada hasta el ${formatMarketDate(current.expected_end_at)}.`
            );
            await expect(
                article.getByRole('status'),
                `TEST:B8b:26 ${step}: paused row reports customer's end date.`
            ).toHaveText(
                `Tu suscripción quedó pausada hasta el ${formatMarketDate(current.expected_end_at)}.`
            );
            const sent = mutations('paused').slice(before);
            expect(
                sent,
                `TEST:B8b:26 ${step}: one provider pause after confirmation.`
            ).toHaveLength(1);
            await page.reload();
            await expect(
                article.getByText('Pausada', { exact: true }),
                `TEST:B8b:26 ${step}: subscription row displays PAUSED.`
            ).toBeVisible();
            return current;
        };

        const first = await test.step('TEST:B8b:26 pause one month', async () =>
            pauseFromUi('first pause', 1));

        await test.step('TEST:B8b:26 resume at expiry with M12 enabled', async () => {
            await caseWorld.fakeServer.setClock({
                at: new Date(first.expected_end_at.getTime() + 60_000)
            });
            const before = mutations('authorized').length;
            const result = await runCron({
                jobName: 'subscription-pause-end',
                adminCookie: subscriber.admin.sessionCookie
            });
            expect(result.success, 'TEST:B8b:26 expiry: pause-end job succeeds.').toBe(true);
            expect(await status(), 'TEST:B8b:26 expiry: subscription returns to ACTIVE.').toBe(
                'ACTIVE'
            );
            const [closed] = await pauses();
            expect(closed?.actual_end_at, 'TEST:B8b:26 expiry: pause has actual end.').toEqual(
                expect.any(Date)
            );
            expect(
                mutations('authorized').slice(before),
                'TEST:B8b:26 expiry: job resumed provider.'
            ).toHaveLength(1);
            await page.reload();
            await expect(
                article.getByText('Activa', { exact: true }),
                'TEST:B8b:26 expiry: subscription row displays ACTIVE.'
            ).toBeVisible();
            await expect(
                article.getByRole('button', { name: 'Pausar suscripción' }),
                'TEST:B8b:26 expiry: ACTIVE row offers pause again.'
            ).toBeVisible();
        });

        await test.step('TEST:B8b:26 pause a second time below the annual limit', async () => {
            await pauseFromUi('second pause', 2);
            expect((await pauses()).length, 'TEST:B8b:26 second pause: two customer pauses.').toBe(
                2
            );
        });

        await test.step('TEST:B8b:26 resume early from My Subscription', async () => {
            await article.getByRole('button', { name: 'Reanudar suscripción' }).click();
            const confirmation = article.getByTestId('resume-confirmation');
            await expect(
                confirmation,
                'TEST:B8b:26 early: complete confirmation block.'
            ).toHaveText(
                'Tu suscripción se reanuda hoy y te mostramos el día del próximo cobro.Confirmar reanudación'
            );
            await expect(
                confirmation.locator('button'),
                'TEST:B8b:26 early: complete confirmation controls.'
            ).toHaveText(['Confirmar reanudación']);
            const before = mutations('authorized').length;
            expect(
                before,
                'TEST:B8b:26 early: only the expiry job resumed the provider so far.'
            ).toBe(1);
            await confirmation.getByRole('button', { name: 'Confirmar reanudación' }).click();
            await expect(
                article.getByTestId('resume-result'),
                'TEST:B8b:26 early: resume response arrived.'
            ).toBeVisible();
            const [subscription] = await execSQL<{
                status: string;
                next_charge_at: Date | null;
                amount: string;
                currency: string;
            }>(
                'SELECT s.status, s.next_charge_at, bo.amount, bo.currency FROM subscription s JOIN billing_option bo ON bo.id = s.billing_option_id WHERE s.id = $1',
                [subscriptionId]
            );
            expect(subscription?.status, 'TEST:B8b:26 early: subscription returns to ACTIVE.').toBe(
                'ACTIVE'
            );
            if (!subscription?.next_charge_at)
                throw new Error('TEST:B8b:26 early: missing next charge.');
            const amount = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: subscription.currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Number(subscription.amount) / 100);
            await expect(
                article.getByTestId('resume-result'),
                'TEST:B8b:26 early: whole result contains only the next charge and amount.'
            ).toHaveText(
                `Te vamos a cobrar el ${formatMarketDate(subscription.next_charge_at)}: ${amount}.`
            );
            const rows = await pauses();
            expect(
                rows[1]?.actual_end_at,
                'TEST:B8b:26 early: second pause has actual end.'
            ).toEqual(expect.any(Date));
            const sent = mutations('authorized').slice(before);
            expect(sent, 'TEST:B8b:26 early: provider resumed after UI confirmation.').toHaveLength(
                1
            );
            await page.reload();
            await expect(
                article.getByText('Activa', { exact: true }),
                'TEST:B8b:26 early: subscription row displays ACTIVE.'
            ).toBeVisible();
        });
    });
});
