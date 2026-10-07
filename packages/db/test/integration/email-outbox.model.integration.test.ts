/**
 * Integration tests for the email outbox (HOS-1422, unit U2.1).
 *
 * TEST:U2:1/2/3/5. These tests COMMIT real rows (the atomicity and
 * concurrency claims cannot be proved inside a transaction that always rolls
 * back), so every row they create is deleted in `afterEach`.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { EmailOutboxModel } from '../../src/models/email-outbox/email-outbox.model.ts';
import { buildEmailDedupKey } from '../../src/models/email-outbox/email-outbox-dedup-key.ts';
import { emailOutbox } from '../../src/schemas/email-outbox/email_outbox.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData } from './helpers.ts';

const model = new EmailOutboxModel();
const createdUserIds: string[] = [];
const createdKeys: string[] = [];

/** Unique dedup key per call, tracked for cleanup. */
function newKey(label = 'tpl'): string {
    const key = buildEmailDedupKey({
        recipient: crypto.randomUUID(),
        template: label,
        occurrence: `event:${crypto.randomUUID()}`
    });
    createdKeys.push(key);
    return key;
}

beforeAll(() => {
    setDb(getTestDb());
});

afterEach(async () => {
    const db = getTestDb();
    if (createdKeys.length > 0) {
        await db.delete(emailOutbox).where(inArray(emailOutbox.dedupKey, createdKeys));
        createdKeys.length = 0;
    }
    if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
        createdUserIds.length = 0;
    }
});

afterAll(async () => {
    await closeTestPool();
});

describe('AC:U2:1 enqueue inside the domain transaction', () => {
    it('commits the domain write and the outbox row together', async () => {
        // Arrange
        const db = getTestDb();
        const user = testData.user();
        createdUserIds.push(user.id);
        const dedupKey = newKey();

        // Act
        await db.transaction(async (tx) => {
            await tx.insert(users).values(user);
            await model.enqueue(
                {
                    recipientUserId: user.id,
                    recipientEmail: user.email,
                    template: 'welcome',
                    dedupKey
                },
                tx as unknown as DrizzleClient
            );
        });

        // Assert
        const domain = await db.select().from(users).where(eq(users.id, user.id));
        const queued = await db
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.dedupKey, dedupKey));
        expect(domain).toHaveLength(1);
        expect(queued).toHaveLength(1);
        expect(queued[0]?.status).toBe('pending');
    });

    it('leaves neither the domain row nor the outbox row when the transaction rolls back', async () => {
        // Arrange
        const db = getTestDb();
        const user = testData.user();
        createdUserIds.push(user.id);
        const dedupKey = newKey();

        // Act
        await expect(
            db.transaction(async (tx) => {
                await tx.insert(users).values(user);
                await model.enqueue(
                    {
                        recipientUserId: user.id,
                        recipientEmail: user.email,
                        template: 'welcome',
                        dedupKey
                    },
                    tx as unknown as DrizzleClient
                );
                throw new Error('domain step failed after enqueue');
            })
        ).rejects.toThrow('domain step failed after enqueue');

        // Assert
        expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
        expect(
            await db.select().from(emailOutbox).where(eq(emailOutbox.dedupKey, dedupKey))
        ).toHaveLength(0);
    });

    it('keeps the row retryable and the domain action when the send fails', async () => {
        // Arrange: domain write + enqueue committed together
        const db = getTestDb();
        const user = testData.user();
        createdUserIds.push(user.id);
        const dedupKey = newKey();
        await db.transaction(async (tx) => {
            await tx.insert(users).values(user);
            await model.enqueue(
                {
                    recipientUserId: user.id,
                    recipientEmail: user.email,
                    template: 'welcome',
                    dedupKey
                },
                tx as unknown as DrizzleClient
            );
        });
        await model.claim({ owner: 'sender-1', leaseMs: 60_000, limit: 100 });
        const row = (
            await db.select().from(emailOutbox).where(eq(emailOutbox.dedupKey, dedupKey))
        )[0];
        if (!row) throw new Error('row missing');

        // Act: the provider call throws, the sender records the failure
        const afterFirst = await model.recordFailure({
            id: row.id,
            owner: 'sender-1',
            error: 'provider down',
            maxAttempts: 3
        });

        // Assert: row is retry, attempts counted, error kept, domain row untouched
        const after = (await db.select().from(emailOutbox).where(eq(emailOutbox.id, row.id)))[0];
        expect(afterFirst).toBe('retry');
        expect(after?.status).toBe('retry');
        expect(after?.attempts).toBe(1);
        expect(after?.lastError).toBe('provider down');
        expect(after?.lockedBy).toBeNull();
        expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
    });

    it('turns the failure definitive at maxAttempts and records the provider id on success', async () => {
        // Arrange
        const dedupKeyFail = newKey();
        const dedupKeyOk = newKey();
        const failRow = (
            await model.enqueue({
                recipientEmail: 'a@example.com',
                template: 't',
                dedupKey: dedupKeyFail
            })
        ).row;
        const okRow = (
            await model.enqueue({
                recipientEmail: 'b@example.com',
                template: 't',
                dedupKey: dedupKeyOk
            })
        ).row;
        if (!failRow || !okRow) throw new Error('enqueue failed');
        await getTestDb()
            .update(emailOutbox)
            .set({
                status: 'processing',
                lockedBy: 'o',
                lockedUntil: new Date(Date.now() + 60_000)
            })
            .where(inArray(emailOutbox.id, [failRow.id, okRow.id]));

        // Act
        const failStatus = await model.recordFailure({
            id: failRow.id,
            owner: 'o',
            error: 'x',
            maxAttempts: 1
        });
        const sent = await model.markSent({ id: okRow.id, owner: 'o', providerMessageId: 'msg-1' });

        // Assert
        const ok = (
            await getTestDb().select().from(emailOutbox).where(eq(emailOutbox.id, okRow.id))
        )[0];
        expect(failStatus).toBe('failed');
        expect(sent).toBe(true);
        expect(ok?.status).toBe('sent');
        expect(ok?.providerMessageId).toBe('msg-1');
    });
});

