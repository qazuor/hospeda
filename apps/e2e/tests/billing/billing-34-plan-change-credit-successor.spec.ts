/**
 * Preconditions: the E2E catalog contains current owner-basico and owner-premium plans with monthly
 * options, and the API, web, PostgreSQL, Redis, fake Mercado Pago and mail capture services are available.
 * Run through the PR e2e:p0 gate; this spec moves the shared API clock and runs serially.
 */
import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
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
    FAKE_NOTICE_DELAY_MS,
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
    expect(response.status, 'TEST:2159 plan-change route returns HTTP 200.').toBe(200);
    return PlanChangeSchema.parse(await response.json()).data;
}

async function readEffectiveSet(user: { sessionCookie: string }) {
    const response = await fetch(EFFECTIVE_SET_URL, { headers: { cookie: user.sessionCookie } });
    expect(response.status, 'TEST:2159 effective-set route returns HTTP 200.').toBe(200);
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
            expect(
                await describeSweepCandidates({
                    includeUserIds: userIds,
                    includeProviderIds: providerIds
                }),
                'TEST:2159 cleanup leaves no sweep candidates.'
            ).toEqual([]);
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
        if (!world) throw new Error('TEST:2159 T1: fake world missing.');
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
            throw new Error('TEST:2159 T1 precondition: catalog and covered payment rows exist.');
        expect(
            Number(target.amount),
            'TEST:2159 T1 precondition: target annual price differs from current monthly price.'
        ).not.toBe(Number(basic.amount));
        const bornAt = world.fakeServer.now();
        const postsBefore = preapprovalPosts(world).length;
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        expect(change.outcome, 'TEST:2159 T1 takes successor checkout path.').toBe('SUCCESSION');
        if (change.outcome !== 'SUCCESSION') throw new Error('TEST:2159 T1 expected succession.');
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
        expect(
            expectedCredit,
            'TEST:2159 T1 precondition: value-based credit differs from calendar remaining days.'
        ).not.toBe(remainingDays);
        expect(change.creditDays, 'TEST:2159 T1 exact value-based credit days.').toBe(
            expectedCredit
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
        if (!successor) throw new Error('TEST:2159 T1 successor row exists.');
        expect(
            {
                status: successor.status,
                succeeds_id: successor.succeeds_id,
                billing_option_id: successor.billing_option_id
            },
            'TEST:2159 T1 pending successor links to predecessor and target option.'
        ).toEqual({
            status: 'PENDING_AUTHORIZATION',
            succeeds_id: current.subscriptionId,
            billing_option_id: targetOptionId
        });
        const windowFirst = successor.authorization_window_ends_at.getTime() + DAY_MS;
        const creditFirst = bornAt.getTime() + expectedCredit * DAY_MS;
        expect(
            creditFirst,
            'TEST:2159 T1 precondition: credit, not the authorization window, determines first charge.'
        ).toBeGreaterThan(windowFirst);
        const expectedFirst = new Date(Math.max(windowFirst, creditFirst));
        expect(
            successor.first_charge_at.toISOString(),
            'TEST:2159 T1 persisted first charge date matches response.'
        ).toBe(new Date(change.firstChargeAt).toISOString());
        expect(
            new Date(change.firstChargeAt).toISOString(),
            'TEST:2159 T1 first charge date is the exact value-credit date.'
        ).toBe(expectedFirst.toISOString());
        const posts = preapprovalPosts(world);
        expect(
            posts.length,
            'TEST:2159 T1 checkout creates exactly one provider preapproval.'
        ).toBe(postsBefore + 1);
        const body = CheckoutBodySchema.parse(posts.at(-1)?.body);
        expect(
            {
                amountMinor: Math.round(body.auto_recurring.transaction_amount * 100),
                startDate: new Date(body.auto_recurring.start_date).toISOString(),
                frequency: body.auto_recurring.frequency,
                frequencyType: body.auto_recurring.frequency_type
            },
            'TEST:2159 T1 provider checkout body carries target price, credited date and annual cadence.'
        ).toEqual({
            amountMinor: Number(target.amount),
            startDate: expectedFirst.toISOString(),
            frequency: 12,
            frequencyType: 'months'
        });

        await world.fakeServer.setClock({
            at: new Date(successor.authorization_window_ends_at.getTime() + 60_000)
        });
        const expired = await runCron({
            jobName: 'subscription-window-expiry',
            adminCookie: current.admin.sessionCookie
        });
        expect(expired.success, 'TEST:2159 T1 subscription-window-expiry succeeds.').toBe(true);
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ status: string }>(
                            'SELECT status FROM subscription WHERE id = $1',
                            [change.subscriptionId]
                        )
                    )[0]?.status,
                { timeout: 30_000 }
            )
            .toBe('ABANDONED');
        const oldAuthorization = await world.fakeServer.provider.readAuthorization({
            authorizationId: current.authorizationId
        });
        expect(
            {
                status: oldAuthorization.snapshot.status,
                amountMinor: oldAuthorization.snapshot.amount?.amountMinor
            },
            'TEST:2159 T2 abandonment leaves predecessor authorization active at old price.'
        ).toEqual({ status: 'active', amountMinor: Number(basic.amount) });
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
                { timeout: 30_000 }
            )
            .toBe('2');
        const payments = await execSQL<{ amount: string; status: string }>(
            'SELECT amount, status FROM payment WHERE subscription_id = $1 ORDER BY created_at, id',
            [current.subscriptionId]
        );
        expect(
            payments.map((row) => ({ amount: Number(row.amount), status: row.status })),
            'TEST:2159 T2 predecessor records both exact successful monthly charges.'
        ).toEqual([
            { amount: Number(basic.amount), status: 'SUCCEEDED' },
            { amount: Number(basic.amount), status: 'SUCCEEDED' }
        ]);
        const periods = await execSQL<{ period_start: Date }>(
            'SELECT period_start FROM covered_period WHERE subscription_id = $1 AND released_at IS NULL ORDER BY period_start',
            [current.subscriptionId]
        );
        expect(
            periods,
            'TEST:2159 T2 predecessor retains exactly two covered periods.'
        ).toHaveLength(2);
        expect(
            periods[1]?.period_start.toISOString(),
            'TEST:2159 T2 next covered period starts at the simulated charge instant.'
        ).toBe(chargeAt.toISOString());
        expect(
            (
                await execSQL<{ status: string }>('SELECT status FROM subscription WHERE id = $1', [
                    current.subscriptionId
                ])
            )[0]?.status,
            'TEST:2159 T2 predecessor remains ACTIVE.'
        ).toBe('ACTIVE');
        expect(
            Number(
                (
                    await execSQL<{ count: string }>(
                        'SELECT count(*) FROM succession_retained_payment WHERE subscription_id = $1',
                        [current.subscriptionId]
                    )
                )[0]?.count
            ),
            'TEST:2159 T2 abandonment retains no succession payment.'
        ).toBe(0);
        expect(
            putsTo(world, current.authorizationId),
            'TEST:2159 T2 predecessor authorization receives no amount mutation or cancellation.'
        ).toHaveLength(0);
        expect(
            putsTo(world, current.authorizationId),
            'TEST:2159 T2 predecessor authorization receives no mutation or cancellation.'
        ).toHaveLength(0);
    });

    test('completed upgrade moves the vertical subscription complements to the successor', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159 T3: fake world missing.');
        const targetOptionId = await monthlyOptionForSlug('owner-premium');
        const current = await startCase({ page, slug: 'owner-basico' });
        const complements = await seedTwoComplements({
            userId: current.user.id,
            vertical: 'accommodation',
            fakeServer: world.fakeServer
        });
        expect(
            complements,
            'TEST:2159 T3 precondition: two complement instances were seeded.'
        ).toHaveLength(2);
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        expect(change.outcome, 'TEST:2159 T3 upgrade enters succession.').toBe('SUCCESSION');
        if (change.outcome !== 'SUCCESSION') throw new Error('TEST:2159 T3 expected succession.');
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
        expect(
            before.map((row) => ({ target_id: row.target_id, status: row.status })),
            'TEST:2159 T3 opening succession leaves complements attached to predecessor.'
        ).toEqual(ids.map(() => ({ target_id: current.subscriptionId, status: 'ACTIVE' })));
        const complementSubscriptionIds = before.map((row) => row.complement_subscription_id);
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: change.subscriptionId
        });
        const activated = await execSQL<{ target_id: string }>(
            'SELECT target_id FROM addon_instance WHERE id = ANY($1::uuid[]) ORDER BY id',
            [ids]
        );
        expect(
            activated.map((row) => row.target_id),
            'TEST:2159 T3 authorization alone does not move complements before S18 email.'
        ).toEqual(ids.map(() => current.subscriptionId));
        expect(
            cancelRequestsFor({
                requests: world.fakeServer.requests(),
                authorizationId: current.authorizationId
            }),
            'TEST:2159 T3 predecessor is not cancelled before outbox delivery.'
        ).toHaveLength(0);
        const sent = await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: current.admin.sessionCookie
        });
        expect(sent.success, 'TEST:2159 T3 email outbox sender succeeds.').toBe(true);
        const closed = await runCron({
            jobName: 'subscription-succession-reevaluation',
            adminCookie: current.admin.sessionCookie
        });
        expect(closed.success, 'TEST:2159 T3 succession reevaluation succeeds.').toBe(true);
        await expect
            .poll(
                async () =>
                    (
                        await execSQL<{ status: string }>(
                            'SELECT status FROM subscription WHERE id = $1',
                            [current.subscriptionId]
                        )
                    )[0]?.status,
                { timeout: 30_000 }
            )
            .toBe('CANCELLED');
        const successorStatus = (
            await execSQL<{ status: string }>('SELECT status FROM subscription WHERE id = $1', [
                change.subscriptionId
            ])
        )[0]?.status;
        expect(successorStatus, 'TEST:2159 T3 authorized successor is ACTIVE after closure.').toBe(
            'ACTIVE'
        );
        const after = await execSQL<{
            id: string;
            target_id: string;
            status: string;
            complement_subscription_id: string;
        }>(
            'SELECT id, target_id, status, complement_subscription_id FROM addon_instance WHERE id = ANY($1::uuid[]) ORDER BY id',
            [ids]
        );
        expect(
            after.map((row) => ({
                id: row.id,
                target_id: row.target_id,
                status: row.status,
                complement_subscription_id: row.complement_subscription_id
            })),
            'TEST:2159 T3 S18 moves each active vertical complement and preserves its subscription link.'
        ).toEqual(
            before.map((row) => ({
                id: row.id,
                target_id: change.subscriptionId,
                status: 'ACTIVE',
                complement_subscription_id: row.complement_subscription_id
            }))
        );
        expect(
            (
                await execSQL<{ status: string }>(
                    'SELECT status FROM subscription WHERE id = ANY($1::uuid[]) ORDER BY id',
                    [complementSubscriptionIds]
                )
            ).map((row) => row.status),
            'TEST:2159 T3 complement subscriptions remain active.'
        ).toEqual(['ACTIVE', 'ACTIVE']);
        for (const complement of complements)
            expect(
                cancelRequestsFor({
                    requests: world.fakeServer.requests(),
                    authorizationId: complement.authorizationId
                }),
                'TEST:2159 T3 complement provider authorizations remain uncancelled.'
            ).toHaveLength(0);
        expect(
            (
                await execSQL<{ succeeded_by_id: string }>(
                    'SELECT succeeded_by_id FROM subscription WHERE id = $1',
                    [current.subscriptionId]
                )
            )[0]?.succeeded_by_id,
            'TEST:2159 T3 predecessor records exact successor id.'
        ).toBe(change.subscriptionId);
    });

    test('downgrade keeps the old plan capabilities until next_charge_at and drops them when the scheduled change applies', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159 T4: fake world missing.');
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
            throw new Error('TEST:2159 T4 precondition: source and target catalog rows exist.');
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
            'TEST:2159 T4 precondition: the catalog has capabilities that differ between Premium and Basic.'
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
        expect(
            pick(before.limits, limitDiff),
            'TEST:2159 T4 initial limits match Premium catalog values.'
        ).toEqual(premiumExpected);
        expect(
            premiumOnly.filter((key) => key in before.entitlements),
            'TEST:2159 T4 Premium-only entitlements are effective before request.'
        ).toEqual(premiumOnly);
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        expect(change.outcome, 'TEST:2159 T4 downgrade takes scheduled path.').toBe('DOWNGRADE');
        if (change.outcome !== 'DOWNGRADE') throw new Error('TEST:2159 T4 expected downgrade.');
        expect(
            new Date(change.effectiveAt).toISOString(),
            'TEST:2159 T4 downgrade date equals predecessor next_charge_at.'
        ).toBe(old.next_charge_at.toISOString());
        const [queued] = await execSQL<{ plan_version_id: string; billing_option_id: string }>(
            'SELECT plan_version_id, billing_option_id FROM subscription WHERE id = $1',
            [current.subscriptionId]
        );
        expect(
            queued,
            'TEST:2159 T4 subscription remains on old plan immediately after request.'
        ).toEqual({
            plan_version_id: old.plan_version_id,
            billing_option_id: old.billing_option_id
        });
        const afterRequest = await readEffectiveSet(current.user);
        expect(
            pick(afterRequest.limits, limitDiff),
            'TEST:2159 T4 Premium limits remain immediately after request.'
        ).toEqual(premiumExpected);
        expect(
            premiumOnly.filter((key) => key in afterRequest.entitlements),
            'TEST:2159 T4 Premium-only entitlements remain immediately after request.'
        ).toEqual(premiumOnly);
        const effectiveAt = new Date(change.effectiveAt);
        await world.fakeServer.setClock({ at: new Date(effectiveAt.getTime() - 60_000) });
        const beforeDue = await runCron({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie
        });
        expect(
            beforeDue.success,
            'TEST:2159 T4 scheduled-change cron succeeds before due time.'
        ).toBe(true);
        expect(
            Number(
                (
                    await execSQL<{ count: string }>(
                        'SELECT count(*) FROM subscription_scheduled_change WHERE subscription_id = $1',
                        [current.subscriptionId]
                    )
                )[0]?.count
            ),
            'TEST:2159 T4 queue remains before next_charge_at.'
        ).toBe(1);
        const justBefore = await readEffectiveSet(current.user);
        expect(
            pick(justBefore.limits, limitDiff),
            'TEST:2159 T4 Premium limits remain one minute before next_charge_at.'
        ).toEqual(premiumExpected);
        expect(
            premiumOnly.filter((key) => key in justBefore.entitlements),
            'TEST:2159 T4 Premium-only entitlements remain one minute before next_charge_at.'
        ).toEqual(premiumOnly);
        await world.fakeServer.setClock({ at: new Date(effectiveAt.getTime() + 60_000) });
        const due = await runCron({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie
        });
        expect(due.success, 'TEST:2159 T4 scheduled-change cron succeeds after due time.').toBe(
            true
        );
        expect(
            Number(
                (
                    await execSQL<{ count: string }>(
                        'SELECT count(*) FROM subscription_scheduled_change WHERE subscription_id = $1',
                        [current.subscriptionId]
                    )
                )[0]?.count
            ),
            'TEST:2159 T4 queue is empty after scheduled change applies.'
        ).toBe(0);
        const applied = await execSQL<{
            status: string;
            plan_version_id: string;
            billing_option_id: string;
        }>('SELECT status, plan_version_id, billing_option_id FROM subscription WHERE id = $1', [
            current.subscriptionId
        ]);
        expect(
            applied[0],
            'TEST:2159 T4 subscription now uses exact Basic plan and option.'
        ).toEqual({
            status: 'ACTIVE',
            plan_version_id: target.plan_version_id,
            billing_option_id: targetOptionId
        });
        const after = await readEffectiveSet(current.user);
        expect(
            pick(after.limits, limitDiff),
            'TEST:2159 T4 differing limits now match Basic catalog values.'
        ).toEqual(basicExpected);
        expect(
            premiumOnly.filter((key) => key in after.entitlements),
            'TEST:2159 T4 Premium-only entitlements are absent after scheduled change.'
        ).toEqual([]);
    });
});
