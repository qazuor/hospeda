import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { courtesyGrants, eq, getDb, initializeDb } from '@repo/db';
import type { FakeProviderServer } from '@repo/payments/fake-server';
import { deferOrCloseCourtesy } from '../../../packages/service-core/src/services/billing/subscription/succession-close-writes.ts';
import { execSQL, getDbPool } from './db-helpers.ts';

/** Open the grant screen and surface an SSR failure before waiting for hydration. */
export async function openPermanentGrantsScreen(args: {
    readonly page: Page;
    readonly adminUrl: string;
    readonly userId: string;
}): Promise<void> {
    const response = await args.page.goto(
        `${args.adminUrl}/billing/permanent-grants?userId=${encodeURIComponent(args.userId)}`,
        { waitUntil: 'domcontentloaded' }
    );
    if (response && response.status() >= 500)
        throw new Error(`Admin SSR returned HTTP ${response.status()}:\n${await response.text()}`);
    await args.page.getByTestId('permanent-grants-screen').waitFor({ state: 'visible' });
    await args.page.getByTestId('permanent-grant-live').waitFor({ state: 'visible' });
}

/**
 * S9 has no writer reachable from this E2E without mounting a succession. This SQL
 * reproduces its observable writes in order: pause the provider preapproval,
 * attach a current courtesy grant, pause the subscription, and open a COURTESY pause.
 */
export async function seedCurrentCourtesy(args: {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly fakeServer: FakeProviderServer;
    readonly endsAt: Date;
}): Promise<void> {
    await args.fakeServer.provider.pause({ authorizationId: args.authorizationId });
    const [owner] = await execSQL<{ user_id: string }>(
        'SELECT user_id FROM subscription WHERE id = $1',
        [args.subscriptionId]
    );
    if (!owner) throw new Error('Expected subscription owner before S9 courtesy seed.');
    const [clock] = await execSQL<{ now: Date }>('SELECT NOW() AS now');
    if (!clock) throw new Error('Expected database time.');
    await execSQL(
        `INSERT INTO courtesy_grant
         (beneficiary_user_id, granted_by, subscription_id, months, starts_at, ends_at, reason, balance_months)
         VALUES ($1, $1, $2, 3, $3, $4, $5, NULL)`,
        [owner.user_id, args.subscriptionId, clock.now, args.endsAt, 'TEST:B13a:5 current courtesy']
    );
    await execSQL("UPDATE subscription SET status = 'PAUSED' WHERE id = $1", [args.subscriptionId]);
    await execSQL(
        `INSERT INTO subscription_pause
         (subscription_id, reason, requested_months, starts_at, expected_end_at, actual_end_at)
         VALUES ($1, 'COURTESY', 3, $2, $3, NULL)`,
        [args.subscriptionId, clock.now, args.endsAt]
    );
}

/** Convert a seeded current courtesy into its deferred S18 balance. */
export async function deferCurrentCourtesy(args: {
    readonly subscriptionId: string;
    readonly successorBillingOptionId: string;
}): Promise<{ readonly courtesyGrantId: string; readonly balanceMonths: number }> {
    initializeDb(getDbPool());
    const courtesy = await getDb().transaction(async (tx) => {
        const outcome = await deferOrCloseCourtesy({
            predecessorId: args.subscriptionId,
            successorBillingOptionId: args.successorBillingOptionId,
            now: new Date(),
            tx
        });
        if (outcome !== 'DEFERRED') throw new Error(`Expected deferred courtesy; got ${outcome}.`);
        const [row] = await tx
            .select({
                id: courtesyGrants.id,
                balanceMonths: courtesyGrants.balanceMonths,
                balanceClosedAt: courtesyGrants.balanceClosedAt
            })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, args.subscriptionId));
        if (!row || row.balanceMonths === null || row.balanceClosedAt !== null)
            throw new Error('Expected an open courtesy balance after S18 deferral.');
        return { courtesyGrantId: row.id, balanceMonths: row.balanceMonths };
    });
    return courtesy;
}

/** Seed the deferred balance explicitly required by TEST:B13a:5. */
export async function seedDeferredCourtesy(args: {
    readonly userId: string;
    readonly vertical: string;
    readonly balanceMonths: number;
}): Promise<string> {
    const [row] = await execSQL<{ id: string }>(
        `INSERT INTO courtesy_grant
         (beneficiary_user_id, granted_by, subscription_id, months, starts_at, ends_at, reason, balance_months)
         SELECT $1, $1, subscription.id, $3, NOW(), NOW() + ($3 * INTERVAL '1 month'),
                'TEST:B13a:5 deferred courtesy', $3
         FROM subscription WHERE user_id = $1 AND vertical = $2 AND class = 'PRINCIPAL'
         ORDER BY created_at DESC LIMIT 1 RETURNING id`,
        [args.userId, args.vertical, args.balanceMonths]
    );
    if (!row) throw new Error('Expected a principal subscription for deferred courtesy.');
    return row.id;
}

/**
 * No E2E purchase route creates complements (H-J). This SQL follows seedS20Addon:
 * live fake preapproval, ACTIVE COMPLEMENTO, provider link, compatible addon and
 * version/product, then an ACTIVE instance targeting the vertical subscription.
 */