describe('AC:U2:2 recipient address captured at enqueue', () => {
    it('hands the sender the address stored at enqueue after the account is pseudonymized', async () => {
        // Arrange
        const db = getTestDb();
        const user = testData.user({ email: `real-${crypto.randomUUID()}@example.com` });
        createdUserIds.push(user.id);
        await db.insert(users).values(user);
        const dedupKey = newKey();
        await model.enqueue({
            recipientUserId: user.id,
            recipientEmail: user.email,
            template: 'listing-deleted-confirmation',
            dedupKey
        });

        // Act: the account deactivation writes a pseudonym into the address
        const pseudonym = `deleted-${crypto.randomUUID()}@pseudonym.invalid`;
        await db.update(users).set({ email: pseudonym }).where(eq(users.id, user.id));
        const claimed = await model.claim({ owner: 'sender-1', leaseMs: 60_000, limit: 100 });

        // Assert
        const row = claimed.find((r) => r.dedupKey === dedupKey);
        expect(row?.recipientEmail).toBe(user.email);
        expect(row?.recipientEmail).not.toBe(pseudonym);
    });
});

describe('AC:U2:3 processing has an owner and a lease', () => {
    it('stores owner and lease on claim', async () => {
        // Arrange
        const dedupKey = newKey();
        await model.enqueue({ recipientEmail: 'c@example.com', template: 't', dedupKey });
        const now = new Date('2026-10-07T10:00:00.000Z');

        // Act
        const claimed = await model.claim({
            owner: 'sender-A',
            leaseMs: 5 * 60_000,
            limit: 100,
            now
        });

        // Assert
        const row = claimed.find((r) => r.dedupKey === dedupKey);
        expect(row?.status).toBe('processing');
        expect(row?.lockedBy).toBe('sender-A');
        expect(row?.lockedUntil?.toISOString()).toBe('2026-10-07T10:05:00.000Z');
    });

    it('returns an expired processing row to pending so another sender can take it', async () => {
        // Arrange: A claims and then dies
        const dedupKey = newKey();
        await model.enqueue({ recipientEmail: 'd@example.com', template: 't', dedupKey });
        const t0 = new Date('2026-10-07T10:00:00.000Z');
        await model.claim({ owner: 'sender-A', leaseMs: 60_000, limit: 100, now: t0 });

        // Act
        const beforeExpiry = await model.recoverExpired({ now: new Date(t0.getTime() + 30_000) });
        const afterExpiry = await model.recoverExpired({ now: new Date(t0.getTime() + 61_000) });
        const reclaimed = await model.claim({
            owner: 'sender-B',
            leaseMs: 60_000,
            limit: 100,
            now: new Date(t0.getTime() + 62_000)
        });

        // Assert
        const row = (
            await getTestDb().select().from(emailOutbox).where(eq(emailOutbox.dedupKey, dedupKey))
        )[0];
        expect(beforeExpiry).toHaveLength(0);
        expect(afterExpiry).toContain(row?.id);
        expect(reclaimed.find((r) => r.dedupKey === dedupKey)?.lockedBy).toBe('sender-B');
    });

    it('never double-claims a row between two concurrent senders', async () => {
        // Arrange
        const keys = [newKey(), newKey(), newKey()];
        for (const dedupKey of keys) {
            await model.enqueue({ recipientEmail: 'e@example.com', template: 't', dedupKey });
        }

        // Act
        const [a, b] = await Promise.all([
            model.claim({ owner: 'A', leaseMs: 60_000, limit: 1000 }),
            model.claim({ owner: 'B', leaseMs: 60_000, limit: 1000 })
        ]);

        // Assert
        const ids = [...a, ...b].filter((r) => keys.includes(r.dedupKey)).map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(3);
    });

    it('refuses a processing row without owner and lease (CHECK)', async () => {
        // Arrange
        const dedupKey = newKey();
        const row = (
            await model.enqueue({ recipientEmail: 'f@example.com', template: 't', dedupKey })
        ).row;
        if (!row) throw new Error('enqueue failed');

        // Act + Assert
        await expect(
            getTestDb().execute(
                sql`UPDATE email_outbox SET status = 'processing' WHERE id = ${row.id}`
            )
        ).rejects.toThrow();
    });
});

