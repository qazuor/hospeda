import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { CreatePlanRequestSchema, PublishPlanVersionRequestSchema } from '@repo/schemas';
import { z } from 'zod';
import type { CreatedUser } from '../../../fixtures/api-helpers.ts';
import {
    API_URL,
    activateCardSubscription,
    cleanupArrearsRows,
    createApiCardSubscription,
    type FakeWorld,
    recordCreditedCycle
} from '../../../fixtures/arrears-cycle.ts';
import { execSQL } from '../../../fixtures/db-helpers.ts';
import { cleanupPlanChangeCase } from '../../../fixtures/plan-change-e2e.ts';

const IdBody = z.object({ data: z.object({ id: z.string().uuid() }) });
const PROTECTED = `${API_URL}/api/v1/protected/billing-subscription`;
const START = `${API_URL}/api/v1/protected/billing/subscriptions`;

/**
 * Grace long enough that a renewal declined in the last cycle before the
 * migration date is still in grace when `S37` runs seven days before it.
 */
export const MIGRATION_GRACE_DAYS = 40;

/**
 * Create an action 18 plan whose first version allows a pause and carries a long
 * grace. `createMigrationPlan` (fixtures/plan-migration-flow.ts) publishes with
 * `allowsPause: false` and ten grace days, which rules out the paused and the
 * grace members of the cohort.
 */
export async function createPausableMigrationPlan(args: {
    readonly page: Page;
    readonly admin: CreatedUser;
    readonly label: string;
    readonly limitKey: string;
    readonly rank: number;
}): Promise<{ readonly planId: string; readonly versionId: string }> {
    const headers = { cookie: args.admin.sessionCookie };
    const plan = await args.page.request.post(`${API_URL}/api/v1/admin/plan-catalog/plans`, {
        headers,
        data: CreatePlanRequestSchema.parse({
            vertical: 'accommodation',
            slug: `migration-${args.label}-${randomUUID()}`,
            name: `Migration ${args.label}`,
            role: null
        })
    });
    expect(plan.ok(), await plan.text()).toBe(true);
    const planId = IdBody.parse(await plan.json()).data.id;
    const version = await args.page.request.post(
        `${API_URL}/api/v1/admin/plan-catalog/plans/${planId}/versions`,
        {
            headers,
            data: PublishPlanVersionRequestSchema.parse({
                rank: args.rank,
                sellable: true,
                trialDays: 0,
                graceDays: MIGRATION_GRACE_DAYS,
                allowsPause: true,
                inheritsTouristVip: false,
                entitlements: [],
                limits: [{ key: args.limitKey, value: 2 }],
                cycles: ['monthly'],
                confirmed: true
            })
        }
    );
    expect(version.ok(), await version.text()).toBe(true);
    return { planId, versionId: IdBody.parse(await version.json()).data.id };
}

/** A card subscription started through the protected API and the fake checkout. */
export interface CardCase {
    readonly subscriptionId: string;
    readonly authorizationId: string;
}

/**
 * Start a card subscription through `POST /protected/billing/subscriptions`;
 * when `activate`, approve it in the fake and credit its first cycle.
 * Without it the subscription stays `PENDING_AUTHORIZATION`.
 */
export async function startCardCase(args: {
    readonly world: FakeWorld;
    readonly user: CreatedUser;
    readonly billingOptionId: string;
    readonly activate: boolean;
}): Promise<CardCase> {
    const started = await createApiCardSubscription({
        user: args.user,
        billingOptionId: args.billingOptionId
    });
    if (!args.activate) return started;
    await activateCardSubscription({
        fakeServer: args.world.fakeServer,
        subscriptionId: started.subscriptionId
    });
    await recordCreditedCycle({ fakeServer: args.world.fakeServer, ...started });
    return started;
}

/**
 * Seed a manual payer the way `billing-18-manual-arrears-cycle.spec.ts` does
 * (there is no self-service manual signup), anchored to the retired version.
 * Its next charge is placed ON the cohort's application day, so `S37` reaches it
 * in the same seven-day window as the card payer.
 */
export async function seedManualPayer(args: {
    readonly user: CreatedUser;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly nextChargeAt: Date;
    readonly now: Date;
}): Promise<string> {
    const [row] = await execSQL<{ id: string }>(
        `WITH created AS (
            INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id, payment_method, status, class, next_charge_at)
            VALUES ($1, 'accommodation', $2, $3, 'MANUAL', 'ACTIVE', 'PRINCIPAL', $4)
            RETURNING id
         ), first_payment AS (
            INSERT INTO manual_payment (subscription_id, period_start, status, registered_by, registered_at)
            SELECT created.id, $5, 'REGISTERED', $1, $5 FROM created
            RETURNING id, subscription_id
         ), initial_coverage AS (
            INSERT INTO covered_period (subscription_id, period_start, manual_payment_id, credited_at)
            SELECT subscription_id, $5, id, $5 FROM first_payment
         )
         SELECT id FROM created`,
        [args.user.id, args.planVersionId, args.billingOptionId, args.nextChargeAt, args.now]
    );
    if (!row) throw new Error('Manual payer fixture inserted no subscription.');
    return row.id;
}

