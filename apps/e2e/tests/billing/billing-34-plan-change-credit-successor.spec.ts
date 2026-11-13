/**
 * Preconditions: the E2E catalog contains current owner-basico and owner-premium plan versions with
 * differing limits or entitlements; their monthly options and the owner-premium annual option are
 * inserted by the signup-checkout fixtures when missing. The API, web, PostgreSQL, Redis, fake
 * Mercado Pago and mail capture services are available.
 * Run through the PR e2e:p0 gate; this spec moves the shared API clock and runs serially.
 */
import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';
import {
    API_URL,
    activateCardSubscription,
    cancelRequestsFor,
    cleanupArrearsRows,
    createSubscriber,
    DAY_MS,
    deliverNotices,
    ensureDeadlineVersion,
    type FakeWorld,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { seedTwoComplements } from '../../fixtures/permanent-grant-flow.ts';
import { cleanupPlanChangeCase, openActivePlanCase } from '../../fixtures/plan-change-e2e.ts';
import { annualOptionForSlug, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';

const EFFECTIVE_SET_URL = `${API_URL}/api/v1/protected/users/me/effective-set?vertical=accommodation`;
const PlanChangeSchema = z.object({
    data: z.discriminatedUnion('outcome', [
        z.object({
            outcome: z.literal('SUCCESSION'),
            subscriptionId: z.string(),
            checkoutUrl: z.string(),
            firstChargeAt: z.string(),
            creditDays: z.number()
        }),
        z.object({
            outcome: z.literal('DOWNGRADE'),
            effectiveAt: z.string(),
            amountMinor: z.number()
        }),
        z.object({ outcome: z.literal('REGRET'), amountMinor: z.number() })
    ])
});
const EffectiveSetSchema = z.object({
    data: z.object({
        entitlements: z.record(z.string(), z.union([z.number(), z.literal('Infinity')])),
        limits: z.record(z.string(), z.union([z.number(), z.literal('Infinity')]))
    })
});
const CheckoutBodySchema = z.object({
    auto_recurring: z.object({
        transaction_amount: z.number(),
        start_date: z.string(),
        frequency: z.number(),
        frequency_type: z.string()
    })
});
type WorldCase = Awaited<ReturnType<typeof openActivePlanCase>> &
    Awaited<ReturnType<typeof createSubscriber>> & {
        readonly article: ReturnType<Page['locator']>;
    };

function equal(actual: unknown, expected: unknown, message: string): void {
    expect(actual, message).toEqual(expected);
}

function length(actual: readonly unknown[], expected: number, message: string): void {
    expect(actual, message).toHaveLength(expected);
}

function differs(actual: unknown, expected: unknown, message: string): void {
    expect(actual, message).not.toEqual(expected);
}

function ceilRatio(numerator: bigint, denominator: bigint): bigint {
    return (numerator + denominator - 1n) / denominator;
}

function valueCreditDays(args: {
    paidMinor: number;
    periodStart: Date;
    now: Date;
    targetMinor: number;
    targetMonths: number;
}): number {
    const periodEnd = addCalendarMonths({
        from: args.periodStart,
        months: 1,
        dayOverflow: 'clamp'
    });
    const periodMs = periodEnd.getTime() - args.periodStart.getTime();
    const remainingMs = Math.max(0, Math.min(periodMs, periodEnd.getTime() - args.now.getTime()));
    const targetEnd = addCalendarMonths({
        from: args.now,
        months: args.targetMonths,
        dayOverflow: 'clamp'
    });
    const targetMs = targetEnd.getTime() - args.now.getTime();
    return Number(
        ceilRatio(
            BigInt(args.paidMinor) * BigInt(remainingMs) * BigInt(targetMs),
            BigInt(periodMs) * BigInt(args.targetMinor) * BigInt(DAY_MS)
        )
    );
}

async function requestPlanChange(args: {
    user: { sessionCookie: string };
    subscriptionId: string;
    billingOptionId: string;
}) {
    const response = await fetch(
        `${API_URL}/api/v1/protected/billing-subscription/${args.subscriptionId}/plan-change`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: args.user.sessionCookie },
            body: JSON.stringify({ billingOptionId: args.billingOptionId })
        }
    );
    equal(response.status, 200, 'TEST:2159 plan-change route returns HTTP 200.');
    return PlanChangeSchema.parse(await response.json()).data;
}

