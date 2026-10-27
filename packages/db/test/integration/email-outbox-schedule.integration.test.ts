import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { EmailOutboxModel } from '../../src/models/email-outbox/email-outbox.model.ts';
import { buildEmailDedupKey } from '../../src/models/email-outbox/email-outbox-dedup-key.ts';
import {
    enqueueOrMergeScheduledEmail,
    withdrawScheduledEmails
} from '../../src/models/email-outbox/email-outbox-schedule.ts';
import { emailOutbox } from '../../src/schemas/email-outbox/email_outbox.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

const model = new EmailOutboxModel();

beforeAll(() => setDb(getTestDb()));
afterAll(closeTestPool);

describe('TEST:AC:U2 scheduled outbox queue', () => {
    it('claims only rows whose send-after instant is due', async () => {
        await withTestTransaction(async (tx) => {
            const [user] = await tx.insert(users).values(testData.user()).returning();
            if (!user) throw new Error('test user was not inserted');
            const now = new Date('2026-10-11T12:00:00.000Z');
            const rows = await Promise.all([
                model.enqueue(
                    {
                        recipientUserId: user.id,
                        recipientEmail: user.email,
                        template: 'due',
                        dedupKey: key(user.id, 'due'),
                        sendAfter: new Date('2026-10-11T11:00:00.000Z')
                    },
                    tx as unknown as DrizzleClient
                ),
                model.enqueue(
                    {
                        recipientUserId: user.id,
                        recipientEmail: user.email,
                        template: 'null',
                        dedupKey: key(user.id, 'null')
                    },
                    tx as unknown as DrizzleClient
                ),
                model.enqueue(
                    {
                        recipientUserId: user.id,
                        recipientEmail: user.email,
                        template: 'future',
                        dedupKey: key(user.id, 'future'),
                        sendAfter: new Date('2026-10-11T13:00:00.000Z')
                    },
                    tx as unknown as DrizzleClient
                )
            ]);
            const claimed = await model.claim({
                owner: crypto.randomUUID(),
                leaseMs: 60_000,
                limit: 10_000,
                now,
                tx: tx as unknown as DrizzleClient
            });
            const ids = claimed.map((row) => row.id);
            expect(ids).toContain(rows[0].row?.id);
            expect(ids).toContain(rows[1].row?.id);
            expect(ids).not.toContain(rows[2].row?.id);
        });
    });

    it('merges pending verticals in sorted order, refuses sent rows, and withdraws safely', async () => {
        await withTestTransaction(async (tx) => {
            const [firstUser, otherUser] = await tx
                .insert(users)
                .values([testData.user(), testData.user()])
                .returning();
            if (!firstUser || !otherUser) throw new Error('test users were not inserted');
            const common = {
                tx: tx as unknown as DrizzleClient,
                recipientUserId: firstUser.id,
                recipientEmail: firstUser.email,
                template: 'scheduled',
                dedupKey: key(firstUser.id, 'shared'),
                sendAfter: new Date('2026-10-12T03:00:00.000Z'),
                payload: { campaign: 'RECOVERY' }
            };
            expect(await enqueueOrMergeScheduledEmail({ ...common, vertical: 'venue' })).toEqual({
                outcome: 'inserted'
            });
            expect(
                await enqueueOrMergeScheduledEmail({ ...common, vertical: 'accommodation' })
            ).toEqual({ outcome: 'merged' });
            expect(await enqueueOrMergeScheduledEmail({ ...common, vertical: 'venue' })).toEqual({
                outcome: 'merged'
            });
            const [shared] = await tx
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, common.dedupKey));
            expect(shared?.payload.verticals).toEqual(['accommodation', 'venue']);
            await tx
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.dedupKey, common.dedupKey));
            expect(
                await enqueueOrMergeScheduledEmail({ ...common, vertical: 'experience' })
            ).toEqual({ outcome: 'refused' });

            const two = {
                ...common,
                dedupKey: key(firstUser.id, 'two'),
                vertical: 'accommodation'
            };
            await enqueueOrMergeScheduledEmail(two);
            await enqueueOrMergeScheduledEmail({ ...two, vertical: 'venue' });
            const only = { ...two, dedupKey: key(firstUser.id, 'only') };
            await enqueueOrMergeScheduledEmail(only);
            expect(
                await withdrawScheduledEmails({
                    tx: common.tx,
                    recipientUserId: firstUser.id,
                    templates: ['scheduled'],
                    vertical: 'accommodation',
                    reason: 'trial-converted'
                })
            ).toEqual({ withdrawn: 2, cancelled: 1 });
            const [remaining] = await tx
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, two.dedupKey));
            expect(remaining?.status).toBe('pending');
            expect(remaining?.payload.verticals).toEqual(['venue']);
            const [cancelled] = await tx
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, only.dedupKey));
            expect(cancelled?.status).toBe('failed');
            expect(cancelled?.lastError).toBe('cancelled:trial-converted');
            const [sent] = await tx
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.dedupKey, common.dedupKey));
            expect(sent?.status).toBe('sent');

            const isolated = {
                ...common,
                recipientUserId: otherUser.id,
                recipientEmail: otherUser.email,
                dedupKey: key(otherUser.id, 'isolated'),
                template: 'other'
            };
            await enqueueOrMergeScheduledEmail({ ...isolated, vertical: 'accommodation' });
            const otherTemplate = {
                ...two,
                template: 'different-template',
                dedupKey: key(firstUser.id, 'different')
            };
            await enqueueOrMergeScheduledEmail(otherTemplate);
            expect(
                await withdrawScheduledEmails({
                    tx: common.tx,
                    recipientUserId: otherUser.id,
                    templates: ['scheduled'],
                    vertical: 'accommodation',
                    reason: 'trial-converted'
                })
            ).toEqual({ withdrawn: 0, cancelled: 0 });
            expect(
                await withdrawScheduledEmails({
                    tx: common.tx,
                    recipientUserId: firstUser.id,
                    templates: ['different-template'],
                    vertical: 'accommodation',
                    reason: 'trial-converted'
                })
            ).toEqual({ withdrawn: 1, cancelled: 1 });
            await expect(
                enqueueOrMergeScheduledEmail({ ...common, vertical: 'BAD' })
            ).rejects.toThrow();
            await expect(
                withdrawScheduledEmails({
                    tx: common.tx,
                    recipientUserId: firstUser.id,
                    templates: [],
                    vertical: 'accommodation',
                    reason: 'trial-converted'
                })
            ).rejects.toThrow();
            await expect(
                withdrawScheduledEmails({
                    tx: common.tx,
                    recipientUserId: firstUser.id,
                    templates: ['scheduled'],
                    vertical: 'accommodation',
                    reason: 'invalid reason'
                })
            ).rejects.toThrow();
        });
    });
});

function key(recipient: string, suffix: string): string {
    return buildEmailDedupKey({
        recipient,
        template: suffix,
        occurrence: `trial:${crypto.randomUUID()}:pre:-2d:2026-10-11`
    });
}
