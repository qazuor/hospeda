/**
 * Preconditions: E2E database has the 0144 accommodation catalog and billing
 * schema; Playwright starts the built API with the fake provider env configured.
 */
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { createUser, markProfileCompleted } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import {
    E2E_FAKE_PROVIDER_URL,
    startE2eFakeProvider
} from '../../fixtures/fake-provider-server.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const API_PATH = `${API_URL}/api/v1/protected/billing/subscriptions`;
const clock = createAdjustableClock({ start: new Date() });
const userIdsToCleanup: string[] = [];
let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
let monthlyOptionId = '';
let annualOptionId = '';

test.describe('TEST:B3:43 AC:B3:43 fake provider server and clock @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        const initialProvider = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID()
        });
        fakeServer = await startE2eFakeProvider({ provider: initialProvider, clock });

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

        const versions = await execSQL<{ id: string }>(
            `SELECT plan_version.id
               FROM plan_version
               JOIN plan ON plan.id = plan_version.plan_id
              WHERE plan.vertical = 'accommodation'
                AND plan_version.vertical = 'accommodation'
                AND plan_version.current = true
                AND plan_version.sellable = true
                AND plan.slug IN ('owner-basico', 'owner-pro', 'owner-premium')
              ORDER BY plan.pricing_order
              LIMIT 1`
        );
        const planVersionId = versions[0]?.id;
        if (!planVersionId) {
            throw new Error(
                'TEST:B3:43 requires a current, sellable accommodation catalog version (0144)'
            );
        }

        for (const cycle of ['monthly', 'annual'] as const) {
            await execSQL(
                `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
                 VALUES ($1, $2, 100000, 'ARS')
                 ON CONFLICT (plan_version_id, cycle) DO NOTHING`,
                [planVersionId, cycle]
            );
        }
        const options = await execSQL<{ cycle: string; id: string }>(
            `SELECT cycle, id FROM billing_option
              WHERE plan_version_id = $1 AND cycle IN ('monthly', 'annual')`,
            [planVersionId]
        );
        monthlyOptionId = options.find((row) => row.cycle === 'monthly')?.id ?? '';
        annualOptionId = options.find((row) => row.cycle === 'annual')?.id ?? '';
        if (!monthlyOptionId || !annualOptionId) {
            throw new Error(
                'TEST:B3:43 could not create or read monthly and annual billing options'
            );
        }
    });

    test.afterAll(async () => {
        try {
            if (userIdsToCleanup.length > 0) {
                await execSQL(
                    `DELETE FROM provider_link
                      WHERE subscription_id IN (
                          SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])
                      )`,
                    [userIdsToCleanup]
                );
                await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
                userIdsToCleanup.length = 0;
            }
        } finally {
            await fakeServer?.close();
        }
    });

    async function freshUser() {
        const user = await createUser({}, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(user.id);
        await markProfileCompleted({ userId: user.id });
        return user;
    }

    async function startSubscription(
        user: Awaited<ReturnType<typeof freshUser>>,
        optionId: string
    ) {
        if (!fakeServer) throw new Error('TEST:B3:43 fake provider server was not started');
        const previousRequestCount = fakeServer.requests().length;
        const response = await fetch(API_PATH, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                cookie: user.sessionCookie
            },
            body: JSON.stringify({ billingOptionId: optionId })
        });
        const body = (await response.json()) as {
            data?: { authorizationId?: string; checkoutUrl?: string; subscriptionId?: string };
            error?: { code?: string; reason?: string };
        };
        expect(
            fakeServer.requests().length,
            'la API no está apuntada al falso; ¿se arrancó sin HOSPEDA_MERCADO_PAGO_API_BASE_URL?'
        ).toBeGreaterThan(previousRequestCount);
        return { response, body };
    }

    test('sanitizes the broken authorization link from the fake server', async () => {
        if (!fakeServer) throw new Error('TEST:B3:43 fake provider server was not started');
        fakeServer.useProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() })
        });
        const user = await freshUser();
        const { response, body } = await startSubscription(user, monthlyOptionId);
        expect({ status: response.status, checkoutUrl: body.data?.checkoutUrl }).toMatchObject({
            status: 201,
            checkoutUrl: expect.any(String)
        });
        expect(body.data?.checkoutUrl).not.toContain('activation');
        const serverRead = await fetch(
            `${E2E_FAKE_PROVIDER_URL}/preapproval/${body.data?.authorizationId}`,
            { headers: { authorization: 'Bearer e2e-fake-provider' } }
        );
        const serverBody = (await serverRead.json()) as { init_point?: string };
        expect(serverBody.init_point).toContain('activation');
        expect(fakeServer.requests().some((request) => request.path === '/preapproval')).toBe(true);
        // B3.6 (Coord-32): assert the web checkout renders checkoutUrl.
    });

    test('turns off M10 by name and returns the healthy link', async () => {
        if (!fakeServer) throw new Error('TEST:B3:43 fake provider server was not started');
        fakeServer.useProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [
                    { lie: 'M10', why: 'TEST:B3:43 checks the healthy authorization link.' }
                ]
            })
        });
        const user = await freshUser();
        const { response, body } = await startSubscription(user, monthlyOptionId);
        expect({ status: response.status, checkoutUrl: body.data?.checkoutUrl }).toMatchObject({
            status: 201,
            checkoutUrl: expect.any(String)
        });
        const serverRead = await fetch(
            `${E2E_FAKE_PROVIDER_URL}/preapproval/${body.data?.authorizationId}`,
            { headers: { authorization: 'Bearer e2e-fake-provider' } }
        );
        const serverBody = (await serverRead.json()) as { init_point?: string };
        expect(serverBody.init_point).toBeTruthy();
        expect(serverBody.init_point).not.toContain('activation');
        expect(body.data?.checkoutUrl).toBe(serverBody.init_point);
    });

    test('detects the unapplied annual option and accepts it when M1 is honest', async () => {
        if (!fakeServer) throw new Error('TEST:B3:43 fake provider server was not started');
        fakeServer.useProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() })
        });
        const lyingUser = await freshUser();
        const unapplied = await startSubscription(lyingUser, annualOptionId);
        expect({
            status: unapplied.response.status,
            reason: unapplied.body.error?.reason,
            checkoutUrl: unapplied.body.data?.checkoutUrl
        }).toEqual({ status: 502, reason: 'CREATION_NOT_APPLIED', checkoutUrl: undefined });

        fakeServer.useProvider({
            provider: new FakePaymentProvider({
                clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [
                    { lie: 'M1', why: 'TEST:B3:43 checks annual authorization creation.' }
                ]
            })
        });
        const honestUser = await freshUser();
        const applied = await startSubscription(honestUser, annualOptionId);
        expect({
            status: applied.response.status,
            checkoutUrl: applied.body.data?.checkoutUrl
        }).toMatchObject({
            status: 201,
            checkoutUrl: expect.any(String)
        });
    });

    test('the built API reads the clock moved by the fake server', async () => {
        if (!fakeServer) throw new Error('TEST:B3:43 fake provider server was not started');
        const at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await fakeServer.setClock({ at });
        fakeServer.useProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() })
        });
        const user = await freshUser();
        const { response, body } = await startSubscription(user, monthlyOptionId);
        expect({ status: response.status, checkoutUrl: body.data?.checkoutUrl }).toMatchObject({
            status: 201,
            checkoutUrl: expect.any(String)
        });
        const rows = await execSQL<{ authorization_window_ends_at: string }>(
            `SELECT authorization_window_ends_at
               FROM subscription
              WHERE id = $1 AND user_id = $2`,
            [body.data?.subscriptionId, user.id]
        );
        const deadline = rows[0]?.authorization_window_ends_at;
        expect(deadline, 'the subscription row must persist the authorization window').toBeTruthy();
        const actual = new Date(deadline ?? '').getTime();
        const expected = at.getTime() + 72 * 60 * 60 * 1000;
        expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1000);
        expect(Math.abs(actual - (Date.now() + 72 * 60 * 60 * 1000))).toBeGreaterThan(
            29 * 24 * 60 * 60 * 1000
        );
    });
});
