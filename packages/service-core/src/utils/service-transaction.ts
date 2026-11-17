import type { ServiceContext, ServiceOutput } from '../types';
import { ServiceError } from '../types';
import { withServiceTransaction } from './transaction';

/**
 * Runs a service write inside ONE transaction: the caller's when `ctx.tx` is
 * set (joined, never replaced), a new one otherwise.
 *
 * Once a transaction is present the base write methods RE-THROW their errors,
 * which is what rolls the row back together with the rest of the unit of work.
 * On a transaction this function opened itself, that rejection is converted
 * back into the usual `{ error }` output, so callers keep the `ServiceOutput`
 * contract whether or not they passed a transaction.
 *
 * @param ctx - Optional caller context. A supplied `tx` is joined.
 * @param run - The work, receiving a context whose `tx` is always set.
 * @returns The output of `run`, or `{ error }` when a `ServiceError` aborted
 *   the transaction this function opened.
 *
 * @example
 * ```ts
 * public override async softDelete(actor: Actor, id: string, ctx?: ServiceContext) {
 *     return runInServiceTransaction(ctx, (txCtx) => super.softDelete(actor, id, txCtx));
 * }
 * ```
 */
export async function runInServiceTransaction<T>(
    ctx: ServiceContext | undefined,
    run: (txCtx: ServiceContext) => Promise<ServiceOutput<T>>
): Promise<ServiceOutput<T>> {
    if (ctx?.tx) return run(ctx);
    try {
        return await withServiceTransaction(run, ctx);
    } catch (error) {
        if (error instanceof ServiceError) return { error };
        throw error;
    }
}
