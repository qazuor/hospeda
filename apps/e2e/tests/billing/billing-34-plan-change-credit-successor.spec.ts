/**
 * Preconditions: the E2E catalog contains current owner-basico and owner-premium plan versions with
 * differing limits or entitlements; their monthly options and the owner-premium annual option are
 * inserted by the signup-checkout fixtures when missing. The API, web, PostgreSQL, Redis, fake
 * Mercado Pago and mail capture services are available.
 * Run through the PR e2e:p0 gate; this spec moves the shared API clock and runs serially.
 */
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    activateCardSubscription,
    cleanupArrearsRows,
    DAY_MS,
    deliverNotices,
    ensureDeadlineVersion,
    type FakeWorld
} from '../../fixtures/arrears-cycle.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { seedTwoComplements } from '../../fixtures/permanent-grant-flow.ts';
import { cleanupPlanChangeCase } from '../../fixtures/plan-change-e2e.ts';
import { annualOptionForSlug, monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';
import { describeSweepCandidates } from '../../fixtures/sweep-candidates.ts';
import {
    cancelsTo,
    capabilitiesOf,
    checkoutTermsOf,
    countRetainedPayments,
    countScheduledChanges,
    countSucceededPayments,
    dayCreditDays,
    expectCronSucceeds,
    expectDiffers,
    expectEqual,
    expectLength,
    openPlanChangeCase,
    preapprovalPosts,
    putsTo,
    readAddonInstances,
    readBillingOption,
    readCapabilityDiff,
    readEffectiveSet,
    readOpenCoveredPeriodStarts,
    readPayments,
    readPlanColumns,
    readSubscriptionAnchor,
    readSubscriptionStatus,
    readSubscriptionStatuses,
    readSucceededById,
    readSuccessorRow,
    readUpgradeBaseline,
    requestPlanChange,
    valueCreditDays
} from './helpers/plan-change-successor.ts';

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
                    { lie: 'M1', why: 'TEST:2159 asserts plan-change checkout and amounts.' },
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
            expectEqual(
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

    test('upgrade checkout asks the target price with the value credit as first charge date; abandoning it keeps the old plan charging', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159:1 setup: fake world missing.');
        const targetOptionId = await annualOptionForSlug('owner-premium');
        const current = await openPlanChangeCase({ page, world, userIds, slug: 'owner-basico' });
        const { anchor, basic, target, period } = await readUpgradeBaseline({
            subscriptionId: current.subscriptionId,
            targetOptionId
        });
        expectDiffers(
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
        expectEqual(
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
        expectDiffers(
            expectedCredit,
            dayCreditDays({ periodStart: period.period_start, now: bornAt }),
            'TEST:2159:1 precondition: the value credit differs from the day credit with these prices.'
        );
        expectEqual(
            change.creditDays,
            expectedCredit,
            'TEST:2159:1 response credit days follow the value formula (DEC-SUB-006 c).'
        );
        const successor = await readSuccessorRow(change.subscriptionId);
        if (!successor) throw new Error('TEST:2159:1 successor row missing.');
        expectEqual(
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
        expectEqual(
            successor.first_charge_at.toISOString(),
            new Date(change.firstChargeAt).toISOString(),
            'TEST:2159:1 persisted first charge equals the response first charge.'
        );
        expectEqual(
            new Date(change.firstChargeAt).toISOString(),
            expectedFirst.toISOString(),
            'TEST:2159:1 first charge date is bornAt plus the value credit days.'
        );
        const posts = preapprovalPosts(world);
        expectEqual(
            posts.length,
            postsBefore + 1,
            'TEST:2159:1 exactly one checkout preapproval is created.'
        );
        expectEqual(
            checkoutTermsOf(posts.at(-1)?.body),
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
        await expectCronSucceeds({
            jobName: 'subscription-window-expiry',
            adminCookie: current.admin.sessionCookie,
            message: 'TEST:2159:2 subscription-window-expiry succeeds.'
        });
        await expect
            .poll(() => readSubscriptionStatus(change.subscriptionId), {
                message: 'TEST:2159:2 the abandoned successor reaches ABANDONED.',
                timeout: 30_000
            })
            .toBe('ABANDONED');
        const oldAuthorization = await world.fakeServer.provider.readAuthorization({
            authorizationId: current.authorizationId
        });
        expectEqual(
            {
                status: oldAuthorization.snapshot.status,
                amountMinor: oldAuthorization.snapshot.amount?.amountMinor
            },
            { status: 'active', amountMinor: Number(basic.amount) },
            'TEST:2159:2 old authorization stays active at the old amount after the abandonment.'
        );
        await world.fakeServer.setClock({ at: new Date(anchor.next_charge_at.getTime() + 60_000) });
        const chargeAt = world.fakeServer.now();
        await world.fakeServer.provider.charge({
            authorizationId: current.authorizationId,
            amount: oldAuthorization.snapshot.amount,
            reference: `hos2159-${randomUUID()}`
        });
        await deliverNotices({ fakeServer: world.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
        await expect
            .poll(() => countSucceededPayments(current.subscriptionId), {
                message: 'TEST:2159:2 the old plan records its second successful charge.',
                timeout: 30_000
            })
            .toBe('2');
        expectEqual(
            await readPayments(current.subscriptionId),
            [
                { amount: Number(basic.amount), status: 'SUCCEEDED' },
                { amount: Number(basic.amount), status: 'SUCCEEDED' }
            ],
            'TEST:2159:2 old plan payments are two successful charges at the old amount.'
        );
        const periods = await readOpenCoveredPeriodStarts(current.subscriptionId);
        expectLength(periods, 2, 'TEST:2159:2 the old plan has two open covered periods.');
        expectEqual(
            periods[1]?.period_start.toISOString(),
            chargeAt.toISOString(),
            'TEST:2159:2 the second covered period starts at the charge instant.'
        );
        expectEqual(
            await readSubscriptionStatus(current.subscriptionId),
            'ACTIVE',
            'TEST:2159:2 the old subscription stays ACTIVE.'
        );
        expectEqual(
            await countRetainedPayments(current.subscriptionId),
            0,
            'TEST:2159:2 no old plan payment is retained for the abandoned succession.'
        );
        expectLength(
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
        const current = await openPlanChangeCase({ page, world, userIds, slug: 'owner-basico' });
        const complements = await seedTwoComplements({
            userId: current.user.id,
            vertical: 'accommodation',
            fakeServer: world.fakeServer
        });
        expectLength(
            complements,
            2,
            'TEST:2159:3 precondition: two vertical subscription complements are seeded.'
        );
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        expectEqual(
            change.outcome,
            'SUCCESSION',
            'TEST:2159:3 monthly upgrade to Premium opens a succession.'
        );
        if (change.outcome !== 'SUCCESSION')
            throw new Error('TEST:2159:3 plan change did not open a succession.');
        const ids = complements.map((item) => item.instanceId);
        const before = await readAddonInstances(ids);
        expectEqual(
            before.map((row) => ({ target_id: row.target_id, status: row.status })),
            ids.map(() => ({ target_id: current.subscriptionId, status: 'ACTIVE' })),
            'TEST:2159:3 opening the succession leaves both complements ACTIVE on the old subscription.'
        );
        const complementSubscriptionIds = before.map((row) => row.complement_subscription_id);
        await activateCardSubscription({
            fakeServer: world.fakeServer,
            subscriptionId: change.subscriptionId
        });
        expectEqual(
            (await readAddonInstances(ids)).map((row) => row.target_id),
            ids.map(() => current.subscriptionId),
            'TEST:2159:3 authorizing the successor does not move the complements before the close.'
        );
        expectLength(
            cancelsTo(world, current.authorizationId),
            0,
            'TEST:2159:3 the old authorization is not cancelled before our mail goes out.'
        );
        await expectCronSucceeds({
            jobName: 'email-outbox-sender',
            adminCookie: current.admin.sessionCookie,
            message: 'TEST:2159:3 email-outbox-sender succeeds.'
        });
        await expectCronSucceeds({
            jobName: 'subscription-succession-reevaluation',
            adminCookie: current.admin.sessionCookie,
            message: 'TEST:2159:3 subscription-succession-reevaluation succeeds.'
        });
        await expect
            .poll(() => readSubscriptionStatus(current.subscriptionId), {
                message: 'TEST:2159:3 the close cancels the old subscription.',
                timeout: 30_000
            })
            .toBe('CANCELLED');
        expectEqual(
            await readSubscriptionStatus(change.subscriptionId),
            'ACTIVE',
            'TEST:2159:3 the successor is ACTIVE after the close.'
        );
        expectEqual(
            await readAddonInstances(ids),
            before.map((row) => ({
                id: row.id,
                target_id: change.subscriptionId,
                status: 'ACTIVE',
                complement_subscription_id: row.complement_subscription_id
            })),
            'TEST:2159:3 both complements point at the successor, ACTIVE, with their own complement subscription.'
        );
        expectEqual(
            await readSubscriptionStatuses(complementSubscriptionIds),
            ['ACTIVE', 'ACTIVE'],
            'TEST:2159:3 both complement subscriptions stay ACTIVE.'
        );
        for (const complement of complements)
            expectLength(
                cancelsTo(world, complement.authorizationId),
                0,
                'TEST:2159:3 no complement authorization is cancelled.'
            );
        expectEqual(
            await readSucceededById(current.subscriptionId),
            change.subscriptionId,
            'TEST:2159:3 the old subscription records its successor.'
        );
    });

    test('downgrade keeps the old plan capabilities until next_charge_at and drops them when the scheduled change applies', async ({
        page
    }) => {
        if (!world) throw new Error('TEST:2159:4 setup: fake world missing.');
        const targetOptionId = await monthlyOptionForSlug('owner-basico');
        const current = await openPlanChangeCase({ page, world, userIds, slug: 'owner-premium' });
        const old = await readSubscriptionAnchor(current.subscriptionId);
        const target = await readBillingOption(targetOptionId);
        if (!old || !target)
            throw new Error('TEST:2159:4 setup: old subscription or target option missing.');
        const diff = await readCapabilityDiff({
            fromPlanVersionId: old.plan_version_id,
            toPlanVersionId: target.plan_version_id
        });
        expect(
            diff.limitKeys.length + diff.fromOnlyEntitlements.length,
            'TEST:2159:4 precondition: Premium and Basico differ in at least one capability.'
        ).toBeGreaterThan(0);
        const before = capabilitiesOf(await readEffectiveSet(current.user), diff);
        expectEqual(
            before.limits,
            diff.fromLimits,
            'TEST:2159:4 before the request the differing limits hold the Premium values.'
        );
        expectEqual(
            before.fromOnlyEntitlements,
            diff.fromOnlyEntitlements,
            'TEST:2159:4 before the request every Premium-only entitlement is present.'
        );
        const change = await requestPlanChange({
            user: current.user,
            subscriptionId: current.subscriptionId,
            billingOptionId: targetOptionId
        });
        expectEqual(
            change.outcome,
            'DOWNGRADE',
            'TEST:2159:4 monthly Premium to monthly Basico is a scheduled downgrade.'
        );
        if (change.outcome !== 'DOWNGRADE')
            throw new Error('TEST:2159:4 plan change was not a downgrade.');
        expectEqual(
            new Date(change.effectiveAt).toISOString(),
            old.next_charge_at.toISOString(),
            'TEST:2159:4 the downgrade takes effect at next_charge_at.'
        );
        const queued = await readPlanColumns(current.subscriptionId);
        expectEqual(
            {
                plan_version_id: queued?.plan_version_id,
                billing_option_id: queued?.billing_option_id
            },
            { plan_version_id: old.plan_version_id, billing_option_id: old.billing_option_id },
            'TEST:2159:4 the request leaves the old plan version and option on the row.'
        );
        const afterRequest = capabilitiesOf(await readEffectiveSet(current.user), diff);
        expectEqual(
            afterRequest.limits,
            diff.fromLimits,
            'TEST:2159:4 right after the request the differing limits keep the Premium values.'
        );
        expectEqual(
            afterRequest.fromOnlyEntitlements,
            diff.fromOnlyEntitlements,
            'TEST:2159:4 right after the request every Premium-only entitlement is kept.'
        );
        const effectiveAt = new Date(change.effectiveAt);
        await world.fakeServer.setClock({ at: new Date(effectiveAt.getTime() - 60_000) });
        await expectCronSucceeds({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie,
            message:
                'TEST:2159:4 subscription-scheduled-change succeeds one minute before the date.'
        });
        expectEqual(
            await countScheduledChanges(current.subscriptionId),
            1,
            'TEST:2159:4 one minute before the date the change is still queued.'
        );
        const justBefore = capabilitiesOf(await readEffectiveSet(current.user), diff);
        expectEqual(
            justBefore.limits,
            diff.fromLimits,
            'TEST:2159:4 one minute before the date the differing limits keep the Premium values.'
        );
        expectEqual(
            justBefore.fromOnlyEntitlements,
            diff.fromOnlyEntitlements,
            'TEST:2159:4 one minute before the date every Premium-only entitlement is kept.'
        );
        await world.fakeServer.setClock({ at: new Date(effectiveAt.getTime() + 60_000) });
        await expectCronSucceeds({
            jobName: 'subscription-scheduled-change',
            adminCookie: current.admin.sessionCookie,
            message: 'TEST:2159:4 subscription-scheduled-change succeeds one minute after the date.'
        });
        expectEqual(
            await countScheduledChanges(current.subscriptionId),
            0,
            'TEST:2159:4 the applied change empties the queue.'
        );
        expectEqual(
            await readPlanColumns(current.subscriptionId),
            {
                status: 'ACTIVE',
                plan_version_id: target.plan_version_id,
                billing_option_id: targetOptionId
            },
            'TEST:2159:4 the row moves to the Basico version and option and stays ACTIVE.'
        );
        const after = capabilitiesOf(await readEffectiveSet(current.user), diff);
        expectEqual(
            after.limits,
            diff.toLimits,
            'TEST:2159:4 after the date the differing limits hold the Basico values.'
        );
        expectEqual(
            after.fromOnlyEntitlements,
            [],
            'TEST:2159:4 after the date no Premium-only entitlement remains.'
        );
    });
});