export async function seedTwoComplements(args: {
    readonly userId: string;
    readonly vertical: string;
    readonly fakeServer: FakeProviderServer;
}): Promise<readonly { readonly authorizationId: string; readonly instanceId: string }[]> {
    const [principal] = await execSQL<{ id: string }>(
        `SELECT id FROM subscription WHERE user_id = $1 AND vertical = $2 AND class = 'PRINCIPAL'
         ORDER BY created_at DESC LIMIT 1`,
        [args.userId, args.vertical]
    );
    if (!principal) throw new Error('Expected principal subscription for complements.');
    const seeded: { authorizationId: string; instanceId: string }[] = [];
    for (let index = 0; index < 2; index++) {
        const { authorizationId } = await args.fakeServer.provider.authorize({
            reference: randomUUID(),
            amount: { amountMinor: 500000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'TEST:B13a:5 complement',
            returnUrl: 'https://example.test/return',
            payerEmail: `payer-${randomUUID()}@example.test`
        });
        await args.fakeServer.provider.approve({ authorizationId });
        const [complement] = await execSQL<{ id: string }>(
            `INSERT INTO subscription (user_id, vertical, payment_method, status, class)
             VALUES ($1, $2, 'CARD', 'ACTIVE', 'COMPLEMENTO') RETURNING id`,
            [args.userId, args.vertical]
        );
        if (!complement) throw new Error('Expected complement subscription.');
        await execSQL(
            `INSERT INTO provider_link (subscription_id, provider, provider_id)
             VALUES ($1, 'MERCADO_PAGO', $2)`,
            [complement.id, authorizationId]
        );
        const [addon] = await execSQL<{ id: string }>(
            `INSERT INTO addon (slug, name) VALUES ($1, $2) RETURNING id`,
            [
                `e2e-b13a-${args.userId.replaceAll('-', '')}-${randomUUID().slice(0, 8)}`,
                `E2E complement ${index + 1}`
            ]
        );
        if (!addon) throw new Error('Expected addon.');
        const [version] = await execSQL<{ id: string }>(
            `INSERT INTO addon_version (addon_id, validity, scope_type)
             VALUES ($1, 'WHILE_SUBSCRIPTION_ALIVE', 'VERTICAL_SUBSCRIPTION') RETURNING id`,
            [addon.id]
        );
        if (!version) throw new Error('Expected addon version.');
        const [product] = await execSQL<{ id: string }>(
            `INSERT INTO addon_product
             (addon_id, version_id, price, currency, charge_kind, cycle, compatible_verticals)
             VALUES ($1, $2, 5000, 'ARS', 'PERIODICO', 'monthly', ARRAY[$3]::varchar[])
             RETURNING id`,
            [addon.id, version.id, args.vertical]
        );
        if (!product) throw new Error('Expected addon product.');
        const [instance] = await execSQL<{ id: string }>(
            `INSERT INTO addon_instance
             (product_id, addon_version_id, owner_id, target_id, status, complement_subscription_id, starts_at)
             VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NOW()) RETURNING id`,
            [product.id, version.id, args.userId, principal.id, complement.id]
        );
        if (!instance) throw new Error('Expected addon instance.');
        seeded.push({ authorizationId, instanceId: instance.id });
    }
    return seeded;
}

/** Delete only rows belonging to these test users, in foreign-key order. */
export async function cleanupPermanentGrantE2eRows(args: {
    readonly userIds: readonly string[];
}): Promise<void> {
    if (args.userIds.length === 0) return;
    const ids = [args.userIds];
    const addonRows = await execSQL<{ id: string }>(
        `SELECT id FROM addon WHERE slug LIKE ANY($1::text[])`,
        [args.userIds.map((id) => `e2e-b13a-${id.replaceAll('-', '')}-%`)]
    );
    const addonIds = addonRows.map((row) => row.id);
    await execSQL(
        `DELETE FROM reconciliation_mark WHERE addon_instance_id IN
         (SELECT id FROM addon_instance WHERE owner_id = ANY($1::uuid[]))`,
        ids
    );
    await execSQL('DELETE FROM addon_instance WHERE owner_id = ANY($1::uuid[])', ids);
    await execSQL(
        `DELETE FROM reconciliation_mark WHERE subscription_id IN
         (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        ids
    );
    if (addonIds.length > 0) {
        await execSQL('DELETE FROM addon_product WHERE addon_id = ANY($1::uuid[])', [addonIds]);
        await execSQL('DELETE FROM addon_version WHERE addon_id = ANY($1::uuid[])', [addonIds]);
        await execSQL('DELETE FROM addon WHERE id = ANY($1::uuid[])', [addonIds]);
    }
    await execSQL('DELETE FROM courtesy_grant WHERE beneficiary_user_id = ANY($1::uuid[])', ids);
    await execSQL(
        `DELETE FROM subscription_pause WHERE subscription_id IN
         (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        ids
    );
    await execSQL(
        'DELETE FROM permanent_grant_vertical WHERE permanent_grant_id IN (SELECT id FROM permanent_grant WHERE beneficiary_user_id = ANY($1::uuid[]))',
        ids
    );
    await execSQL('DELETE FROM permanent_grant WHERE beneficiary_user_id = ANY($1::uuid[])', ids);
}
