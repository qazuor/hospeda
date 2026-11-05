import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import { SUBSCRIPTION_STATUSES } from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';

const NEVER_COMPLETED = ['PENDING_AUTHORIZATION', 'ABANDONED', 'CHARGE_DECLINED'] as const;

function fakeDb(rows: readonly { readonly id: string }[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as DrizzleClient, where, limit };
}

/** Renders the WHERE clause the model built into SQL text plus bound params. */
async function renderPredicate() {
    const { db, where } = fakeDb([]);
    await new SubscriptionModel().existsAnyForUser({
        userId: 'user-1',
        vertical: 'accommodation',
        tx: db
    });
    const condition = (where.mock.calls[0] as unknown[])[0] as Parameters<
        PgDialect['sqlToQuery']
    >[0];
    return new PgDialect().sqlToQuery(condition);
}

describe('SubscriptionModel.existsAnyForUser', () => {
    it('returns true when a history row exists and false when none does', async () => {
        const hit = fakeDb([{ id: 'subscription-1' }]);
        const miss = fakeDb([]);
        const input = { userId: 'user-1', vertical: 'accommodation' };
        await expect(
            new SubscriptionModel().existsAnyForUser({ ...input, tx: hit.db })
        ).resolves.toBe(true);
        await expect(
            new SubscriptionModel().existsAnyForUser({ ...input, tx: miss.db })
        ).resolves.toBe(false);
        expect(hit.limit).toHaveBeenCalledWith(1);
    });

    it('scopes the lookup to the user and the vertical', async () => {
        const { sql, params } = await renderPredicate();
        expect(sql).toContain('"user_id" = $1');
        expect(sql).toContain('"vertical" = $2');
        expect(params.slice(0, 2)).toEqual(['user-1', 'accommodation']);
    });

    it('excludes exactly the never-completed checkout statuses, not the real ones', async () => {
        const { sql, params } = await renderPredicate();
        expect(sql).toContain('"status" not in');
        expect(params.slice(2)).toEqual([...NEVER_COMPLETED]);
    });

    it.each(
        SUBSCRIPTION_STATUSES
    )('classifies %s by the rendered exclusion list', async (status) => {
        const { params } = await renderPredicate();
        const excluded = new Set(params.slice(2));
        const countsAsHistory = !excluded.has(status);
        const expected = !(NEVER_COMPLETED as readonly string[]).includes(status);
        expect(countsAsHistory).toBe(expected);
    });
});
