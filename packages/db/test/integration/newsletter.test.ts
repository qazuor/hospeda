/**
 * Integration tests for the newsletter tables (SPEC-101 T-101-07 + T-101-03).
 *
 * Verifies the three newsletter tables that landed in T-101-04/05/06, the
 * partial-unique and unique constraints from manual SQL 0022 and 0023, and
 * the legacy opt-in seed migration from manual SQL 0024.
 *
 * Each test uses {@link withTestTransaction} so the data ALWAYS rolls back —
 * parallel-safe and zero cleanup.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
    newsletterCampaignDeliveries,
    newsletterCampaigns,
    newsletterSubscribers,
    users
} from '../../src/schemas/index.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const SEED_SQL_PATH = resolve(
    __filename,
    '../../../src/migrations/manual/0024_newsletter_seed_existing_optins.sql'
);

/** SQL content of the 0024 seed file. Read once at module load. */
const SEED_SQL = readFileSync(SEED_SQL_PATH, 'utf-8');

/**
 * Gate flag set by `global-setup.ts` after `apply-postgres-extras.mjs` runs.
 * The manual migrations (0022 partial UNIQUE, 0023 delivery UNIQUE, 0024 seed)
 * are not declared in the Drizzle schema, so every test that exercises them
 * must skip when extras did not apply (SPEC-108 T-108-03).
 */
const postgresExtrasApplied = process.env.HOSPEDA_TEST_POSTGRES_EXTRAS_APPLIED === '1';

