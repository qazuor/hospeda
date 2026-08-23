/**
 * `linkAnonymousSubscribersToUser` against a REAL PostgreSQL database.
 *
 * Regression coverage for the same defect HOS-749 fixed in the billing cleanup
 * guard, found by sweeping the repo for the pattern afterwards. Both `UPDATE`
 * branches of this method filtered with a bare JS array interpolated into a
 * Drizzle `sql` template:
 *
 * ```ts
 * WHERE id = ANY(${ids}::uuid[])
 * ```
 *
 * Drizzle expands a bare array into a COMMA-SEPARATED PLACEHOLDER LIST, which
 * Postgres never reads as an array. It fails for every non-empty input, and the
 * two failures look unrelated to each other:
 *
 *   - 2+ ids -> `($1, $2)::uuid[]` is a ROW CONSTRUCTOR:
 *     `cannot cast type record to uuid[]`
 *   - 1 id   -> `($1)::uuid[]` is a parenthesised SCALAR cast:
 *     `malformed array literal: "<uuid>"`
 *
 * The method returns early when no anonymous rows match, so the broken query
 * ran ONLY when there was real work to do — it failed 100% of the time it
 * mattered and 0% on an empty fixture. And the caller in
 * `apps/api/src/lib/auth.ts` logs and swallows the error so registration still
 * succeeds, which is why it stayed silent in production: the subscription was
 * simply never linked and no welcome email went out.
 *
 * ## Why the existing unit tests could not catch it
 *
 * `test/services/newsletter/newsletter-subscriber.service.test.ts` enqueues
 * canned rows and CAPTURES the SQL string without ever executing it, then
 * asserts `linkedCount === 2`. That assertion passes over a statement Postgres
 * cannot even parse. Only a real database can tell the difference, which is the
 * whole reason this file exists.
 *
 * ## Isolation
 *
 * NOT rollback-isolated, unlike its neighbours: the service resolves its own
 * client through `getDb()` rather than accepting the caller's transaction, so
 * rows written inside a test transaction would be invisible to it. Every test
 * therefore seeds through the shared client and cleans up in a `finally`, keyed
 * on a per-test unique email so the parallel workers cannot collide.
 */
import { randomUUID } from 'node:crypto';
import { eq, sql, users } from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { NewsletterSubscriberService } from '../../../src/services/newsletter/newsletter-subscriber.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const dbAvailable = isServiceTestDbAvailable();

const HMAC_SECRET = 'newsletter-link-anon-integration-secret-0123456789';

/** Builds a service with stubbed dispatchers so no real mail is attempted. */
function makeService() {
    const dispatcher = {
        sendVerification: vi.fn().mockResolvedValue(undefined),
        sendWelcome: vi.fn().mockResolvedValue(undefined)
    };
    return {
        svc: new NewsletterSubscriberService(
            {},
            {
                hmacSecret: HMAC_SECRET,
                notificationDispatcher: dispatcher as never
            }
        ),
        dispatcher
    };
}

/** A per-test unique email so parallel workers never share fixture rows. */
function uniqueEmail(prefix: string): string {
    return `${prefix}-${randomUUID()}@newsletter-link-test.local`;
}

/**
 * Inserts a user row and returns its generated id.
 *
 * Uses the typed Drizzle insert rather than raw SQL on purpose: `users.slug` is
 * NOT NULL and is filled by a Drizzle `$defaultFn`, so a hand-written
 * `INSERT INTO users (email)` violates the constraint. Same convention as
 * `helpers.ts`.
 */
async function seedUser(email: string): Promise<string> {
    const db = getServiceTestDb();
    const inserted = await db
        .insert(users)
        .values({
            email,
            displayName: 'Newsletter link fixture',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        } as typeof users.$inferInsert)
        .returning({ id: users.id });
    const id = inserted[0]?.id;
    if (!id) {
        throw new Error('seedUser: insert returned no id');
    }
    return id;
}

/**
 * Inserts one anonymous (`user_id IS NULL`) subscriber row.
 *
 * `channel` is explicit because `uq_newsletter_subscribers_user_channel_active`
 * is a partial UNIQUE on `(user_id, channel) WHERE deleted_at IS NULL`: once
 * both rows are linked to the same user they must differ by channel, or the
 * UPDATE fails on the unique index for a reason that has nothing to do with the
 * `ANY(...)` binding under test. Two anonymous rows on different channels is the
 * realistic shape anyway — the same person subscribing by email and by WhatsApp
 * before creating an account.
 */
async function seedAnonymousSubscriber(
    email: string,
    status: string,
    channel: 'email' | 'whatsapp' = 'email'
): Promise<string> {
    const db = getServiceTestDb();
    const rows = await db.execute<{ id: string }>(sql`
        INSERT INTO newsletter_subscribers (email, status, channel)
        VALUES (
            ${email},
            ${status}::newsletter_subscriber_status_enum,
            ${channel}::newsletter_channel_enum
        )
        RETURNING id
    `);
    const id = rows.rows?.[0]?.id;
    if (!id) {
        throw new Error('seedAnonymousSubscriber: insert returned no id');
    }
    return id;
}