async function readEffectiveSet(user: { sessionCookie: string }) {
    const response = await fetch(EFFECTIVE_SET_URL, { headers: { cookie: user.sessionCookie } });
    equal(response.status, 200, 'TEST:2159 effective-set route returns HTTP 200.');
    return EffectiveSetSchema.parse(await response.json()).data;
}

function preapprovalPosts(world: FakeWorld) {
    return world.fakeServer
        .requests()
        .filter((request) => request.method === 'POST' && request.path === '/preapproval');
}

function putsTo(world: FakeWorld, authorizationId: string) {
    return world.fakeServer
        .requests()
        .filter(
            (request) =>
                request.method === 'PUT' && request.path === `/preapproval/${authorizationId}`
        );
}

function pick(values: Record<string, number | 'Infinity'>, keys: readonly string[]) {
    return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]));
}

test.describe('TEST:2159:1 TEST:2159:2 TEST:2159:3 TEST:2159:4 plan change credit, abandonment, complements and capabilities @p0 @billing @clock', () => {
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
                    {
                        lie: 'M1',
                        why: 'TEST:2159 asserts plan-change checkout and amount mutation.'
                    },
                    { lie: 'M6', why: 'TEST:2159 delivers authorization and payment webhooks.' },
                    { lie: 'M8', why: 'TEST:2159 needs an accurately credited starting cycle.' }
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
            equal(
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                }),
                [],
                'TEST:2159 cleanup leaves no sweep candidates.'
            );
        } finally {
            await world?.mailCapture.close().catch(() => undefined);
            world = null;
            providerNamespace = '';
            userIds = [];
        }
    });

    async function startCase(args: {
        page: Page;
        slug: 'owner-basico' | 'owner-premium';
    }): Promise<WorldCase> {
        if (!world) throw new Error('TEST:2159 setup: fake world missing.');
        const subscriber = await createSubscriber();
        userIds.push(subscriber.user.id, subscriber.admin.id);
        await seedCookieConsent(args.page);
        const current = await openActivePlanCase({
            page: args.page,
            world,
            user: subscriber.user,
            admin: subscriber.admin,
            slug: args.slug
        });
        return {
            ...subscriber,
            ...current,
            article: args.page.locator(`[data-subscription-id="${current.subscriptionId}"]`)
        };
    }

    test('upgrade checkout asks the target price with the value credit as first charge date; abandoning it keeps the old plan charging', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159:1 setup: fake world missing.');
        const targetOptionId = await annualOptionForSlug('owner-premium');
        const current = await startCase({ page, slug: 'owner-basico' });
        const [basic] = await execSQL<{
            amount: string;
            billing_option_id: string;
            next_charge_at: Date;
        }>(
            'SELECT bo.amount, s.billing_option_id, s.next_charge_at FROM subscription s JOIN billing_option bo ON bo.id = s.billing_option_id WHERE s.id = $1',
            [current.subscriptionId]
        );
        const [target] = await execSQL<{ amount: string }>(
            'SELECT amount FROM billing_option WHERE id = $1',
            [targetOptionId]
        );
        const [period] = await execSQL<{ period_start: Date; amount: string }>(
            'SELECT cp.period_start, p.amount FROM covered_period cp JOIN payment p ON p.id = cp.payment_id WHERE cp.subscription_id = $1 AND cp.released_at IS NULL ORDER BY cp.period_start DESC LIMIT 1',
            [current.subscriptionId]
        );
        if (!basic || !target || !period)
            throw new Error(
                'TEST:2159:1 setup: old option, target option or open covered period missing.'
            );
        differs(
            Number(target.amount),
            Number(basic.amount),
            'TEST:2159:1 precondition: the annual Premium price differs from the monthly Basico price.'
        );
        const bornAt = world.fakeServer.now();
        const postsBefore = preapprovalPosts(world).length;
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        equal(
            change.outcome,
            'SUCCESSION',
            'TEST:2159:1 upgrade to annual Premium opens a succession.'
        );
        if (change.outcome !== 'SUCCESSION')
            throw new Error('TEST:2159:1 plan change did not open a succession.');
        const expectedCredit = valueCreditDays({
            paidMinor: Number(period.amount),
            periodStart: period.period_start,
            now: bornAt,
            targetMinor: Number(target.amount),
            targetMonths: 12
        });
        const remainingDays = Math.ceil(
            (addCalendarMonths({
                from: period.period_start,
                months: 1,
                dayOverflow: 'clamp'
            }).getTime() -
                bornAt.getTime()) /
                DAY_MS
        );
        differs(
            expectedCredit,
            remainingDays,
            'TEST:2159:1 precondition: the value credit differs from the day credit with these prices.'
        );
        equal(
            change.creditDays,
            expectedCredit,
            'TEST:2159:1 response credit days follow the value formula (DEC-SUB-006 c).'
        );
        const [successor] = await execSQL<{
            status: string;
            succeeds_id: string;
            billing_option_id: string;
            first_charge_at: Date;
            authorization_window_ends_at: Date;
        }>(
            'SELECT status, succeeds_id, billing_option_id, first_charge_at, authorization_window_ends_at FROM subscription WHERE id = $1',
            [change.subscriptionId]
        );
        if (!successor) throw new Error('TEST:2159:1 successor row missing.');
        equal(
            {
                status: successor.status,
                succeeds_id: successor.succeeds_id,
                billing_option_id: successor.billing_option_id
            },
            {
                status: 'PENDING_AUTHORIZATION',
                succeeds_id: current.subscriptionId,
                billing_option_id: targetOptionId
            },
            'TEST:2159:1 successor waits for authorization on the target option, linked to the old row.'
        );
        const windowFirst = successor.authorization_window_ends_at.getTime() + DAY_MS;
        const creditFirst = bornAt.getTime() + expectedCredit * DAY_MS;
        expect(
            creditFirst,
            'TEST:2159:1 precondition: the credit term outweighs the window term.'
        ).toBeGreaterThan(windowFirst);
        const expectedFirst = new Date(Math.max(windowFirst, creditFirst));
        equal(
            successor.first_charge_at.toISOString(),
            new Date(change.firstChargeAt).toISOString(),
            'TEST:2159:1 persisted first charge equals the response first charge.'
        );
        equal(
            new Date(change.firstChargeAt).toISOString(),
            expectedFirst.toISOString(),
            'TEST:2159:1 first charge date is bornAt plus the value credit days.'
        );
        const posts = preapprovalPosts(world);
        equal(
            posts.length,
            postsBefore + 1,
            'TEST:2159:1 exactly one checkout preapproval is created.'
        );
        const body = CheckoutBodySchema.parse(posts.at(-1)?.body);
        equal(
            {
                amountMinor: Math.round(body.auto_recurring.transaction_amount * 100),
                startDate: new Date(body.auto_recurring.start_date).toISOString(),
                frequency: body.auto_recurring.frequency,
                frequencyType: body.auto_recurring.frequency_type
            },
            {
                amountMinor: Number(target.amount),
                startDate: expectedFirst.toISOString(),
                frequency: 12,
                frequencyType: 'months'
            },
            'TEST:2159:1 checkout asks the target amount from the credited date, every 12 months.'
        );

        await world.fakeServer.setClock({
            at: new Date(successor.authorization_window_ends_at.getTime() + 60_000)
        });
        const expired = await runCron({
            jobName: 'subscription-window-expiry',
            adminCookie: current.admin.sessionCookie
        });
        equal(expired.success, true, 'TEST:2159:2 subscription-window-expiry succeeds.');
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ status: string }>(
                            'SELECT status FROM subscription WHERE id = $1',
                            [change.subscriptionId]
                        )
                    )[0]?.status,
                {
                    message: 'TEST:2159:2 the abandoned successor reaches ABANDONED.',
                    timeout: 30_000
                }
            )
            .toBe('ABANDONED');
        const oldAuthorization = await world.fakeServer.provider.readAuthorization({
            authorizationId: current.authorizationId
        });
        equal(
            {
                status: oldAuthorization.snapshot.status,
                amountMinor: oldAuthorization.snapshot.amount?.amountMinor
            },
            { status: 'active', amountMinor: Number(basic.amount) },
            'TEST:2159:2 old authorization stays active at the old amount after the abandonment.'
        );
        await world.fakeServer.setClock({ at: new Date(basic.next_charge_at.getTime() + 60_000) });
        const chargeAt = world.fakeServer.now();
        await world.fakeServer.provider.charge({
            authorizationId: current.authorizationId,
            amount: oldAuthorization.snapshot.amount,
            reference: `hos2159-${randomUUID()}`
        });
        await deliverNotices({ fakeServer: world.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ count: string }>(
                            "SELECT count(*) FROM payment WHERE subscription_id = $1 AND status = 'SUCCEEDED'",
                            [current.subscriptionId]
                        )
                    )[0]?.count,
                {
                    message: 'TEST:2159:2 the old plan records its second successful charge.',
                    timeout: 30_000
                }
            )
            .toBe('2');
        const payments = await execSQL<{ amount: string; status: string }>(
            'SELECT amount, status FROM payment WHERE subscription_id = $1 ORDER BY created_at, id',
            [current.subscriptionId]
        );
        equal(
            payments.map((row) => ({ amount: Number(row.amount), status: row.status })),
            [
                { amount: Number(basic.amount), status: 'SUCCEEDED' },
                { amount: Number(basic.amount), status: 'SUCCEEDED' }
            ],
            'TEST:2159:2 old plan payments are two successful charges at the old amount.'
        );
        const periods = await execSQL<{ period_start: Date }>(
            'SELECT period_start FROM covered_period WHERE subscription_id = $1 AND released_at IS NULL ORDER BY period_start',
            [current.subscriptionId]
        );
        length(periods, 2, 'TEST:2159:2 the old plan has two open covered periods.');
        equal(
            periods[1]?.period_start.toISOString(),
            chargeAt.toISOString(),
            'TEST:2159:2 the second covered period starts at the charge instant.'
        );
        equal(
            (
                await execSQL<{ status: string }>('SELECT status FROM subscription WHERE id = $1', [
                    current.subscriptionId
                ])
            )[0]?.status,
            'ACTIVE',
            'TEST:2159:2 the old subscription stays ACTIVE.'
        );
        equal(
            Number(
                (
                    await execSQL<{ count: string }>(
                        'SELECT count(*) FROM succession_retained_payment WHERE subscription_id = $1',
                        [current.subscriptionId]
                    )
                )[0]?.count
            ),
            0,
            'TEST:2159:2 no old plan payment is retained for the abandoned succession.'
        );
        length(
            putsTo(world, current.authorizationId),
            0,
            'TEST:2159:2 the old authorization is never cancelled nor mutated.'
        );
    });

    test('completed upgrade moves the vertical subscription complements to the successor', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159:3 setup: fake world missing.');
        const targetOptionId = await monthlyOptionForSlug('owner-premium');
        const current = await startCase({ page, slug: 'owner-basico' });
        const complements = await seedTwoComplements({
            userId: current.user.id,
            vertical: 'accommodation',
            fakeServer: world.fakeServer
        });
        length(
            complements,
            2,
            'TEST:2159:3 precondition: two vertical subscription complements are seeded.'
        );
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        equal(
            change.outcome,
            'SUCCESSION',
            'TEST:2159:3 monthly upgrade to Premium opens a succession.'
        );
        if (change.outcome !== 'SUCCESSION')
            throw new Error('TEST:2159:3 plan change did not open a succession.');
        const ids = complements.map((item) => item.instanceId);
        const before = await execSQL<{
            id: string;
            target_id: string;
            status: string;
            complement_subscription_id: string;
        }>(
            'SELECT id, target_id, status, complement_subscription_id FROM addon_instance WHERE id = ANY($1::uuid[]) ORDER BY id',
            [ids]
        );
        equal(
            before.map((row) => ({ target_id: row.target_id, status: row.status })),
            ids.map(() => ({ target_id: current.subscriptionId, status: 'ACTIVE' })),
            'TEST:2159:3 opening the succession leaves both complements ACTIVE on the old subscription.'
        );
        const complementSubscriptionIds = before.map((row) => row.complement_subscription_id);
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: change.subscriptionId
        });
        const activated = await execSQL<{ target_id: string }>(
            'SELECT target_id FROM addon_instance WHERE id = ANY($1::uuid[]) ORDER BY id',
            [ids]
        );
        equal(
            activated.map((row) => row.target_id),
            ids.map(() => current.subscriptionId),
            'TEST:2159:3 authorizing the successor does not move the complements before the close.'
        );
        length(
            cancelRequestsFor({
                requests: world.fakeServer.requests(),
                authorizationId: current.authorizationId
            }),
            0,
            'TEST:2159:3 the old authorization is not cancelled before our mail goes out.'
        );
        const sent = await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: current.admin.sessionCookie
        });
        equal(sent.success, true, 'TEST:2159:3 email-outbox-sender succeeds.');
        const closed = await runCron({
            jobName: 'subscription-succession-reevaluation',
            adminCookie: current.admin.sessionCookie
        });
        equal(closed.success, true, 'TEST:2159:3 subscription-succession-reevaluation succeeds.');
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ status: string }>(
                            'SELECT status FROM subscription WHERE id = $1',
                            [current.subscriptionId]
                        )
                    )[0]?.status,
                { message: 'TEST:2159:3 the close cancels the old subscription.', timeout: 30_000 }
            )
            .toBe('CANCELLED');
        const successorStatus = (
            await execSQL<{ status: string }>('SELECT status FROM subscription WHERE id = $1', [
                change.subscriptionId
            ])
        )[0]?.status;
        equal(successorStatus, 'ACTIVE', 'TEST:2159:3 the successor is ACTIVE after the close.');
        const after = await execSQL<{
            id: string;
            target_id: string;
            status: string;
            complement_subscription_id: string;
        }>(
            'SELECT id, target_id, status, complement_subscription_id FROM addon_instance WHERE id = ANY($1::uuid[]) ORDER BY id',
            [ids]
        );
        equal(
            after.map((row) => ({
                id: row.id,
                target_id: row.target_id,
                status: row.status,
                complement_subscription_id: row.complement_subscription_id
            })),
            before.map((row) => ({
                id: row.id,
                target_id: change.subscriptionId,
                status: 'ACTIVE',
                complement_subscription_id: row.complement_subscription_id
            })),
            'TEST:2159:3 both complements point at the successor, ACTIVE, with their own complement subscription.'
        );
        equal(
            (
                await execSQL<{ status: string }>(
                    'SELECT status FROM subscription WHERE id = ANY($1::uuid[]) ORDER BY id',
                    [complementSubscriptionIds]
                )
            ).map((row) => row.status),
            ['ACTIVE', 'ACTIVE'],
            'TEST:2159:3 both complement subscriptions stay ACTIVE.'
        );
        for (const complement of complements)
            length(
                cancelRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: complement.authorizationId
                }),
                0,
                'TEST:2159:3 no complement authorization is cancelled.'
            );
        equal(
            (
                await execSQL<{ succeeded_by_id: string }>(
                    'SELECT succeeded_by_id FROM subscription WHERE id = $1',
                    [current.subscriptionId]
                )
            )[0]?.succeeded_by_id,
            change.subscriptionId,
            'TEST:2159:3 the old subscription records its successor.'
        );
    });

    test('downgrade keeps the old plan capabilities until next_charge_at and drops them when the scheduled change applies', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159:4 setup: fake world missing.');
        const targetOptionId = await monthlyOptionForSlug('owner-basico');
        const current = await startCase({ page, slug: 'owner-premium' });
        const [old] = await execSQL<{
            plan_version_id: string;
            billing_option_id: string;
            next_charge_at: Date;
        }>(
            'SELECT plan_version_id, billing_option_id, next_charge_at FROM subscription WHERE id = $1',
            [current.subscriptionId]
        );
        const [target] = await execSQL<{ plan_version_id: string }>(
            'SELECT plan_version_id FROM billing_option WHERE id = $1',
            [targetOptionId]
        );
        if (!old || !target)
            throw new Error('TEST:2159:4 setup: old subscription or target option missing.');
        const premiumLimits = await execSQL<{ key: string; value: number | 'Infinity' }>(
            'SELECT key, value FROM plan_version_limit WHERE plan_version_id = $1',
            [old.plan_version_id]
        );
        const basicLimits = await execSQL<{ key: string; value: number | 'Infinity' }>(
            'SELECT key, value FROM plan_version_limit WHERE plan_version_id = $1',
            [target.plan_version_id]
        );
        const premiumEntitlements = await execSQL<{ key: string; plan_quota: number | 'Infinity' }>(
            'SELECT key, plan_quota FROM plan_version_entitlement WHERE plan_version_id = $1',
            [old.plan_version_id]
        );
        const basicEntitlements = await execSQL<{ key: string; plan_quota: number | 'Infinity' }>(
            'SELECT key, plan_quota FROM plan_version_entitlement WHERE plan_version_id = $1',
            [target.plan_version_id]
        );
        const basicLimitMap = Object.fromEntries(basicLimits.map((row) => [row.key, row.value]));
        const premiumLimitMap = Object.fromEntries(
            premiumLimits.map((row) => [row.key, row.value])
        );
        const limitDiff = [
            ...new Set([...Object.keys(premiumLimitMap), ...Object.keys(basicLimitMap)])
        ].filter((key) => premiumLimitMap[key] !== basicLimitMap[key]);
        const basicEntitlementKeys = new Set(basicEntitlements.map((row) => row.key));
        const premiumOnly = premiumEntitlements
            .filter((row) => !basicEntitlementKeys.has(row.key))
            .map((row) => row.key);
        expect(
            limitDiff.length + premiumOnly.length,
            'TEST:2159:4 precondition: Premium and Basico differ in at least one capability.'
        ).toBeGreaterThan(0);
        const premiumExpected = Object.fromEntries(
            limitDiff
                .filter((key) => key in premiumLimitMap)
                .map((key) => [key, premiumLimitMap[key]])
        );
        const basicExpected = Object.fromEntries(
            limitDiff.filter((key) => key in basicLimitMap).map((key) => [key, basicLimitMap[key]])
        );
        const before = await readEffectiveSet(current.user);
        equal(
            pick(before.limits, limitDiff),
            premiumExpected,
            'TEST:2159:4 before the request the differing limits hold the Premium values.'
        );
        equal(
            premiumOnly.filter((key) => key in before.entitlements),
            premiumOnly,
            'TEST:2159:4 before the request every Premium-only entitlement is present.'
        );
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        equal(
            change.outcome,
            'DOWNGRADE',
            'TEST:2159:4 monthly Premium to monthly Basico is a scheduled downgrade.'
        );
        if (change.outcome !== 'DOWNGRADE')
            throw new Error('TEST:2159:4 plan change was not a downgrade.');
        equal(
            new Date(change.effectiveAt).toISOString(),
            old.next_charge_at.toISOString(),
            'TEST:2159:4 the downgrade takes effect at next_charge_at.'
        );
        const [queued] = await execSQL<{ plan_version_id: string; billing_option_id: string }>(
            'SELECT plan_version_id, billing_option_id FROM subscription WHERE id = $1',
            [current.subscriptionId]
        );
        equal(
            queued,
            {
                plan_version_id: old.plan_version_id,
                billing_option_id: old.billing_option_id
            },
            'TEST:2159:4 the request leaves the old plan version and option on the row.'
        );
        const afterRequest = await readEffectiveSet(current.user);
        equal(
            pick(afterRequest.limits, limitDiff),
            premiumExpected,
            'TEST:2159:4 right after the request the differing limits keep the Premium values.'
        );
        equal(
            premiumOnly.filter((key) => key in afterRequest.entitlements),
            premiumOnly,
            'TEST:2159:4 right after the request every Premium-only entitlement is kept.'
        );
        const effectiveAt = new Date(change.effectiveAt);
        await world.fakeServer.setClock({ at: new Date(effectiveAt.getTime() - 60_000) });
        const beforeDue = await runCron({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie
        });
        equal(
            beforeDue.success,
            true,
            'TEST:2159:4 subscription-scheduled-change succeeds one minute before the date.'
        );
        equal(
            Number(
                (
                    await execSQL<{ count: string }>(
                        'SELECT count(*) FROM subscription_scheduled_change WHERE subscription_id = $1',
                        [current.subscriptionId]
                    )
                )[0]?.count
            ),
            1,
            'TEST:2159:4 one minute before the date the change is still queued.'
        );
        const justBefore = await readEffectiveSet(current.user);
        equal(
            pick(justBefore.limits, limitDiff),
            premiumExpected,
            'TEST:2159:4 one minute before the date the differing limits keep the Premium values.'
        );
        equal(
            premiumOnly.filter((key) => key in justBefore.entitlements),
            premiumOnly,
            'TEST:2159:4 one minute before the date every Premium-only entitlement is kept.'
        );
        await world.fakeServer.setClock({ at: new Date(effectiveAt.getTime() + 60_000) });
        const due = await runCron({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie
        });
        equal(
            due.success,
            true,
            'TEST:2159:4 subscription-scheduled-change succeeds one minute after the date.'
        );
        equal(
            Number(
                (
                    await execSQL<{ count: string }>(
                        'SELECT count(*) FROM subscription_scheduled_change WHERE subscription_id = $1',
                        [current.subscriptionId]
                    )
                )[0]?.count
            ),
            0,
            'TEST:2159:4 the applied change empties the queue.'
        );
        const applied = await execSQL<{
            status: string;
            plan_version_id: string;
            billing_option_id: string;
        }>('SELECT status, plan_version_id, billing_option_id FROM subscription WHERE id = $1', [
            current.subscriptionId
        ]);
        equal(
            applied[0],
            {
                status: 'ACTIVE',
                plan_version_id: target.plan_version_id,
                billing_option_id: targetOptionId
            },
            'TEST:2159:4 the row moves to the Basico version and option and stays ACTIVE.'
        );
        const after = await readEffectiveSet(current.user);
        equal(
            pick(after.limits, limitDiff),
            basicExpected,
            'TEST:2159:4 after the date the differing limits hold the Basico values.'
        );
        equal(
            premiumOnly.filter((key) => key in after.entitlements),
            [],
            'TEST:2159:4 after the date no Premium-only entitlement remains.'
        );
    });
});
