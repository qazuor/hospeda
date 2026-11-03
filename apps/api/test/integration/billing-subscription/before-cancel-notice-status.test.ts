import { emailOutbox, emailOutboxModel, eq, getDb, sql, subscriptions, users } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    beforeCancelNotice,
    beforeCancelNoticeStatus
} from '../../../src/routes/billing-subscription/before-cancel-notice';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const seeded: Array<{ userId: string; subscriptionId: string }> = [];

async function seedNoticeTarget() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `hos1955-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1955 notice status user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('No user');
    const [subscription] = await getDb()
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            status: 'ABANDONED',
            class: 'COMPLEMENTO'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('No subscription');
    seeded.push({ userId: user.id, subscriptionId: subscription.id });
    return { userId: user.id, subscriptionId: subscription.id };
}

describe('TEST:1955:8 AC:1955:1 AC:1955:6 real before-cancel status reader', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        for (const { userId, subscriptionId } of seeded.splice(0)) {
            await getDb().delete(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
            await getDb().delete(subscriptions).where(eq(subscriptions.id, subscriptionId));
            await getDb().delete(users).where(eq(users.id, userId));
        }
    });
    afterAll(async () => testDb.teardown());

    it('has the updated_at trigger on the outbox table (I-1)', async () => {
        const result = await getDb().execute(
            sql`select tgname from pg_trigger where tgrelid = 'email_outbox'::regclass and not tgisinternal`
        );
        const names = result.rows.map((row) => String(row.tgname));
        console.info('email_outbox triggers:', names);
        expect(names.some((name) => name.includes('updated_at'))).toBe(true);
    });

    it('reads the same kind and default occurrence without enqueueing, then maps each status', async () => {
        const target = await seedNoticeTarget();
        const attempt = { ...target, kind: 'ATTEMPT_CANCELLED' as const };
        const ownOutboxRows = () =>
            getDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, target.userId));
        expect(await ownOutboxRows()).toHaveLength(0);
        expect(await beforeCancelNoticeStatus.read(attempt)).toEqual({
            state: 'ABSENT',
            settledAgeMs: null
        });
        expect(await ownOutboxRows()).toHaveLength(0);
        expect(await beforeCancelNotice.beforeCancel(attempt)).toBe('NOT_YET_SENT');
        expect(await ownOutboxRows()).toHaveLength(1);
        expect((await beforeCancelNoticeStatus.read(attempt)).state).toBe('PENDING');
        expect(await ownOutboxRows()).toHaveLength(1);
        expect(
            await beforeCancelNoticeStatus.read({ ...target, kind: 'AUTHORIZATION_EXPIRED' })
        ).toEqual({
            state: 'ABSENT',
            settledAgeMs: null
        });
        const [row] = await ownOutboxRows();
        if (!row) throw new Error('No outbox row');
        const owner = `hos1955-${crypto.randomUUID()}`;
        const claimed = await emailOutboxModel.claim({ owner, limit: 1, leaseMs: 60_000 });
        expect(claimed.map(({ id }) => id)).toContain(row.id);
        expect((await beforeCancelNoticeStatus.read(attempt)).state).toBe('PENDING');
        expect(
            await emailOutboxModel.markSent({
                id: row.id,
                owner,
                providerMessageId: 'hos1955-test'
            })
        ).toBe(true);
        const sent = await beforeCancelNoticeStatus.read(attempt);
        expect(sent.state).toBe('SENT');
        expect(sent.settledAgeMs).toBeGreaterThanOrEqual(0);
        expect(sent.settledAgeMs).toBeLessThan(60_000);
        const realNow = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(realNow + 7_200_000);
        const databaseAge = await beforeCancelNoticeStatus.read(attempt);
        expect(databaseAge.settledAgeMs).toBeLessThan(60_000);
        vi.restoreAllMocks();
        for (const status of ['retry', 'processing'] as const) {
            await getDb()
                .update(emailOutbox)
                .set({
                    status,
                    lockedBy: status === 'processing' ? owner : null,
                    lockedUntil: status === 'processing' ? new Date(Date.now() + 60_000) : null
                })
                .where(eq(emailOutbox.id, row.id));
            expect((await beforeCancelNoticeStatus.read(attempt)).state).toBe('PENDING');
        }
        for (const lastError of ['undeliverable:hard_bounce', 'transient exhaustion']) {
            await getDb()
                .update(emailOutbox)
                .set({ status: 'failed', lastError, lockedBy: null, lockedUntil: null })
                .where(eq(emailOutbox.id, row.id));
            expect((await beforeCancelNoticeStatus.read(attempt)).state).toBe('UNDELIVERABLE');
        }
    });
});
