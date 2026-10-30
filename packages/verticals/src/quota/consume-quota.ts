import type { FoldableSource } from '../effective-set/types';
import { selectQuotaGrant } from './quota-grant';
import type { ConsumeQuotaResult, QuotaWindowStore } from './types';
import { computeWindowClose } from './window-close';

export async function consumeQuota(input: {
    readonly store: QuotaWindowStore;
    readonly clock: { now(): Date };
    readonly userId: string;
    readonly vertical: string;
    readonly key: string;
    readonly amount: number;
    readonly sources: readonly FoldableSource[];
}): Promise<ConsumeQuotaResult> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
        throw new RangeError('Quota amount must be a positive safe integer');
    }
    return input.store.withWindowLock({
        userId: input.userId,
        vertical: input.vertical,
        key: input.key,
        run: async ({ findLatest, insertWindow, addConsumed }) => {
            const now = input.clock.now();
            const grant = selectQuotaGrant({ key: input.key, sources: input.sources });
            if (!grant) return { status: 'NOT_METERED' };
            let window = await findLatest();
            const needsNewWindow = !window || window.closesAt <= now;
            const consumed = window && !needsNewWindow ? window.consumed : 0;
            const remaining = Math.max(0, grant.quota - consumed);
            if (input.amount > remaining) return { status: 'EXHAUSTED', remaining };
            if (needsNewWindow) {
                window = await insertWindow({
                    opensAt: now,
                    closesAt: computeWindowClose({ anchor: grant.anchor, opensAt: now })
                });
            }
            if (!window) throw new Error('Quota window was not opened');
            const updated = await addConsumed({ id: window.id, amount: input.amount });
            return { status: 'CONSUMED', remaining: remaining - input.amount, window: updated };
        }
    });
}
