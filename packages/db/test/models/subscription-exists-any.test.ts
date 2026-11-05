import { describe, expect, it, vi } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import type { DrizzleClient } from '../../src/types.ts';

function fakeDb(rows: readonly { readonly id: string }[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as DrizzleClient, select, from, where, limit };
}

describe('SubscriptionModel.existsAnyForUser', () => {
    it('returns true when any history row exists', async () => {
        const { db, select, from, where, limit } = fakeDb([{ id: 'subscription-1' }]);
        const model = new SubscriptionModel();
        await expect(
            model.existsAnyForUser({ userId: 'user-1', vertical: 'accommodation', tx: db })
        ).resolves.toBe(true);
        expect(select).toHaveBeenCalledTimes(1);
        expect(from).toHaveBeenCalledTimes(1);
        expect(where).toHaveBeenCalledTimes(1);
        const condition = where.mock.calls[0]?.[0];
        expect(condition).toBeDefined();
        const columnNames: string[] = [];
        const collectColumnNames = (part: unknown): void => {
            if (!part || typeof part !== 'object') return;
            if ('name' in part && typeof part.name === 'string') columnNames.push(part.name);
            if ('queryChunks' in part && Array.isArray(part.queryChunks)) {
                part.queryChunks.forEach(collectColumnNames);
            }
        };
        collectColumnNames(condition);
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('vertical');
        expect(columnNames).toContain('status');
        const fragments: string[] = [];
        const visited = new WeakSet<object>();
        const collectSql = (part: unknown): void => {
            if (typeof part === 'string') {
                fragments.push(part);
                return;
            }
            if (!part || typeof part !== 'object' || visited.has(part)) return;
            visited.add(part);
            if (Array.isArray(part)) {
                part.forEach(collectSql);
                return;
            }
            if ('value' in part) collectSql(part.value);
            if ('queryChunks' in part) collectSql(part.queryChunks);
        };
        collectSql(condition);
        expect(fragments.join(' ')).toContain('not in');
        expect(fragments.join(' ')).toContain('PENDING_AUTHORIZATION');
        expect(fragments.join(' ')).toContain('ABANDONED');
        expect(fragments.join(' ')).toContain('CHARGE_DECLINED');
        expect(limit).toHaveBeenCalledWith(1);
    });

    it('returns false when the user has no history rows', async () => {
        const { db } = fakeDb([]);
        await expect(
            new SubscriptionModel().existsAnyForUser({
                userId: 'user-1',
                vertical: 'accommodation',
                tx: db
            })
        ).resolves.toBe(false);
    });
});
