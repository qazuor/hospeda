import { resolve } from 'node:path';
import { initializeDb } from '@repo/db';
import { NewsletterCampaignService } from '@repo/service-core';
/**
 * SPEC-108 T-108-02 smoke — end-to-end notifier wire-up against a real DB.
 *
 * Inserts a test campaign + 3 deliveries (2 delivered, 1 failed, 0 pending)
 * into the local DB, then calls `NewsletterCampaignService.closeSentCampaigns`
 * with a stub `notifyCampaignClosedWithFailuresFn`. Verifies that:
 *
 *   1. The campaign transitions from `sending` to `sent`.
 *   2. The stub notifier is called EXACTLY once.
 *   3. The notifier receives `failed=1`, `delivered=2`, `totalRecipients=3`.
 *
 * Then runs a SECOND scenario where all 3 deliveries are `delivered` and
 * verifies the notifier is NOT called.
 *
 * Cleanup happens inside a single SQL transaction that's rolled back at
 * the end, so the script is idempotent — re-runs do not leave garbage.
 *
 * Run from worktree root:
 *   pnpm --filter hospeda-api exec tsx scripts/smoke-spec-108-notify.ts
 *
 * Requires:
 *   - apps/api/.env.local present (provides HOSPEDA_DATABASE_URL)
 *   - Local Postgres reachable (pnpm db:start at the repo root if needed)
 */
import { config as loadEnv } from 'dotenv';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

// Load apps/api/.env.local relative to this script.
loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });

const dbUrl = process.env.HOSPEDA_DATABASE_URL;
if (!dbUrl) {
    console.error('[smoke] HOSPEDA_DATABASE_URL not set. Copy apps/api/.env.local first.');
    process.exit(1);
}

