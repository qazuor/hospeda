/**
 * Helpers for `billing-34-plan-change-credit-successor.spec.ts` (HOS-2159): the
 * plan-change and effective-set requests, the value-credit formula rewritten
 * independently of service-core, fake provider request filters and the SQL
 * readers the three tests assert against.
 */
import { expect, type Page } from '@playwright/test';
import { addCalendarMonths } from '@repo/utils';
import { z } from 'zod';
import {
    API_URL,
    cancelRequestsFor,
    createSubscriber,
    DAY_MS,
    type FakeWorld,
    runCron
} from '../../../fixtures/arrears-cycle.ts';
import { seedCookieConsent } from '../../../fixtures/browser-helpers.ts';
import { execSQL } from '../../../fixtures/db-helpers.ts';
import { openActivePlanCase } from '../../../fixtures/plan-change-e2e.ts';

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
const CapabilityValueSchema = z.union([z.number(), z.literal('Infinity')]);
const EffectiveSetSchema = z.object({
    data: z.object({
        entitlements: z.record(z.string(), CapabilityValueSchema),
        limits: z.record(z.string(), CapabilityValueSchema)
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

/** A capability value as the effective-set route serializes it. */
export type CapabilityValue = z.infer<typeof CapabilityValueSchema>;

/** The parsed `data` of the plan-change route response. */
export type PlanChangeResponse = z.infer<typeof PlanChangeSchema>['data'];

/** The parsed `data` of the effective-set route response. */
export type EffectiveSetResponse = z.infer<typeof EffectiveSetSchema>['data'];

/** A session-carrying user, as the fixtures create it. */
export type SessionUser = { readonly sessionCookie: string };

/** Asserts deep equality with a mandatory message. */
export function expectEqual(actual: unknown, expected: unknown, message: string): void {
    expect(actual, message).toEqual(expected);
}

/** Asserts an exact array length with a mandatory message. */
export function expectLength(actual: readonly unknown[], expected: number, message: string): void {
    expect(actual, message).toHaveLength(expected);
}

/** Asserts deep inequality with a mandatory message (used for preconditions). */
export function expectDiffers(actual: unknown, expected: unknown, message: string): void {
    expect(actual, message).not.toEqual(expected);
}

function ceilRatio(numerator: bigint, denominator: bigint): bigint {
    return (numerator + denominator - 1n) / denominator;
}

function monthlyPeriodEnd(periodStart: Date): Date {
    return addCalendarMonths({ from: periodStart, months: 1, dayOverflow: 'clamp' });
}

/**
 * DEC-SUB-006 (c), written again so the test can contradict
 * `computeSuccessorCreditDays`: the unused part of a MONTHLY payment, divided
 * by the daily price of the target cycle, rounded up to whole days.
 */
export function valueCreditDays(args: {
    readonly paidMinor: number;
    readonly periodStart: Date;
    readonly now: Date;
    readonly targetMinor: number;
    readonly targetMonths: number;
}): number {
    const periodEnd = monthlyPeriodEnd(args.periodStart);
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

/** The rejected alternative (b): the remaining days of a monthly period, rounded up. */
export function dayCreditDays(args: { readonly periodStart: Date; readonly now: Date }): number {
    return Math.ceil((monthlyPeriodEnd(args.periodStart).getTime() - args.now.getTime()) / DAY_MS);
}

/** POSTs the owner plan-change route with the session cookie; requires HTTP 200. */
export async function requestPlanChange(args: {
    readonly user: SessionUser;
    readonly subscriptionId: string;
    readonly billingOptionId: string;
}): Promise<PlanChangeResponse> {
    const response = await fetch(
        `${API_URL}/api/v1/protected/billing-subscription/${args.subscriptionId}/plan-change`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: args.user.sessionCookie },
            body: JSON.stringify({ billingOptionId: args.billingOptionId })
        }
    );
    expectEqual(response.status, 200, 'TEST:2159 plan-change route returns HTTP 200.');
    return PlanChangeSchema.parse(await response.json()).data;
}

/** GETs the session user's accommodation effective set; requires HTTP 200. */
export async function readEffectiveSet(user: SessionUser): Promise<EffectiveSetResponse> {
    const response = await fetch(EFFECTIVE_SET_URL, { headers: { cookie: user.sessionCookie } });
    expectEqual(response.status, 200, 'TEST:2159 effective-set route returns HTTP 200.');
    return EffectiveSetSchema.parse(await response.json()).data;
}

/** Every `POST /preapproval` the fake provider received. */
export function preapprovalPosts(world: FakeWorld) {
    return world.fakeServer
        .requests()
        .filter((request) => request.method === 'POST' && request.path === '/preapproval');
}

/** Every `PUT /preapproval/<id>` (cancellation or amount change) for one authorization. */
export function putsTo(world: FakeWorld, authorizationId: string) {
    return world.fakeServer
        .requests()
        .filter(
            (request) =>
                request.method === 'PUT' && request.path === `/preapproval/${authorizationId}`
        );
}

/** The entries of `values` whose key is listed and present. */
export function pickPresent(
    values: Readonly<Record<string, CapabilityValue>>,
    keys: readonly string[]
) {
    return Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]));
}

