import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import {
    emailOutbox,
    eq,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    planVersions,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { expect } from 'vitest';
import { launchPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import {
    PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from '../../../../src/services/billing/plan-migration/plan-migration-notice.js';
import { previewPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { runPlanMigrationS37ForRow } from '../../../../src/services/billing/plan-migration/plan-migration-s37.service.js';
import { applyPlanMigrationUpcomingNotice } from '../../../../src/services/billing/plan-migration/plan-migration-upcoming-notice.js';
import { canPause } from '../../../../src/services/billing/subscription/pause-policy.js';
import { pauseSubscription } from '../../../../src/services/billing/subscription/pause-subscription.service.js';
import { resumeSubscription } from '../../../../src/services/billing/subscription/resume-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';
import { adjustablePauseHarness, pausePlanPolicy, seedPausePrincipal } from './pause-fixtures.js';
import { insertMigrationVersion, setMigrationTargetCycle } from './plan-migration-fixtures.js';
import {
    INCREASE_CURRENT_AMOUNT_MINOR,
    localDayInstant,
    S37_INCREASE_TARGET_AMOUNT_MINOR
} from './plan-migration-increase-fixtures.js';

const db = getServiceTestDb();
const ANNOUNCED_AT = new Date('2026-10-11T13:00:00.000Z');
const ANNOUNCED_DAY = '2026-10-11';
/** The application day the increase is announced with, from the seeded next charge. */
const STORED_APPLICATION_DAY = '2026-12-15';
/** Seven local days before the stored application day. */
const PAUSED_DAY = '2026-12-08';
/** The first resumed charge after the 60-day notice has already elapsed. */
const RESUMED_CHARGE_AFTER_NOTICE = '2027-01-15';
/** The resumed charge still inside the 60-day notice. */
const RESUMED_CHARGE_BEFORE_NOTICE = '2026-12-05';
/** One monthly cycle after {@link RESUMED_CHARGE_BEFORE_NOTICE}. */
const DEFERRED_APPLICATION_DAY = '2027-01-05';

const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};

/** A real price increase launched over a card principal S8 can pause. */
export interface PausedIncreaseCase {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly targetPlanVersionId: string;
    readonly targetOptionId: string;
    readonly targetAmountMinor: number;
    readonly currentAmountMinor: number;
    readonly migrationId: string;
    readonly scope: typeof planMigrationSubscriptions.$inferSelect;
    readonly applicationDate: string;
    readonly authorizationId: string;
    readonly harness: ReturnType<typeof adjustablePauseHarness>;
}

const pausedCases: Array<{
    readonly migrationId: string;
    readonly subscriptionId: string;
    readonly userId: string;
    readonly adminId: string;
}> = [];

/**
 * Launches a real price-increase migration over a card principal seeded by
 * `seedPausePrincipal`, so S8 can pause it and S10 must honour the increase.
 *
 * The customer and its fake authorization come from the pause fixture; the new
 * sellable version of the SAME plan, its literal target price and the migration
 * come from `insertMigrationVersion` + action 19 + `previewPlanMigration` +
 * `launchPlanMigration` with `reason: 'PRICE_INCREASE'`.
 *
 * Two states are seeded because no service starts them here: the next charge is
 * moved to the value the case declares (a real renewal would have advanced it)
 * and the admin is inserted directly, as the other migration fixtures do.
 */
export async function createPausedIncreaseCase(options: {
    readonly nextChargeAt: Date;
}): Promise<PausedIncreaseCase> {
    const harness = adjustablePauseHarness();
    const principal = await seedPausePrincipal({ harness });
    await db
        .update(subscriptions)
        .set({ nextChargeAt: options.nextChargeAt, paymentMethod: 'CARD' })
        .where(eq(subscriptions.id, principal.subscriptionId));
    const [source] = await db
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, principal.planVersionId));
    if (!source) throw new Error('Paused increase source version missing');
    const [admin] = await db
        .insert(users)
        .values({
            email: `paused-increase-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Paused price increase admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!admin) throw new Error('Paused increase admin fixture missing');
    const actor = {
        id: admin.id,
        roles: [],
        permissions: [
            PermissionEnum.BILLING_MIGRATE_PLAN,
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.BILLING_SET_CYCLE_PRICE
        ]
    };
    const target = await insertMigrationVersion({
        planId: source.planId,
        previousVersionId: principal.planVersionId,
        rank: source.rank + 1,
        sellable: true,
        graceDays: source.graceDays,
        allowsPause: source.allowsPause
    });
    const priced = await setMigrationTargetCycle({
        actor,
        planVersionId: target.id,
        cycle: 'monthly',
        amount: S37_INCREASE_TARGET_AMOUNT_MINOR
    });
    const clock = { now: () => ANNOUNCED_AT };
    const verticals = new VerticalsForBillingSimulator({ clock });
    verticals.setPlanPolicy({
        planVersionId: target.id,
        policy: {
            graceDays: target.graceDays,
            allowsPause: target.allowsPause,
            current: true,
            sellable: true
        }
    });
    verticals.setPlanPolicy({
        planVersionId: principal.planVersionId,
        policy: {
            graceDays: source.graceDays,
            allowsPause: source.allowsPause,
            current: false,
            sellable: true
        }
    });
    const input = {
        sourcePlanVersionId: principal.planVersionId,
        targetPlanVersionId: target.id,
        reason: 'PRICE_INCREASE' as const
    };
    const preview = await previewPlanMigration({ actor, input, verticals, clock });
    const launched = await launchPlanMigration({
        actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals,
        clock
    });
    const [scope] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
    if (!scope) throw new Error('Paused increase scope missing');
    pausedCases.push({
        migrationId: launched.planMigrationId,
        subscriptionId: principal.subscriptionId,
        userId: principal.userId,
        adminId: admin.id
    });
    return {
        subscriptionId: principal.subscriptionId,
        userId: principal.userId,
        targetPlanVersionId: target.id,
        targetOptionId: priced.billingOption.id,
        targetAmountMinor: S37_INCREASE_TARGET_AMOUNT_MINOR,
        currentAmountMinor: INCREASE_CURRENT_AMOUNT_MINOR,
        migrationId: launched.planMigrationId,
        scope,
        applicationDate: getLocalDateString({ instant: scope.applicationDate }),
        authorizationId: principal.authorizationId,
        harness
    };
}

/** Removes only the rows a paused increase case created; the catalog stays put. */
export async function cleanupPausedIncreaseCases(): Promise<void> {
    const own = pausedCases.splice(0);
    if (own.length === 0) return;
    const userIds = own.map((entry) => entry.userId);
    const subscriptionIds = own.map((entry) => entry.subscriptionId);
    const migrationIds = own.map((entry) => entry.migrationId);
    await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
    await db
        .delete(subscriptionScheduledChanges)
        .where(inArray(subscriptionScheduledChanges.subscriptionId, subscriptionIds));
    await db
        .delete(planMigrationSubscriptions)
        .where(inArray(planMigrationSubscriptions.planMigrationId, migrationIds));
    await db.delete(planMigrations).where(inArray(planMigrations.id, migrationIds));
    await db.delete(users).where(
        inArray(
            users.id,
            own.map((entry) => entry.adminId)
        )
    );
}

export function announceKey(caseRow: PausedIncreaseCase): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_ANNOUNCED_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone: 'mig:announce',
        targetDate: ANNOUNCED_DAY
    });
}

export function upcomingKey(
    caseRow: PausedIncreaseCase,
    targetDay: string,
    milestone = 'mig:-7d'
): string {
    return planMigrationNoticeDedupKey({
        recipientUserId: caseRow.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: caseRow.scope.id,
        milestone,
        targetDate: targetDay
    });
}

export async function outboxKeys(caseRow: PausedIncreaseCase): Promise<string[]> {
    const rows = await db
        .select({ dedupKey: emailOutbox.dedupKey })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, caseRow.userId));
    return rows.map((row) => row.dedupKey).sort();
}

export async function markNoticeSent(
    caseRow: PausedIncreaseCase,
    targetDay: string
): Promise<void> {
    await db
        .update(emailOutbox)
        .set({ status: 'sent' })
        .where(eq(emailOutbox.dedupKey, upcomingKey(caseRow, targetDay)));
}

export function runS37(caseRow: PausedIncreaseCase) {
    return runPlanMigrationS37ForRow(
        { planMigrationSubscriptionId: caseRow.scope.id, correlationId: crypto.randomUUID() },
        { provider: caseRow.harness.provider, clock: caseRow.harness.clock }
    );
}

export function notify(caseRow: PausedIncreaseCase) {
    return db.transaction((tx) =>
        applyPlanMigrationUpcomingNotice({
            tx,
            planMigrationSubscriptionId: caseRow.scope.id,
            now: caseRow.harness.clock.now()
        })
    );
}

export async function scopeRow(caseRow: PausedIncreaseCase) {
    const [row] = await db
        .select({
            status: planMigrationSubscriptions.status,
            applicationDate: planMigrationSubscriptions.applicationDate,
            appliedAt: planMigrationSubscriptions.appliedAt
        })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, caseRow.scope.id));
    return row;
}

export async function queueRows(caseRow: PausedIncreaseCase) {
    return db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, caseRow.subscriptionId));
}

export async function pauseCase(caseRow: PausedIncreaseCase): Promise<void> {
    caseRow.harness.clock.set({ at: localDayInstant('2026-10-14') });
    const allowed = await canPause(
        { subscriptionId: caseRow.subscriptionId, requestedMonths: 2 },
        { clock: caseRow.harness.clock, planPolicy: pausePlanPolicy() }
    );
    expect(allowed.allowed).toBe(true);
    const paused = await pauseSubscription(
        { subscriptionId: caseRow.subscriptionId, requestedMonths: 2 },
        {
            provider: caseRow.harness.provider,
            clock: caseRow.harness.clock,
            planPolicy: pausePlanPolicy(),
            complements
        }
    );
    expect(paused.outcome).toBe('PAUSED');
}

export async function resumeCase(
    caseRow: PausedIncreaseCase,
    input: { readonly at: string; readonly chargeAt: string }
) {
    caseRow.harness.fake.moveNextCharge({
        authorizationId: caseRow.authorizationId,
        at: localDayInstant(input.chargeAt)
    });
    caseRow.harness.clock.set({ at: localDayInstant(input.at) });
    const result = await resumeSubscription(
        { subscriptionId: caseRow.subscriptionId, cause: 'EARLY' },
        { provider: caseRow.harness.provider, clock: caseRow.harness.clock, complements }
    );
    expect(result.outcome).toBe('RESUMED');
    if (result.outcome !== 'RESUMED') throw new Error('S10 failed');
    return result;
}

export {
    ANNOUNCED_AT,
    ANNOUNCED_DAY,
    DEFERRED_APPLICATION_DAY,
    PAUSED_DAY,
    RESUMED_CHARGE_AFTER_NOTICE,
    RESUMED_CHARGE_BEFORE_NOTICE,
    STORED_APPLICATION_DAY
};
