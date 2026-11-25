/**
 * `getEligibleForCampaign` soft-cap behaviour against a REAL PostgreSQL database (HOS-2613).
 *
 * "Ignore soft cap" used to reach this query as `softCapWindowDays: 99999`, a sentinel
 * that did not skip the exclusion but widened it to ~270 years, so every subscriber who had
 * EVER received a campaign dropped out of the audience. The fix drops the exclusion when
 * the window is omitted.
 *
 * Isolation: the service resolves its own client through `getDb()`, so rows written inside
 * a rolled-back test transaction would be invisible to it. Fixtures are seeded through the
 * shared client and removed in `afterAll`; assertions only look at this file's own ids
 * because the query scans every active subscriber in the database.
 */
import { randomUUID } from 'node:crypto';
import { eq, sql, users } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NewsletterSubscriberService } from '../../../src/services/newsletter/newsletter-subscriber.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const dbAvailable = isServiceTestDbAvailable();

const HMAC_SECRET = 'newsletter-eligible-soft-cap-secret-0123456789';

let creatorId = '';
let campaignId = '';
let recentId = '';
let oldId = '';
let neverId = '';

async function seedSubscriber(label: string): Promise<string> {
    const db = getServiceTestDb();
    const rows = await db.execute<{ id: string }>(sql`
        INSERT INTO newsletter_subscribers (email, status, channel, locale)
        VALUES (
            ${`${label}-${randomUUID()}@soft-cap-test.local`},
            'active'::newsletter_subscriber_status_enum,
            'email'::newsletter_channel_enum,
            'es'
        )
        RETURNING id
    `);
    const id = rows.rows?.[0]?.id;
    if (!id) throw new Error('seedSubscriber: insert returned no id');
    return id;
}

async function seedDelivery(subscriberId: string, daysAgo: number): Promise<void> {
    const db = getServiceTestDb();
    await db.execute(sql`
        INSERT INTO newsletter_campaign_deliveries (campaign_id, subscriber_id, channel, status, delivered_at)
        VALUES (
            ${campaignId}::uuid,
            ${subscriberId}::uuid,
            'email',
            'delivered'::newsletter_delivery_status_enum,
            NOW() - (${daysAgo} || ' days')::interval
        )
    `);
}

describe.skipIf(!dbAvailable)(
    'NewsletterSubscriberService.getEligibleForCampaign soft cap (real DB)',
    () => {
        const svc = new NewsletterSubscriberService({}, { hmacSecret: HMAC_SECRET });

        beforeAll(async () => {
            const db = getServiceTestDb();
            const created = await db
                .insert(users)
                .values({
                    email: `creator-${randomUUID()}@soft-cap-test.local`,
                    displayName: 'Soft cap fixture',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                } as typeof users.$inferInsert)
                .returning({ id: users.id });
            creatorId = created[0]?.id ?? '';
            if (!creatorId) throw new Error('beforeAll: user insert returned no id');
            const rows = await db.execute<{ id: string }>(sql`
            INSERT INTO newsletter_campaigns (title, subject, body_json, created_by)
            VALUES ('soft cap fixture', 'soft cap fixture', '{}'::jsonb, ${creatorId}::uuid)
            RETURNING id
        `);
            campaignId = rows.rows?.[0]?.id ?? '';
            if (!campaignId) throw new Error('beforeAll: campaign insert returned no id');

            recentId = await seedSubscriber('recent');
            oldId = await seedSubscriber('old');
            neverId = await seedSubscriber('never');
            await seedDelivery(recentId, 1);
            await seedDelivery(oldId, 400);
        });

        afterAll(async () => {
            const db = getServiceTestDb();
            // Deliveries and subscribers cascade from the campaign / subscriber rows.
            if (campaignId) {
                await db.execute(
                    sql`DELETE FROM newsletter_campaigns WHERE id = ${campaignId}::uuid`
                );
            }
            for (const id of [recentId, oldId, neverId]) {
                if (id)
                    await db.execute(
                        sql`DELETE FROM newsletter_subscribers WHERE id = ${id}::uuid`
                    );
            }
            if (creatorId) await db.delete(users).where(eq(users.id, creatorId));
            await closeServiceTestPool();
        });

        it('excludes a subscriber mailed yesterday when a 7-day window applies', async () => {
            const result = await svc.getEligibleForCampaign({
                localeFilter: 'es',
                softCapWindowDays: 7
            });

            expect(result.error).toBeUndefined();
            const ids = result.data?.eligibleIds ?? [];
            expect(ids).not.toContain(recentId);
            expect(ids).toContain(oldId);
            expect(ids).toContain(neverId);
        });

        it('keeps a subscriber mailed yesterday eligible when no window is given (ignore soft cap)', async () => {
            const result = await svc.getEligibleForCampaign({ localeFilter: 'es' });

            expect(result.error).toBeUndefined();
            const ids = result.data?.eligibleIds ?? [];
            expect(ids).toContain(recentId);
            expect(ids).toContain(oldId);
            expect(ids).toContain(neverId);
            expect(result.data?.softCappedCount).toBe(0);
        });
    }
);
