import { emailOutbox, eq, getDb, inArray, users } from '@repo/db';
import type { ArrearsSuspensionNoticeContent } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const seededUserIds: string[] = [];

async function seedUser() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b7-arrears-${crypto.randomUUID()}@example.test`,
            displayName: 'B7 arrears user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    seededUserIds.push(user.id);
    return user;
}

/** A test content of the arrears suspension notice (AC:B7:30). */
const CONTENT: ArrearsSuspensionNoticeContent = {
    vertical: 'accommodation',
    paymentMethod: 'CARD',
    touristVipLost: true,
    oneTimeAddons: [{ name: 'Destacado 30 días', remainingDays: 10 }],
    promoLost: true
};

async function outboxOf(userId: string) {
    return getDb().select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
}

describe('AC:B7:7 — the arrears suspension notice is keyed by the clock that expired', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(async () => {
        const ids = seededUserIds.splice(0);
        if (ids.length === 0) return;
        await getDb().delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, ids));
        await getDb().delete(users).where(inArray(users.id, ids));
    });
    afterAll(async () => testDb.teardown());

    it('enqueues one billing.arrears-suspension row per expiry occurrence', async () => {
        const user = await seedUser();
        const subscriptionId = crypto.randomUUID();
        const first = {
            subscriptionId,
            userId: user.id,
            kind: 'ARREARS_SUSPENSION' as const,
            occurrenceId: `${subscriptionId}:grace-expired:2026-10-15T03:00:00.000Z`,
            content: CONTENT
        };
        expect(await beforeCancelNotice.beforeCancel(first)).toBe('NOT_YET_SENT');
        expect(await beforeCancelNotice.beforeCancel(first)).toBe('NOT_YET_SENT');
        const once = await outboxOf(user.id);
        expect(once).toHaveLength(1);
        expect(once[0]?.template).toBe('billing.arrears-suspension');
        expect(once[0]?.payload).toEqual({
            subscriptionId,
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            touristVipLost: true,
            oneTimeAddons: [{ name: 'Destacado 30 días', remainingDays: 10 }],
            promoLost: true
        });

        expect(
            await beforeCancelNotice.beforeCancel({
                ...first,
                occurrenceId: `${subscriptionId}:grace-expired:2026-12-15T03:00:00.000Z`
            })
        ).toBe('NOT_YET_SENT');
        const twice = await outboxOf(user.id);
        expect(twice).toHaveLength(2);
        expect(new Set(twice.map((row) => row.dedupKey)).size).toBe(2);
        expect(twice.every((row) => row.template === 'billing.arrears-suspension')).toBe(true);
    });

    it('keeps the subscription-keyed billing.before-cancel row without an occurrence', async () => {
        const user = await seedUser();
        const subscriptionId = crypto.randomUUID();
        await beforeCancelNotice.beforeCancel({
            subscriptionId,
            userId: user.id,
            kind: 'AUTHORIZATION_EXPIRED'
        });
        await beforeCancelNotice.beforeCancel({
            subscriptionId,
            userId: user.id,
            kind: 'AUTHORIZATION_EXPIRED',
            occurrenceId: subscriptionId
        });
        const rows = await outboxOf(user.id);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.template).toBe('billing.before-cancel');
        expect(rows[0]?.payload).toEqual({ subscriptionId });
    });

    it('AC:B7:30 — without content the arrears payload stays { subscriptionId }', async () => {
        const user = await seedUser();
        const subscriptionId = crypto.randomUUID();
        await beforeCancelNotice.beforeCancel({
            subscriptionId,
            userId: user.id,
            kind: 'ARREARS_SUSPENSION',
            occurrenceId: `${subscriptionId}:grace-expired:2026-10-15T03:00:00.000Z`
        });
        const rows = await outboxOf(user.id);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.template).toBe('billing.arrears-suspension');
        expect(rows[0]?.payload).toEqual({ subscriptionId });
    });

    it('reads the four delivery outcomes of the arrears notice', async () => {
        const user = await seedUser();
        const subscriptionId = crypto.randomUUID();
        const input = {
            subscriptionId,
            userId: user.id,
            kind: 'ARREARS_SUSPENSION' as const,
            occurrenceId: `${subscriptionId}:grace-expired:2026-10-15T03:00:00.000Z`
        };
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NOT_YET_SENT');
        const [row] = await outboxOf(user.id);
        if (!row) throw new Error('Notice was not enqueued');
        await getDb().update(emailOutbox).set({ status: 'sent' }).where(eq(emailOutbox.id, row.id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('SENT');
        await getDb()
            .update(emailOutbox)
            .set({ status: 'failed', lastError: 'undeliverable:retries_exhausted' })
            .where(eq(emailOutbox.id, row.id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('DELIVERY_EXHAUSTED');
        await getDb()
            .update(emailOutbox)
            .set({ lastError: 'undeliverable:hard_bounce' })
            .where(eq(emailOutbox.id, row.id));
        expect(await beforeCancelNotice.beforeCancel(input)).toBe('NO_RECIPIENT');
        expect(await outboxOf(user.id)).toHaveLength(1);
    });
});