async function customerAct(args: {
    readonly user: CreatedUser;
    readonly url: string;
    readonly body: unknown;
}): Promise<unknown> {
    const response = await fetch(args.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: args.user.sessionCookie },
        body: JSON.stringify(args.body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${args.url} answered ${response.status}: ${text}`);
    return JSON.parse(text);
}

/** The owner changes plan (succession to the successor plan). */
export async function changePlan(args: {
    readonly user: CreatedUser;
    readonly subscriptionId: string;
    readonly billingOptionId: string;
}): Promise<unknown> {
    return customerAct({
        user: args.user,
        url: `${PROTECTED}/${args.subscriptionId}/plan-change`,
        body: {
            billingOptionId: args.billingOptionId,
            payerEmail: `mp-${randomUUID()}@example.test`
        }
    });
}

/** The owner cancels an active subscription (self-service, S11). */
export async function cancelOwn(args: {
    readonly user: CreatedUser;
    readonly subscriptionId: string;
}): Promise<unknown> {
    return customerAct({
        user: args.user,
        url: `${PROTECTED}/${args.subscriptionId}/cancellation`,
        body: {}
    });
}

/** The owner pauses a monthly card subscription (S8). */
export async function pauseOwn(args: {
    readonly user: CreatedUser;
    readonly subscriptionId: string;
    readonly months: number;
}): Promise<unknown> {
    return customerAct({
        user: args.user,
        url: `${PROTECTED}/${args.subscriptionId}/pause`,
        body: { months: args.months }
    });
}

/** The owner abandons a pending signup attempt; the row ends `ABANDONED`. */
export async function abandonPendingAttempt(args: {
    readonly user: CreatedUser;
    readonly subscriptionId: string;
}): Promise<unknown> {
    return customerAct({
        user: args.user,
        url: `${START}/${args.subscriptionId}/pending-attempt-cancellation`,
        body: {}
    });
}

const DetailRow = z.object({
    subscriptionId: z.string().uuid(),
    status: z.string(),
    outReason: z.string().nullable(),
    applicationDate: z.string().nullable()
});
const DetailBody = z.object({
    data: z.object({ id: z.string().uuid(), rows: z.array(DetailRow) })
});
/** One scope row as `GET /api/v1/admin/plan-migrations/{id}` returns it. */
export type MigrationDetailRow = z.infer<typeof DetailRow>;

/** Read the migration's scope rows through administrative action 17. */
export async function readMigrationRows(args: {
    readonly admin: CreatedUser;
    readonly migrationId: string;
}): Promise<ReadonlyMap<string, MigrationDetailRow>> {
    const response = await fetch(`${API_URL}/api/v1/admin/plan-migrations/${args.migrationId}`, {
        headers: { cookie: args.admin.sessionCookie }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Migration detail answered ${response.status}: ${text}`);
    const rows = DetailBody.parse(JSON.parse(text)).data.rows;
    return new Map(rows.map((row) => [row.subscriptionId, row]));
}

/** Remove this case's migration, manual and billing rows, then its users. */
export async function cleanupMigrationCase(args: {
    readonly userIds: readonly string[];
    readonly providerNamespace: string;
    readonly sourceVersionId: string;
}): Promise<void> {
    const { userIds } = args;
    if (userIds.length === 0) return;
    const ofUsers = 'SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])';
    // Scheduled changes reference the scope rows, so they go first.
    if (args.providerNamespace) await cleanupPlanChangeCase(args);
    await execSQL(`DELETE FROM plan_migration_subscription WHERE subscription_id IN (${ofUsers})`, [
        userIds
    ]);
    if (args.sourceVersionId) {
        await execSQL(
            `DELETE FROM plan_migration_subscription WHERE plan_migration_id IN (SELECT id FROM plan_migration WHERE source_plan_version_id = $1)`,
            [args.sourceVersionId]
        );
        await execSQL('DELETE FROM plan_migration WHERE source_plan_version_id = $1', [
            args.sourceVersionId
        ]);
    }
    await execSQL(`DELETE FROM reconciliation_mark WHERE subscription_id IN (${ofUsers})`, [
        userIds
    ]);
    const manual = `SELECT id FROM manual_payment WHERE subscription_id IN (${ofUsers})`;
    await execSQL(`DELETE FROM receipt WHERE manual_payment_id IN (${manual})`, [userIds]);
    await execSQL(`DELETE FROM covered_period WHERE manual_payment_id IN (${manual})`, [userIds]);
    await execSQL(`DELETE FROM manual_payment WHERE subscription_id IN (${ofUsers})`, [userIds]);
    await cleanupArrearsRows({ userIds });
}