describe('AC:U2:5 dedup key is a unique column', () => {
    it('enqueues one row when the same key is enqueued twice, without error', async () => {
        // Arrange
        const dedupKey = newKey();

        // Act
        const first = await model.enqueue({
            recipientEmail: 'g@example.com',
            template: 't',
            dedupKey
        });
        const second = await model.enqueue({
            recipientEmail: 'g@example.com',
            template: 't',
            dedupKey
        });

        // Assert
        const rows = await getTestDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.dedupKey, dedupKey));
        expect(first.enqueued).toBe(true);
        expect(second.enqueued).toBe(false);
        expect(second.row).toBeNull();
        expect(rows).toHaveLength(1);
    });

    it('enqueues one row when parallel instances enqueue the same key', async () => {
        // Arrange
        const dedupKey = newKey();

        // Act
        const results = await Promise.all(
            Array.from({ length: 6 }, () =>
                model.enqueue({ recipientEmail: 'h@example.com', template: 't', dedupKey })
            )
        );

        // Assert
        const rows = await getTestDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.dedupKey, dedupKey));
        expect(results.filter((r) => r.enqueued)).toHaveLength(1);
        expect(rows).toHaveLength(1);
    });

    it('rejects a duplicate key at the database level (UNIQUE)', async () => {
        // Arrange
        const dedupKey = newKey();
        await model.enqueue({ recipientEmail: 'i@example.com', template: 't', dedupKey });

        // Act + Assert: bypass the model's ON CONFLICT
        await expect(
            getTestDb()
                .insert(emailOutbox)
                .values({ recipientEmail: 'i@example.com', template: 't', dedupKey })
        ).rejects.toThrow();
    });
});
