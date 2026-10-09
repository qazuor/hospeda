import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    quotaWindows,
    type SelectQuotaWindow
} from '../../schemas/vertical/quota-window.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

export interface QuotaWindowOperations {
    findLatest(): Promise<SelectQuotaWindow | null>;
    insertWindow(input: {
        readonly opensAt: Date;
        readonly closesAt: Date;
    }): Promise<SelectQuotaWindow>;
    addConsumed(input: {
        readonly id: string;
        readonly amount: number;
    }): Promise<SelectQuotaWindow>;
}

/** Serializes all window reads and writes for one user, vertical and key. */
export class QuotaWindowModel {
    async withWindowLock<T>(input: {
        readonly userId: string;
        readonly vertical: string;
        readonly key: string;
        readonly tx?: DrizzleClient;
        readonly run: (operations: QuotaWindowOperations) => Promise<T>;
    }): Promise<T> {
        const { userId, vertical, key } = input;
        return (input.tx ?? getDb()).transaction(async (tx) => {
            await tx.execute(
                sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId} || ':' || ${vertical} || ':' || ${key}, 0))`
            );
            return input.run({
                findLatest: async () => {
                    const rows = await tx
                        .select()
                        .from(quotaWindows)
                        .where(
                            and(
                                eq(quotaWindows.userId, userId),
                                eq(quotaWindows.vertical, vertical),
                                eq(quotaWindows.key, key)
                            )
                        )
                        .orderBy(desc(quotaWindows.opensAt))
                        .limit(1);
                    return rows[0] ?? null;
                },
                insertWindow: async ({ opensAt, closesAt }) => {
                    const rows = await tx
                        .insert(quotaWindows)
                        .values({ userId, vertical, key, opensAt, closesAt })
                        .returning();
                    const row = rows[0];
                    if (!row) throw new Error('Quota window insert returned no row');
                    return row;
                },
                addConsumed: async ({ id, amount }) => {
                    const rows = await tx
                        .update(quotaWindows)
                        .set({ consumed: sql`${quotaWindows.consumed} + ${amount}` })
                        .where(
                            and(
                                eq(quotaWindows.id, id),
                                eq(quotaWindows.userId, userId),
                                eq(quotaWindows.vertical, vertical),
                                eq(quotaWindows.key, key)
                            )
                        )
                        .returning();
                    const row = rows[0];
                    if (!row) throw new Error('Quota window update returned no row');
                    return row;
                }
            });
        });
    }
}

export const quotaWindowModel = new QuotaWindowModel();
