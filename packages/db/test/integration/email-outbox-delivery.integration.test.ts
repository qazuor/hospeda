/**
 * Integration tests for the outbox sender's SQL (HOS-1423, unit U2.2).
 *
 * TEST:U2:4, TEST:U2:7 and TEST:U2:8 — the DB half. The orchestration that
 * calls these primitives in order is unit-tested in
 * `packages/notifications/test/services/outbox/email-outbox-delivery.service.test.ts`;
 * here every claim about state rests on real rows.
 *
 * Rows are COMMITTED (the domain-transaction claim cannot be proved inside a
 * transaction that always rolls back), so every row is deleted in `afterEach`.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { EmailOutboxModel } from '../../src/models/email-outbox/email-outbox.model.ts';
import { buildEmailDedupKey } from '../../src/models/email-outbox/email-outbox-dedup-key.ts';
import { NotificationLogModel } from '../../src/models/notification-log/notificationLog.model.ts';
import { emailOutbox } from '../../src/schemas/email-outbox/email_outbox.dbschema.ts';
import { notificationLog } from '../../src/schemas/notification-log/notification_log.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData } from './helpers.ts';

const outbox = new EmailOutboxModel();
const log = new NotificationLogModel();
const OWNER = 'email-outbox-sender:it';
const MAX_ATTEMPTS = 5;
const HARD_BOUNCE_MARKER = 'undeliverable:hard_bounce';
const EXHAUSTED_MARKER = 'undeliverable:retries_exhausted';

const createdUserIds: string[] = [];
const createdKeys: string[] = [];
const createdRecipients: string[] = [];

/** Unique address per call, tracked for cleanup of both tables. */
function newRecipient(): string {
    const address = `u2-2-${crypto.randomUUID()}@example.com`;
    createdRecipients.push(address);
    return address;
}

/** Enqueues one committed row and returns it. */
async function enqueueRow(input: {
    readonly recipientEmail: string;
    readonly template?: string;
    readonly recipientUserId?: string | null;
    readonly tx?: DrizzleClient;
}) {
    const dedupKey = buildEmailDedupKey({
        recipient: input.recipientEmail,
        template: input.template ?? 'tpl',
        occurrence: `event:${crypto.randomUUID()}`
    });
    createdKeys.push(dedupKey);
    const { row } = await outbox.enqueue(
        {
            recipientEmail: input.recipientEmail,
            recipientUserId: input.recipientUserId ?? null,
            template: input.template ?? 'tpl',
            dedupKey
        },
        input.tx
    );
    if (!row) throw new Error('enqueue wrote no row');
    return row;
}

/** Claims every sendable row and returns the one with `id`. */
async function claimRow(id: string, now = new Date()) {
    const claimed = await outbox.claim({ owner: OWNER, leaseMs: 300_000, limit: 1000, now });
    const row = claimed.find((r) => r.id === id);
    if (!row) throw new Error(`row ${id} was not claimed`);
    return row;
}

async function readRow(id: string) {
    const rows = await getTestDb().select().from(emailOutbox).where(eq(emailOutbox.id, id));
    return rows[0];
}

async function logRowsOf(outboxId: string) {
    return getTestDb()
        .select()
        .from(notificationLog)
        .where(sql`${notificationLog.metadata}->>'outboxId' = ${outboxId}`)
        .orderBy(notificationLog.createdAt);
}

beforeAll(() => {
    setDb(getTestDb());
});