describe('Newsletter schema — integration', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    // -----------------------------------------------------------------------
    // Table existence + apply-postgres-extras sanity checks
    // -----------------------------------------------------------------------

    describe('Schema sanity', () => {
        it('creates all three newsletter tables on db push', async () => {
            const db = getTestDb();
            const result = await db.execute<{ tablename: string }>(sql`
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                  AND tablename IN (
                      'newsletter_subscribers',
                      'newsletter_campaigns',
                      'newsletter_campaign_deliveries'
                  )
                ORDER BY tablename
            `);

            const tables = result.rows.map((r) => r.tablename);
            expect(tables).toEqual([
                'newsletter_campaign_deliveries',
                'newsletter_campaigns',
                'newsletter_subscribers'
            ]);
        });

        it.skipIf(!postgresExtrasApplied)(
            'applies the partial UNIQUE index from manual SQL 0022',
            async () => {
                const db = getTestDb();
                const result = await db.execute<{ indexname: string; indexdef: string }>(sql`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'uq_newsletter_subscribers_user_channel_active'
            `);

                expect(result.rows).toHaveLength(1);
                // Sanity-check the partial WHERE clause is wired (Postgres normalises whitespace).
                expect(result.rows[0]?.indexdef).toMatch(/WHERE \(deleted_at IS NULL\)/);
            }
        );

        it.skipIf(!postgresExtrasApplied)(
            'applies the delivery UNIQUE + partial pending indexes from manual SQL 0023',
            async () => {
                const db = getTestDb();
                const result = await db.execute<{ indexname: string }>(sql`
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname IN (
                      'uq_newsletter_deliveries_campaign_subscriber_channel',
                      'idx_newsletter_deliveries_pending'
                  )
                ORDER BY indexname
            `);

                const names = result.rows.map((r) => r.indexname);
                expect(names).toEqual([
                    'idx_newsletter_deliveries_pending',
                    'uq_newsletter_deliveries_campaign_subscriber_channel'
                ]);
            }
        );
    });

    // -----------------------------------------------------------------------
    // Subscriber unique constraint
    // -----------------------------------------------------------------------

    describe('newsletter_subscribers (user_id, channel) partial UNIQUE', () => {
        it.skipIf(!postgresExtrasApplied)(
            'rejects a second active subscription for the same (user, channel) pair',
            async () => {
                await withTestTransaction(async (tx) => {
                    const user = testData.user();
                    await tx.insert(users).values(user);

                    await tx.insert(newsletterSubscribers).values({
                        userId: user.id,
                        email: user.email,
                        channel: 'email',
                        status: 'active',
                        locale: 'es',
                        source: 'web_footer'
                    });

                    await expect(
                        tx.insert(newsletterSubscribers).values({
                            userId: user.id,
                            email: user.email,
                            channel: 'email',
                            status: 'pending_verification',
                            locale: 'es',
                            source: 'account_preferences'
                        })
                    ).rejects.toThrow();
                });
            }
        );

        it.skipIf(!postgresExtrasApplied)(
            'allows a NEW subscription after the previous one was soft-deleted',
            async () => {
                await withTestTransaction(async (tx) => {
                    const user = testData.user();
                    await tx.insert(users).values(user);

                    // First subscription, then soft-delete it.
                    const [first] = await tx
                        .insert(newsletterSubscribers)
                        .values({
                            userId: user.id,
                            email: user.email,
                            channel: 'email',
                            status: 'unsubscribed',
                            locale: 'es',
                            source: 'web_footer',
                            deletedAt: new Date()
                        })
                        .returning({ id: newsletterSubscribers.id });

                    // The partial WHERE deleted_at IS NULL means this second insert
                    // must succeed — the previous row no longer "occupies" the slot.
                    const [second] = await tx
                        .insert(newsletterSubscribers)
                        .values({
                            userId: user.id,
                            email: user.email,
                            channel: 'email',
                            status: 'active',
                            locale: 'es',
                            source: 'account_preferences'
                        })
                        .returning({ id: newsletterSubscribers.id });

                    expect(first?.id).toBeDefined();
                    expect(second?.id).toBeDefined();
                    expect(first?.id).not.toBe(second?.id);
                });
            }
        );
    });

    // -----------------------------------------------------------------------
    // Legacy seed migration (manual SQL 0024) — T-101-03
    // -----------------------------------------------------------------------

    describe('manual SQL 0024 — legacy opt-in seed', () => {
        it.skipIf(!postgresExtrasApplied)(
            'seeds an ACTIVE subscriber for every user with settings.newsletter=true',
            async () => {
                await withTestTransaction(async (tx) => {
                    // 3 users covering each branch of the seed query.
                    const optedIn = testData.user({
                        settings: { newsletter: true, languageWeb: 'en' }
                    });
                    const optedOut = testData.user({
                        settings: { newsletter: false, languageWeb: 'es' }
                    });
                    const optedInButDeleted = testData.user({
                        settings: { newsletter: true, languageWeb: 'pt' },
                        deletedAt: new Date()
                    });
                    await tx.insert(users).values([optedIn, optedOut, optedInButDeleted]);

                    await tx.execute(sql.raw(SEED_SQL));

                    const seeded = await tx.execute<{
                        user_id: string;
                        status: string;
                        locale: string;
                        source: string;
                    }>(sql`
                    SELECT user_id, status, locale, source
                    FROM newsletter_subscribers
                    WHERE source = 'migration'
                    ORDER BY user_id
                `);

                    expect(seeded.rows).toHaveLength(1);
                    expect(seeded.rows[0]).toMatchObject({
                        user_id: optedIn.id,
                        status: 'active',
                        locale: 'en',
                        source: 'migration'
                    });
                });
            }
        );

        it.skipIf(!postgresExtrasApplied)(
            'is idempotent — running the seed twice produces no duplicates',
            async () => {
                await withTestTransaction(async (tx) => {
                    const optedIn = testData.user({
                        settings: { newsletter: true, languageWeb: 'es' }
                    });
                    await tx.insert(users).values(optedIn);

                    await tx.execute(sql.raw(SEED_SQL));
                    await tx.execute(sql.raw(SEED_SQL));

                    const seeded = await tx.execute<{ count: string }>(sql`
                    SELECT COUNT(*)::text AS count
                    FROM newsletter_subscribers
                    WHERE user_id = ${optedIn.id} AND source = 'migration'
                `);

                    expect(seeded.rows[0]?.count).toBe('1');
                });
            }
        );

        it.skipIf(!postgresExtrasApplied)(
            'falls back to es when languageWeb is missing or unsupported',
            async () => {
                await withTestTransaction(async (tx) => {
                    const noLang = testData.user({ settings: { newsletter: true } });
                    const weirdLang = testData.user({
                        settings: { newsletter: true, languageWeb: 'fr' }
                    });
                    const legacyLang = testData.user({
                        settings: { newsletter: true, language: 'pt' }
                    });
                    await tx.insert(users).values([noLang, weirdLang, legacyLang]);

                    await tx.execute(sql.raw(SEED_SQL));

                    const seeded = await tx.execute<{ user_id: string; locale: string }>(sql`
                    SELECT user_id, locale
                    FROM newsletter_subscribers
                    WHERE source = 'migration'
                `);

                    const byUser = Object.fromEntries(
                        seeded.rows.map((r) => [r.user_id, r.locale])
                    );
                    expect(byUser[noLang.id]).toBe('es');
                    expect(byUser[weirdLang.id]).toBe('es');
                    expect(byUser[legacyLang.id]).toBe('pt');
                });
            }
        );
    });

    // -----------------------------------------------------------------------
    // Delivery unique constraint (idempotency)
    // -----------------------------------------------------------------------

    describe('newsletter_campaign_deliveries (campaign, subscriber, channel) UNIQUE', () => {
        it.skipIf(!postgresExtrasApplied)(
            'prevents duplicate deliveries for the same campaign + subscriber + channel',
            async () => {
                await withTestTransaction(async (tx) => {
                    const user = testData.user();
                    await tx.insert(users).values(user);

                    const [subscriber] = await tx
                        .insert(newsletterSubscribers)
                        .values({
                            userId: user.id,
                            email: user.email,
                            channel: 'email',
                            status: 'active',
                            locale: 'es',
                            source: 'web_footer'
                        })
                        .returning({ id: newsletterSubscribers.id });

                    const [campaign] = await tx
                        .insert(newsletterCampaigns)
                        .values({
                            title: 'Test Campaign',
                            subject: 'Test Subject',
                            bodyJson: { type: 'doc', content: [] },
                            status: 'sending',
                            localeFilter: 'all',
                            createdBy: user.id,
                            sentAt: new Date(),
                            totalRecipients: 1
                        })
                        .returning({ id: newsletterCampaigns.id });

                    if (!subscriber?.id || !campaign?.id) {
                        throw new Error('Failed to seed campaign/subscriber fixtures');
                    }

                    await tx.insert(newsletterCampaignDeliveries).values({
                        campaignId: campaign.id,
                        subscriberId: subscriber.id,
                        channel: 'email',
                        status: 'pending'
                    });

                    await expect(
                        tx.insert(newsletterCampaignDeliveries).values({
                            campaignId: campaign.id,
                            subscriberId: subscriber.id,
                            channel: 'email',
                            status: 'pending'
                        })
                    ).rejects.toThrow();
                });
            }
        );
    });
});