/** Reads back the rows for one email, so assertions look at real stored state. */
async function readSubscribers(
    email: string
): Promise<Array<{ id: string; user_id: string | null; status: string }>> {
    const db = getServiceTestDb();
    const rows = await db.execute<{ id: string; user_id: string | null; status: string }>(sql`
        SELECT id, user_id, status FROM newsletter_subscribers WHERE email = ${email}
    `);
    return rows.rows ?? [];
}

/** Removes every fixture row this file created. */
async function cleanup(emails: readonly string[], userIds: readonly string[]): Promise<void> {
    const db = getServiceTestDb();
    for (const email of emails) {
        await db.execute(sql`DELETE FROM newsletter_subscribers WHERE email = ${email}`);
    }
    for (const userId of userIds) {
        await db.delete(users).where(eq(users.id, userId));
    }
}

describe.skipIf(!dbAvailable)(
    'NewsletterSubscriberService.linkAnonymousSubscribersToUser (real DB)',
    () => {
        afterAll(async () => {
            await closeServiceTestPool();
        });

        it('links TWO anonymous rows — the shape that made the bare-array cast unparseable', async () => {
            const email = uniqueEmail('two-rows');
            const userId = await seedUser(email);
            try {
                await seedAnonymousSubscriber(email, 'active', 'email');
                await seedAnonymousSubscriber(email, 'active', 'whatsapp');

                const { svc } = makeService();

                // Before the fix this rejects inside the service with
                // `cannot cast type record to uuid[]`, surfacing as result.error.
                const result = await svc.linkAnonymousSubscribersToUser({
                    userId,
                    email,
                    accountEmailVerified: false
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.linkedCount).toBe(2);

                // The counts come from the pre-update lookup, so they would be
                // right even if the UPDATE matched nothing. Read the rows back:
                // this is what proves the ANY actually matched BOTH ids rather
                // than parsing cleanly and updating zero rows.
                const rows = await readSubscribers(email);
                expect(rows).toHaveLength(2);
                expect(rows.every((row) => row.user_id === userId)).toBe(true);
            } finally {
                await cleanup([email], [userId]);
            }
        });

        it('links and PROMOTES two pending rows when the account email is verified — the other UPDATE branch', async () => {
            const email = uniqueEmail('promote');
            const userId = await seedUser(email);
            try {
                await seedAnonymousSubscriber(email, 'pending_verification', 'email');
                await seedAnonymousSubscriber(email, 'pending_verification', 'whatsapp');

                const { svc } = makeService();

                const result = await svc.linkAnonymousSubscribersToUser({
                    userId,
                    email,
                    accountEmailVerified: true
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.linkedCount).toBe(2);
                expect(result.data?.promotedToActiveCount).toBe(2);

                const rows = await readSubscribers(email);
                expect(rows).toHaveLength(2);
                expect(rows.every((row) => row.user_id === userId)).toBe(true);
                expect(rows.every((row) => row.status === 'active')).toBe(true);
            } finally {
                await cleanup([email], [userId]);
            }
        });

        it('links a SINGLE anonymous row — the bare-array form failed here too, with a different error', async () => {
            const email = uniqueEmail('one-row');
            const userId = await seedUser(email);
            try {
                await seedAnonymousSubscriber(email, 'active');

                const { svc } = makeService();

                // Before the fix: `malformed array literal: "<uuid>"`, because
                // `($1)::uuid[]` is a scalar cast rather than a row constructor.
                const result = await svc.linkAnonymousSubscribersToUser({
                    userId,
                    email,
                    accountEmailVerified: false
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.linkedCount).toBe(1);

                const rows = await readSubscribers(email);
                expect(rows).toHaveLength(1);
                expect(rows[0]?.user_id).toBe(userId);
            } finally {
                await cleanup([email], [userId]);
            }
        });

        it('leaves another address alone — the UPDATE is scoped to the looked-up ids', async () => {
            const email = uniqueEmail('scoped');
            const otherEmail = uniqueEmail('scoped-other');
            const userId = await seedUser(email);
            try {
                await seedAnonymousSubscriber(email, 'active', 'email');
                await seedAnonymousSubscriber(email, 'active', 'whatsapp');
                await seedAnonymousSubscriber(otherEmail, 'active', 'email');

                const { svc } = makeService();

                const result = await svc.linkAnonymousSubscribersToUser({
                    userId,
                    email,
                    accountEmailVerified: false
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.linkedCount).toBe(2);

                const otherRows = await readSubscribers(otherEmail);
                expect(otherRows).toHaveLength(1);
                expect(otherRows[0]?.user_id).toBeNull();
            } finally {
                await cleanup([email, otherEmail], [userId]);
            }
        });
    }
);