afterEach(async () => {
    const db = getTestDb();
    if (createdRecipients.length > 0) {
        await db
            .delete(notificationLog)
            .where(inArray(notificationLog.recipient, createdRecipients));
        createdRecipients.length = 0;
    }
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

describe('TEST:U2:8 notification_log is the single attempt record', () => {
    it('writes exactly one row per attempt, keyed to the outbox row, and none elsewhere', async () => {
        // Arrange
        const recipient = newRecipient();
        const row = await enqueueRow({ recipientEmail: recipient, template: 'welcome' });
        const t0 = new Date();

        // Act: two refused attempts, then a successful one, each recorded once
        for (const [i, status] of (['failed', 'failed', 'sent'] as const).entries()) {
            await claimRow(row.id);
            const at = new Date(t0.getTime() + i * 1000);
            if (status === 'failed') {
                await outbox.recordFailure({
                    id: row.id,
                    owner: OWNER,
                    error: 'provider 503',
                    maxAttempts: MAX_ATTEMPTS
                });
            } else {
                await outbox.markSent({ id: row.id, owner: OWNER, providerMessageId: 'msg-ok' });
            }
            await log.recordEmailAttempt({
                outboxId: row.id,
                recipient,
                template: 'welcome',
                subject: 'Welcome',
                status,
                emailClass: 'transactional',
                at,
                providerMessageId: status === 'sent' ? 'msg-ok' : null,
                errorMessage: status === 'failed' ? 'provider 503' : null
            });
        }

        // Assert
        const records = await logRowsOf(row.id);
        expect(records.map((r) => r.status)).toEqual(['failed', 'failed', 'sent']);
        expect(records[2]).toMatchObject({
            recipient,
            templateId: 'welcome',
            channel: 'email',
            subject: 'Welcome'
        });
        expect(records[2]?.sentAt).not.toBeNull();
        expect(records[2]?.metadata).toMatchObject({
            source: 'email_outbox',
            outboxId: row.id,
            emailClass: 'transactional',
            messageId: 'msg-ok'
        });
        const after = await readRow(row.id);
        expect(after).toMatchObject({ status: 'sent', attempts: 2, providerMessageId: 'msg-ok' });
    });
});

describe('TEST:U2:4 an undeliverable transactional mail is failed + marked, and never blocks the domain', () => {
    it('retries exhausted: failed with the exhausted marker; the domain write that enqueued it stays', async () => {
        // Arrange: domain write + enqueue committed in ONE transaction
        const db = getTestDb();
        const user = testData.user({ email: newRecipient() });
        createdUserIds.push(user.id);
        let rowId = '';
        await db.transaction(async (tx) => {
            await tx.insert(users).values(user);
            const row = await enqueueRow({
                recipientEmail: user.email,
                recipientUserId: user.id,
                tx: tx as unknown as DrizzleClient
            });
            rowId = row.id;
        });

        // Act: five refused attempts; the last carries the exhausted marker
        const statuses: (string | null)[] = [];
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            await claimRow(rowId);
            const final = attempt === MAX_ATTEMPTS;
            statuses.push(
                await outbox.recordFailure({
                    id: rowId,
                    owner: OWNER,
                    error: final ? `${EXHAUSTED_MARKER}: provider 503` : 'provider 503',
                    maxAttempts: MAX_ATTEMPTS
                })
            );
        }
        await log.recordEmailAttempt({
            outboxId: rowId,
            recipient: user.email,
            template: 'tpl',
            subject: 'tpl',
            status: 'undeliverable',
            emailClass: 'transactional',
            at: new Date(),
            errorMessage: `${EXHAUSTED_MARKER}: provider 503`,
            metadata: { kind: 'escalation', reason: 'retries_exhausted' }
        });

        // Assert
        expect(statuses).toEqual(['retry', 'retry', 'retry', 'retry', 'failed']);
        const after = await readRow(rowId);
        expect(after?.status).toBe('failed');
        expect(after?.attempts).toBe(MAX_ATTEMPTS);
        expect(after?.lastError?.startsWith(EXHAUSTED_MARKER)).toBe(true);
        expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(1);
        const escalation = (await logRowsOf(rowId)).filter((r) => r.status === 'undeliverable');
        expect(escalation).toHaveLength(1);
        // A failed row is never claimed again.
        const reclaimed = await outbox.claim({ owner: 'other', leaseMs: 1000, limit: 1000 });
        expect(reclaimed.map((r) => r.id)).not.toContain(rowId);
    });

    it('hard bounce on send: failed on the FIRST attempt with the bounce marker, and the address is now bounced', async () => {
        // Arrange
        const recipient = newRecipient();
        const row = await enqueueRow({ recipientEmail: recipient });
        await claimRow(row.id);

        // Act
        const status = await outbox.recordFailure({
            id: row.id,
            owner: OWNER,
            error: `${HARD_BOUNCE_MARKER}: mailbox does not exist`,
            maxAttempts: 1
        });
        await log.recordEmailAttempt({
            outboxId: row.id,
            recipient,
            template: 'tpl',
            subject: 'tpl',
            status: 'bounced',
            emailClass: 'transactional',
            at: new Date(),
            errorMessage: 'mailbox does not exist'
        });

        // Assert
        expect(status).toBe('failed');
        const after = await readRow(row.id);
        expect(after).toMatchObject({ status: 'failed', attempts: 1 });
        expect(after?.lastError?.startsWith(HARD_BOUNCE_MARKER)).toBe(true);
        expect(await log.hasHardBounce({ recipient: recipient.toUpperCase() })).toBe(true);
    });

    it('markFailed fails a held row with its marker WITHOUT counting an attempt, and only for the owner', async () => {
        // Arrange
        const row = await enqueueRow({ recipientEmail: newRecipient() });
        await claimRow(row.id);

        // Act
        const byStranger = await outbox.markFailed({
            id: row.id,
            owner: 'someone-else',
            marker: 'suppressed:opt_out'
        });
        const byOwner = await outbox.markFailed({
            id: row.id,
            owner: OWNER,
            marker: 'suppressed:opt_out'
        });

        // Assert
        expect(byStranger).toBe(false);
        expect(byOwner).toBe(true);
        expect(await readRow(row.id)).toMatchObject({
            status: 'failed',
            attempts: 0,
            lastError: 'suppressed:opt_out',
            lockedBy: null,
            lockedUntil: null
        });
    });
});

describe('TEST:U2:7 the facts the suppression reads', () => {
    it('(1) hard bounce: only a `bounced` row of THIS address counts, case-insensitively, with no time window', async () => {
        // Arrange
        const bounced = newRecipient();
        const failedOnly = newRecipient();
        const old = new Date('2020-01-01T00:00:00.000Z');
        const base = { template: 'tpl', subject: 'tpl', emailClass: 'transactional' as const };
        await log.recordEmailAttempt({
            ...base,
            outboxId: crypto.randomUUID(),
            recipient: bounced,
            status: 'bounced',
            at: old
        });
        await log.recordEmailAttempt({
            ...base,
            outboxId: crypto.randomUUID(),
            recipient: failedOnly,
            status: 'failed',
            at: new Date()
        });

        // Act / Assert
        expect(await log.hasHardBounce({ recipient: bounced.toUpperCase() })).toBe(true);
        expect(await log.hasHardBounce({ recipient: failedOnly })).toBe(false);
        expect(await log.hasHardBounce({ recipient: newRecipient() })).toBe(false);
    });

    it('(2) deleted account: reads users.deleted_at, null for a live or missing account', async () => {
        // Arrange
        const db = getTestDb();
        const deletedAt = new Date('2026-10-01T10:00:00.000Z');
        const deleted = testData.user({ email: newRecipient(), deletedAt });
        const live = testData.user({ email: newRecipient() });
        createdUserIds.push(deleted.id, live.id);
        await db.insert(users).values([deleted, live]);

        // Act / Assert
        expect(
            (await outbox.getRecipientDeletedAt({ recipientUserId: deleted.id }))?.toISOString()
        ).toBe(deletedAt.toISOString());
        expect(await outbox.getRecipientDeletedAt({ recipientUserId: live.id })).toBeNull();
        expect(
            await outbox.getRecipientDeletedAt({ recipientUserId: crypto.randomUUID() })
        ).toBeNull();
    });

    it('(2) deleted account: a row enqueued before the deletion keeps the address it captured', async () => {
        // Arrange: enqueue, then the deactivation pseudonymizes the account
        const db = getTestDb();
        const original = newRecipient();
        const user = testData.user({ email: original });
        createdUserIds.push(user.id);
        await db.insert(users).values(user);
        const row = await enqueueRow({ recipientEmail: original, recipientUserId: user.id });
        const deletedAt = new Date(row.createdAt.getTime() + 60_000);
        await db
            .update(users)
            .set({ email: `pseudonym-${user.id}@deleted.invalid`, deletedAt })
            .where(eq(users.id, user.id));

        // Act
        const claimed = await claimRow(row.id);
        const accountDeletedAt = await outbox.getRecipientDeletedAt({ recipientUserId: user.id });

        // Assert: enqueued before the deletion, and still addressed to the original
        expect(claimed.recipientEmail).toBe(original);
        expect(accountDeletedAt?.getTime()).toBeGreaterThan(claimed.createdAt.getTime());
    });

    it('(4) daily cap: counts SENT commercial mail to THIS recipient inside the window only', async () => {
        // Arrange
        const recipient = newRecipient();
        const other = newRecipient();
        const now = new Date('2026-10-07T12:00:00.000Z');
        const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const base = { template: 'trial_win_back_5d', subject: 's', outboxId: crypto.randomUUID() };
        const rows = [
            // counted
            { recipient, status: 'sent', emailClass: 'commercial', at: now },
            {
                recipient: recipient.toUpperCase(),
                status: 'sent',
                emailClass: 'commercial',
                at: new Date(since.getTime() + 1)
            },
            // not counted
            {
                recipient,
                status: 'sent',
                emailClass: 'commercial',
                at: new Date(since.getTime() - 1)
            },
            { recipient, status: 'sent', emailClass: 'transactional', at: now },
            { recipient, status: 'failed', emailClass: 'commercial', at: now },
            { recipient, status: 'suppressed', emailClass: 'commercial', at: now },
            { recipient: other, status: 'sent', emailClass: 'commercial', at: now }
        ] as const;
        createdRecipients.push(recipient.toUpperCase());
        for (const r of rows) {
            await log.recordEmailAttempt({ ...base, ...r });
        }

        // Act
        const total = await log.countSentByClassSince({
            recipient,
            emailClass: 'commercial',
            since
        });

        // Assert
        expect(total).toBe(2);
    });
});

describe('TEST:U2:3 recoverExpired wiring: an expired lease goes back to pending and another sender takes it', () => {
    it('releases only expired leases at the run instant, then a new owner claims the row', async () => {
        // Arrange
        const row = await enqueueRow({ recipientEmail: newRecipient() });
        const takenAt = new Date();
        await claimRow(row.id, takenAt);
        const beforeExpiry = new Date(takenAt.getTime() + 299_000);
        const afterExpiry = new Date(takenAt.getTime() + 301_000);

        // Act
        const early = await outbox.recoverExpired({ now: beforeExpiry });
        const late = await outbox.recoverExpired({ now: afterExpiry });
        const reclaimed = await outbox.claim({
            owner: 'sender-2',
            leaseMs: 300_000,
            limit: 1000,
            now: afterExpiry
        });

        // Assert
        expect(early).not.toContain(row.id);
        expect(late).toContain(row.id);
        expect(reclaimed.find((r) => r.id === row.id)?.lockedBy).toBe('sender-2');
    });
});