/** The billing anchor of one subscription row. */
export async function readSubscriptionAnchor(subscriptionId: string) {
    const [row] = await execSQL<{
        status: string;
        plan_version_id: string;
        billing_option_id: string;
        next_charge_at: Date;
    }>(
        'SELECT status, plan_version_id, billing_option_id, next_charge_at FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return row;
}

/** One subscription's status, `undefined` when the row is missing. */
export async function readSubscriptionStatus(subscriptionId: string) {
    const [row] = await execSQL<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return row?.status;
}

/** The statuses of several subscriptions, ordered by id. */
export async function readSubscriptionStatuses(subscriptionIds: readonly string[]) {
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM subscription WHERE id = ANY($1::uuid[]) ORDER BY id',
        [subscriptionIds]
    );
    return rows.map((row) => row.status);
}

/** The `succeeded_by_id` link of one subscription. */
export async function readSucceededById(subscriptionId: string) {
    const [row] = await execSQL<{ succeeded_by_id: string }>(
        'SELECT succeeded_by_id FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return row?.succeeded_by_id;
}

/** The successor columns TEST:2159:1 asserts. */
export async function readSuccessorRow(subscriptionId: string) {
    const [row] = await execSQL<{
        status: string;
        succeeds_id: string;
        billing_option_id: string;
        first_charge_at: Date;
        authorization_window_ends_at: Date;
    }>(
        'SELECT status, succeeds_id, billing_option_id, first_charge_at, authorization_window_ends_at FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return row;
}

/** One billing option's amount and plan version. */
export async function readBillingOption(billingOptionId: string) {
    const [row] = await execSQL<{ amount: string; plan_version_id: string }>(
        'SELECT amount, plan_version_id FROM billing_option WHERE id = $1',
        [billingOptionId]
    );
    return row;
}

/** The newest open covered period of a subscription with the amount its payment paid. */
export async function readOpenCoveredPeriod(subscriptionId: string) {
    const [row] = await execSQL<{ period_start: Date; amount: string }>(
        'SELECT cp.period_start, p.amount FROM covered_period cp JOIN payment p ON p.id = cp.payment_id WHERE cp.subscription_id = $1 AND cp.released_at IS NULL ORDER BY cp.period_start DESC LIMIT 1',
        [subscriptionId]
    );
    return row;
}

/** Every open covered period start of a subscription, oldest first. */
export async function readOpenCoveredPeriodStarts(subscriptionId: string) {
    return execSQL<{ period_start: Date }>(
        'SELECT period_start FROM covered_period WHERE subscription_id = $1 AND released_at IS NULL ORDER BY period_start',
        [subscriptionId]
    );
}

/** The raw count (as PostgreSQL returns it) of SUCCEEDED payments of a subscription. */
export async function countSucceededPayments(subscriptionId: string) {
    const [row] = await execSQL<{ count: string }>(
        "SELECT count(*) FROM payment WHERE subscription_id = $1 AND status = 'SUCCEEDED'",
        [subscriptionId]
    );
    return row?.count;
}

/** Every payment of a subscription as `{ amount, status }`, in creation order. */
export async function readPayments(subscriptionId: string) {
    const rows = await execSQL<{ amount: string; status: string }>(
        'SELECT amount, status FROM payment WHERE subscription_id = $1 ORDER BY created_at, id',
        [subscriptionId]
    );
    return rows.map((row) => ({ amount: Number(row.amount), status: row.status }));
}

/** How many payments of a subscription are retained for a succession (S19). */
export async function countRetainedPayments(subscriptionId: string) {
    const [row] = await execSQL<{ count: string }>(
        'SELECT count(*) FROM succession_retained_payment WHERE subscription_id = $1',
        [subscriptionId]
    );
    return Number(row?.count);
}

/** How many scheduled changes a subscription has queued. */
export async function countScheduledChanges(subscriptionId: string) {
    const [row] = await execSQL<{ count: string }>(
        'SELECT count(*) FROM subscription_scheduled_change WHERE subscription_id = $1',
        [subscriptionId]
    );
    return Number(row?.count);
}

/** The addon instances TEST:2159:3 follows, ordered by id. */
export async function readAddonInstances(instanceIds: readonly string[]) {
    return execSQL<{
        id: string;
        target_id: string;
        status: string;
        complement_subscription_id: string;
    }>(
        'SELECT id, target_id, status, complement_subscription_id FROM addon_instance WHERE id = ANY($1::uuid[]) ORDER BY id',
        [instanceIds]
    );
}

/**
 * The capabilities that differ between two plan versions, read from the
 * catalog at run time (I-3): limit keys whose value differs or exists on one
 * side only, the expected value of each on either side, and the entitlement
 * keys only the `from` version grants.
 */
export async function readCapabilityDiff(args: {
    readonly fromPlanVersionId: string;
    readonly toPlanVersionId: string;
}) {
    const limitsOf = async (planVersionId: string) =>
        Object.fromEntries(
            (
                await execSQL<{ key: string; value: number }>(
                    'SELECT key, value FROM plan_version_limit WHERE plan_version_id = $1',
                    [planVersionId]
                )
            ).map((row) => [row.key, row.value])
        );
    const entitlementKeysOf = async (planVersionId: string) =>
        (
            await execSQL<{ key: string }>(
                'SELECT key FROM plan_version_entitlement WHERE plan_version_id = $1',
                [planVersionId]
            )
        ).map((row) => row.key);
    const fromLimits = await limitsOf(args.fromPlanVersionId);
    const toLimits = await limitsOf(args.toPlanVersionId);
    const toEntitlements = new Set(await entitlementKeysOf(args.toPlanVersionId));
    const limitKeys = [...new Set([...Object.keys(fromLimits), ...Object.keys(toLimits)])].filter(
        (key) => fromLimits[key] !== toLimits[key]
    );
    const expectedOn = (limits: Record<string, number>) =>
        Object.fromEntries(
            limitKeys.filter((key) => key in limits).map((key) => [key, limits[key]])
        );
    return {
        limitKeys,
        fromLimits: expectedOn(fromLimits),
        toLimits: expectedOn(toLimits),
        fromOnlyEntitlements: (await entitlementKeysOf(args.fromPlanVersionId)).filter(
            (key) => !toEntitlements.has(key)
        )
    };
}

/** The capability diff `readCapabilityDiff` returns. */
export type CapabilityDiff = Awaited<ReturnType<typeof readCapabilityDiff>>;

/**
 * Projects an effective set onto a capability diff: the differing limits it
 * reports, and which of the `from`-only entitlements it still grants.
 */
export function capabilitiesOf(effective: EffectiveSetResponse, diff: CapabilityDiff) {
    return {
        limits: pickPresent(effective.limits, diff.limitKeys),
        fromOnlyEntitlements: diff.fromOnlyEntitlements.filter(
            (key) => key in effective.entitlements
        )
    };
}

/** Triggers an admin cron and asserts that its run succeeded. */
export async function expectCronSucceeds(args: {
    readonly jobName: string;
    readonly adminCookie: string;
    readonly message: string;
}): Promise<void> {
    const run = await runCron({ jobName: args.jobName, adminCookie: args.adminCookie });
    expectEqual(run.success, true, args.message);
}

/** Every cancellation the fake provider received for one authorization. */
export function cancelsTo(world: FakeWorld, authorizationId: string) {
    return cancelRequestsFor({ requests: world.fakeServer.requests(), authorizationId });
}

/**
 * What TEST:2159:1 reads before the upgrade: the old row's anchor, the old and
 * target billing options and the open covered period the credit comes from.
 */
export async function readUpgradeBaseline(args: {
    readonly subscriptionId: string;
    readonly targetOptionId: string;
}) {
    const anchor = await readSubscriptionAnchor(args.subscriptionId);
    const basic = anchor && (await readBillingOption(anchor.billing_option_id));
    const target = await readBillingOption(args.targetOptionId);
    const period = await readOpenCoveredPeriod(args.subscriptionId);
    if (!anchor || !basic || !target || !period)
        throw new Error(
            'TEST:2159:1 setup: old option, target option or open covered period missing.'
        );
    return { anchor, basic, target, period };
}

/**
 * Creates a subscriber with its admin, registers both ids for the spec's
 * cleanup and opens a paid, credited monthly principal on `slug` through the
 * web checkout (`openActivePlanCase`).
 */
export async function openPlanChangeCase(args: {
    readonly page: Page;
    readonly world: FakeWorld;
    readonly userIds: string[];
    readonly slug: 'owner-basico' | 'owner-premium';
}) {
    const subscriber = await createSubscriber();
    args.userIds.push(subscriber.user.id, subscriber.admin.id);
    await seedCookieConsent(args.page);
    const current = await openActivePlanCase({
        page: args.page,
        world: args.world,
        user: subscriber.user,
        admin: subscriber.admin,
        slug: args.slug
    });
    return { ...subscriber, ...current };
}

/** The status, plan version and billing option of one subscription row. */
export async function readPlanColumns(subscriptionId: string) {
    const [row] = await execSQL<{
        status: string;
        plan_version_id: string;
        billing_option_id: string;
    }>('SELECT status, plan_version_id, billing_option_id FROM subscription WHERE id = $1', [
        subscriptionId
    ]);
    return row;
}

/**
 * The terms a successor checkout asks for, read from the body of the fake
 * provider's `POST /preapproval`: amount in minor units, ISO first charge
 * date and recurrence.
 */
export function checkoutTermsOf(body: unknown) {
    const parsed = CheckoutBodySchema.parse(body);
    return {
        amountMinor: Math.round(parsed.auto_recurring.transaction_amount * 100),
        startDate: new Date(parsed.auto_recurring.start_date).toISOString(),
        frequency: parsed.auto_recurring.frequency,
        frequencyType: parsed.auto_recurring.frequency_type
    };
}
