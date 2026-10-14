import { eq, providerLinks, subscriptionScheduledChanges, subscriptions } from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb, getServiceTestPool } from '../helpers.js';

/** Links a local row to a real but unapproved fake authorization for state TEST:B11:7. */
export async function attachPendingFakeAuthorization(input: {
    readonly subscriptionId: string;
    readonly fake: FakePaymentProvider;
}) {
    const authorization = await input.fake.authorize({
        reference: input.subscriptionId,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'state comparison pending authorization fixture',
        returnUrl: 'https://example.test/return',
        payerEmail: `pending-${crypto.randomUUID()}@example.test`
    });
    await getServiceTestDb().insert(providerLinks).values({
        subscriptionId: input.subscriptionId,
        provider: 'MERCADO_PAGO',
        providerId: authorization.authorizationId
    });
    return { providerId: authorization.authorizationId };
}

/** Creates a same-vertical destination with a distinct option for amount comparison TEST:B11:8(g). */
export async function seedDifferentScheduledAmount(input: {
    readonly subscriptionId: string;
    readonly effectiveAt: Date;
}) {
    const db = getServiceTestDb();
    const [anchor] = await db
        .select({ planVersionId: subscriptions.planVersionId })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
    if (!anchor?.planVersionId) throw new Error('Subscription has no anchored plan version');
    const currentVersion = await getServiceTestPool().query<{ plan_id: string; vertical: string }>(
        'SELECT plan_id, vertical FROM plan_version WHERE id = $1',
        [anchor.planVersionId]
    );
    const plan = currentVersion.rows[0];
    if (!plan) throw new Error('Anchored plan version was not found');
    const targetVersion = await getServiceTestPool().query<{ id: string }>(
        'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, true, false, 0, false) RETURNING id',
        [plan.plan_id, plan.vertical, Math.floor(Math.random() * 100000000) + 1]
    );
    const targetPlanVersionId = targetVersion.rows[0]?.id;
    if (!targetPlanVersionId) throw new Error('Could not create destination version');
    const targetOption = await getServiceTestPool().query<{ id: string }>(
        "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 350000, 'ARS') RETURNING id",
        [targetPlanVersionId]
    );
    const targetBillingOptionId = targetOption.rows[0]?.id;
    if (!targetBillingOptionId) throw new Error('Could not create destination option');
    const [change] = await db
        .insert(subscriptionScheduledChanges)
        .values({
            subscriptionId: input.subscriptionId,
            targetPlanVersionId,
            targetBillingOptionId,
            effectiveAt: input.effectiveAt
        })
        .returning();
    if (!change) throw new Error('Could not seed destination scheduled change');
    return { change, targetPlanVersionId, targetBillingOptionId };
}

/** Changes the anchored list price used by expected amount for an individual period case. */
export async function setExpectedPlanAmount(input: {
    readonly subscriptionId: string;
    readonly amountMinor: number;
}) {
    const [row] = await getServiceTestDb()
        .select({ billingOptionId: subscriptions.billingOptionId })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
    if (!row?.billingOptionId) throw new Error('Subscription has no anchored billing option');
    await getServiceTestPool().query('UPDATE billing_option SET amount = $1 WHERE id = $2', [
        input.amountMinor,
        row.billingOptionId
    ]);
}
