import { withTransaction } from '@repo/db';
import { sql } from 'drizzle-orm';
import type { ServiceContext } from '../types';

/**
 * Wraps @repo/db's withTransaction to create a properly initialized
 * ServiceContext with a transaction client and empty hookState.
 *
 * Sets a per-transaction statement_timeout via SET LOCAL so each
 * transaction has its own independent timeout that auto-resets on
 * commit or rollback.
 *
 * @param fn - Callback receiving the service context with tx populated
 * @param baseCtx - Optional base context to merge into the transaction ctx
 * @param options - Optional configuration (timeoutMs defaults to 30_000)
 *
 * @example
 * ```ts
 * const result = await withServiceTransaction(async (ctx) => {
 *   const created = await accommodationService.create(actor, data, ctx);
 *   await reviewService.create(actor, reviewData, ctx);
 *   return created;
 * });
 * ```
 */
export async function withServiceTransaction<T>(
    fn: (ctx: ServiceContext) => Promise<T>,
    baseCtx?: Partial<ServiceContext>,
    options?: { timeoutMs?: number }
): Promise<T> {
    return withTransaction(async (tx) => {
        const timeout = options?.timeoutMs ?? 30_000;
        // SET LOCAL scopes the timeout to this transaction only.
        // sql.raw() is safe here: timeout is always a number, never user input.
        await tx.execute(sql`SET LOCAL statement_timeout = ${sql.raw(String(timeout))}`);
        const ctx: ServiceContext = {
            ...baseCtx,
            tx,
            hookState: baseCtx?.hookState ?? {}
        };
        return fn(ctx);
    });
}
