/**
 * TEST:U2:2 (HOS-1425, AC:U2:2) — enqueue a mail for an account, deactivate
 * the account (the deactivation writes a pseudonym into its address) and run
 * the sender: the mail leaves to the address the outbox row captured at
 * enqueue, never to the one the account holds when it goes out.
 *
 * Real PostgreSQL (the ephemeral DB of `global-setup.ts`), the real models and
 * the real `processEmailOutboxBatch`. Only the transport and the reporting
 * hooks are fakes, because what is asserted is the address the transport gets.
 *
 * The contrast case pins the other half of AC:U2:7 (2): a row enqueued AFTER
 * the deactivation is suppressed as `account_deleted` and never reaches the
 * transport, which proves the deleted-account read really ran on the first one.
 *
 * Mutation: making the sender read the account's current address instead of
 * `row.recipientEmail` turns the first assertion red.
 */

import {
    buildEmailDedupKey,
    emailOutbox,
    emailOutboxModel,
    notificationLog,
    notificationLogModel,
    users
} from '@repo/db';
import {
    type EmailTransport,
    OUTBOX_LAST_ERROR_MARKERS,
    processEmailOutboxBatch
} from '@repo/notifications';
import { eq, inArray } from 'drizzle-orm';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const createdDedupKeys: string[] = [];
const createdUserIds: string[] = [];
const createdRecipients: string[] = [];

async function enqueueFor(input: { readonly userId: string; readonly email: string }) {
    const dedupKey = buildEmailDedupKey({
        recipient: input.userId,
        template: 'welcome',
        occurrence: `event:${crypto.randomUUID()}`
    });
    createdDedupKeys.push(dedupKey);
    const { row } = await emailOutboxModel.enqueue({
        recipientUserId: input.userId,
        recipientEmail: input.email,
        template: 'welcome',
        dedupKey
    });
    if (!row) throw new Error('enqueue wrote no row');
    return row;
}

async function runSender(send: EmailTransport['send']) {
    return processEmailOutboxBatch({
        deps: {
            outbox: emailOutboxModel,
            log: notificationLogModel,
            isOptedOut: async () => false,
            render: () => ({ subject: 's', react: {} as ReactElement }),
            transport: { send },
            escalate: vi.fn(),
            onRowError: vi.fn(),
            onLeaseLost: vi.fn()
        },
        owner: 'u2-2-it',
        now: new Date(),
        leaseMs: 300_000,
        batchSize: 1000
    });
}

describe('TEST:U2:2 the mail leaves to the address captured at enqueue', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    afterEach(async () => {
        const db = testDb.getDb();
        if (createdRecipients.length > 0) {
            await db
                .delete(notificationLog)
                .where(inArray(notificationLog.recipient, createdRecipients));
            createdRecipients.length = 0;
        }
        if (createdDedupKeys.length > 0) {
            await db.delete(emailOutbox).where(inArray(emailOutbox.dedupKey, createdDedupKeys));
            createdDedupKeys.length = 0;
        }
        if (createdUserIds.length > 0) {
            await db.delete(users).where(inArray(users.id, createdUserIds));
            createdUserIds.length = 0;
        }
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('sends to the enqueued address after the account is pseudonymized, and suppresses what is enqueued after', async () => {
        // Arrange: an account and a mail enqueued for it
        const db = testDb.getDb();
        const userId = crypto.randomUUID();
        const original = `u2-2-${userId}@example.com`;
        const pseudonym = `deleted-${userId}@pseudonym.invalid`;
        createdUserIds.push(userId);
        createdRecipients.push(original, pseudonym);
        await db.insert(users).values({
            id: userId,
            displayName: 'U2-2 Recipient',
            email: original,
            emailVerified: true
        });
        const before = await enqueueFor({ userId, email: original });

        // the deactivation writes a pseudonym and stamps deleted_at
        await db
            .update(users)
            .set({ email: pseudonym, deletedAt: new Date(before.createdAt.getTime() + 1) })
            .where(eq(users.id, userId));
        await new Promise((resolve) => setTimeout(resolve, 20));
        const after = await enqueueFor({ userId, email: pseudonym });
        const send = vi.fn<EmailTransport['send']>(async () => ({ messageId: `msg-${userId}` }));

        // Act
        await runSender(send);

        // Assert: the row enqueued before left to the captured address, once
        const toThisAccount = send.mock.calls
            .map(([mail]) => mail.to)
            .filter((to) => to === original || to === pseudonym);
        expect(toThisAccount).toEqual([original]);
        const rows: ReadonlyArray<typeof emailOutbox.$inferSelect> = await db
            .select()
            .from(emailOutbox)
            .where(inArray(emailOutbox.id, [before.id, after.id]));
        const sent = rows.find((r) => r.id === before.id);
        const suppressed = rows.find((r) => r.id === after.id);
        expect(sent?.status).toBe('sent');
        expect(sent?.providerMessageId).toBe(`msg-${userId}`);
        expect(suppressed?.status).toBe('failed');
        expect(suppressed?.lastError).toBe(OUTBOX_LAST_ERROR_MARKERS.ACCOUNT_DELETED);
    });
});