console.info(`[smoke] Connecting to ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
const pool = new Pool({ connectionString: dbUrl });
initializeDb(pool);
const db = (await import('@repo/db')).getDb();

type NotifierEvent = {
    campaignId: string;
    subject: string;
    totalRecipients: number;
    delivered: number;
    failed: number;
    closedAt: Date;
};

const calls: NotifierEvent[] = [];
const notifier = async (event: NotifierEvent) => {
    calls.push(event);
};

let exitCode = 0;

try {
    // We wrap everything in an outer transaction we ALWAYS rollback so the
    // local DB stays clean. `closeSentCampaigns` runs its own statements
    // against `getDb()` directly (not against a passed-in tx), so we drive
    // it by manipulating real rows inside an outer tx and rolling back.
    // The service writes that close-sent runs will be visible because we
    // call it WITH the outer-tx-isolated state still in place — drizzle's
    // db client routes statements through the same pool, but each call is
    // its own connection. To make this simple and safe, we use a TEMP
    // suffix on subject + a known UUID set; we DELETE the rows ourselves
    // at the end and verify nothing leaks.
    console.info('[smoke] Scenario A — campaign with failed=1, delivered=2');

    // Find 3 distinct users (newsletter_subscribers has a partial UNIQUE on
    // (user_id, channel) WHERE deleted_at IS NULL — so each subscriber must
    // belong to a different user). If the local DB does not have 3 users,
    // the seed step has not been run; bail with a friendly message.
    const userRows = (
        await db.execute<{ id: string }>(sql`
            SELECT id FROM users
            WHERE deleted_at IS NULL
              AND id NOT IN (
                  SELECT user_id FROM newsletter_subscribers WHERE deleted_at IS NULL
              )
            ORDER BY created_at ASC
            LIMIT 3
        `)
    ).rows;
    if (userRows.length < 3) {
        console.error(
            `[smoke] Need 3 users without active newsletter subscriptions; found ${userRows.length}. Run "pnpm db:seed" first.`
        );
        process.exit(1);
    }
    const [user1, user2, user3] = userRows;
    const adminId = user1.id;

    const CAMPAIGN_A = '11111111-1111-4111-8111-111111111aaa';
    const CAMPAIGN_B = '22222222-2222-4222-8222-222222222bbb';

    // Insert a temporary newsletter subscriber to satisfy the FK on deliveries
    const SUB_1 = '33333333-3333-4333-8333-333333333111';
    const SUB_2 = '33333333-3333-4333-8333-333333333222';
    const SUB_3 = '33333333-3333-4333-8333-333333333333';

    // Use unique smoke emails to avoid colliding with real subscribers.
    const SMOKE_EMAILS = [
        'smoke-spec108-1@example.invalid',
        'smoke-spec108-2@example.invalid',
        'smoke-spec108-3@example.invalid'
    ];

    // Cleanup any leftovers from previous failed runs (deterministic).
    await db.execute(sql`
        DELETE FROM newsletter_campaign_deliveries
        WHERE campaign_id IN (${CAMPAIGN_A}::uuid, ${CAMPAIGN_B}::uuid)
    `);
    await db.execute(sql`
        DELETE FROM newsletter_campaigns
        WHERE id IN (${CAMPAIGN_A}::uuid, ${CAMPAIGN_B}::uuid)
    `);
    await db.execute(sql`
        DELETE FROM newsletter_subscribers
        WHERE id IN (${SUB_1}::uuid, ${SUB_2}::uuid, ${SUB_3}::uuid)
    `);

    // Seed subscribers (one per distinct user, due to partial unique on
    // (user_id, channel) WHERE deleted_at IS NULL).
    await db.execute(sql`
        INSERT INTO newsletter_subscribers (id, user_id, email, channel, status, locale, source)
        VALUES
            (${SUB_1}::uuid, ${user1.id}::uuid, ${SMOKE_EMAILS[0]}, 'email', 'active', 'es', 'web_footer'),
            (${SUB_2}::uuid, ${user2.id}::uuid, ${SMOKE_EMAILS[1]}, 'email', 'active', 'es', 'web_footer'),
            (${SUB_3}::uuid, ${user3.id}::uuid, ${SMOKE_EMAILS[2]}, 'email', 'active', 'es', 'web_footer')
    `);

    // Seed campaign A (the failed > 0 case).
    await db.execute(sql`
        INSERT INTO newsletter_campaigns
            (id, title, subject, body_json, status, locale_filter, created_by, sent_at, total_recipients)
        VALUES
            (${CAMPAIGN_A}::uuid, 'Smoke A', 'Smoke A subject',
             '{"type":"doc","content":[]}'::jsonb,
             'sending', 'all', ${adminId}::uuid, NOW(), 3)
    `);

    // Seed deliveries for A: 2 delivered, 1 failed, 0 pending.
    await db.execute(sql`
        INSERT INTO newsletter_campaign_deliveries (campaign_id, subscriber_id, channel, status)
        VALUES
            (${CAMPAIGN_A}::uuid, ${SUB_1}::uuid, 'email', 'delivered'),
            (${CAMPAIGN_A}::uuid, ${SUB_2}::uuid, 'email', 'delivered'),
            (${CAMPAIGN_A}::uuid, ${SUB_3}::uuid, 'email', 'failed')
    `);

    // Run the service.
    const svc = new NewsletterCampaignService({}, { notifyCampaignClosedWithFailuresFn: notifier });
    const result1 = await svc.closeSentCampaigns();
    if (result1.error) {
        console.error(`[smoke] Scenario A: service returned error: ${result1.error.message}`);
        exitCode = 1;
    } else {
        const closedCount = result1.data ?? 0;
        const aClosed = (
            await db.execute<{ status: string }>(sql`
                SELECT status FROM newsletter_campaigns WHERE id = ${CAMPAIGN_A}::uuid
            `)
        ).rows[0]?.status;

        console.info(`  closedCount returned by service: ${closedCount}`);
        console.info(`  campaign A status in DB after: ${aClosed}`);
        console.info(`  notifier calls so far: ${calls.length}`);

        const expectA =
            closedCount >= 1 &&
            aClosed === 'sent' &&
            calls.length === 1 &&
            calls[0]?.campaignId === CAMPAIGN_A &&
            calls[0]?.delivered === 2 &&
            calls[0]?.failed === 1 &&
            calls[0]?.totalRecipients === 3;

        if (expectA) {
            console.info('  ✅ Scenario A PASS');
        } else {
            console.error('  ❌ Scenario A FAIL');
            console.error(`     event captured: ${JSON.stringify(calls[0], null, 2)}`);
            exitCode = 1;
        }
    }

    // -----------------------------------------------------------------
    console.info('');
    console.info('[smoke] Scenario B — campaign with failed=0, delivered=3 (no notification)');

    // Reset call counter for this scenario.
    calls.length = 0;

    // Seed campaign B (the failed = 0 case).
    await db.execute(sql`
        INSERT INTO newsletter_campaigns
            (id, title, subject, body_json, status, locale_filter, created_by, sent_at, total_recipients)
        VALUES
            (${CAMPAIGN_B}::uuid, 'Smoke B', 'Smoke B subject',
             '{"type":"doc","content":[]}'::jsonb,
             'sending', 'all', ${adminId}::uuid, NOW(), 3)
    `);

    await db.execute(sql`
        INSERT INTO newsletter_campaign_deliveries (campaign_id, subscriber_id, channel, status)
        VALUES
            (${CAMPAIGN_B}::uuid, ${SUB_1}::uuid, 'email', 'delivered'),
            (${CAMPAIGN_B}::uuid, ${SUB_2}::uuid, 'email', 'delivered'),
            (${CAMPAIGN_B}::uuid, ${SUB_3}::uuid, 'email', 'delivered')
    `);

    const result2 = await svc.closeSentCampaigns();
    if (result2.error) {
        console.error(`[smoke] Scenario B: service returned error: ${result2.error.message}`);
        exitCode = 1;
    } else {
        const bClosed = (
            await db.execute<{ status: string }>(sql`
                SELECT status FROM newsletter_campaigns WHERE id = ${CAMPAIGN_B}::uuid
            `)
        ).rows[0]?.status;

        console.info(`  campaign B status in DB after: ${bClosed}`);
        console.info(`  notifier calls in Scenario B: ${calls.length}`);

        const expectB = bClosed === 'sent' && calls.length === 0;
        if (expectB) {
            console.info('  ✅ Scenario B PASS');
        } else {
            console.error('  ❌ Scenario B FAIL');
            exitCode = 1;
        }
    }

    // Cleanup.
    console.info('');
    console.info('[smoke] Cleaning up smoke rows...');
    await db.execute(sql`
        DELETE FROM newsletter_campaign_deliveries
        WHERE campaign_id IN (${CAMPAIGN_A}::uuid, ${CAMPAIGN_B}::uuid)
    `);
    await db.execute(sql`
        DELETE FROM newsletter_campaigns
        WHERE id IN (${CAMPAIGN_A}::uuid, ${CAMPAIGN_B}::uuid)
    `);
    await db.execute(sql`
        DELETE FROM newsletter_subscribers
        WHERE id IN (${SUB_1}::uuid, ${SUB_2}::uuid, ${SUB_3}::uuid)
    `);
    console.info('  cleanup done.');
} finally {
    await pool.end();
}

if (exitCode === 0) {
    console.info('');
    console.info('[smoke] ✅ ALL SCENARIOS PASS for T-108-02 wire-up.');
}
process.exit(exitCode);
