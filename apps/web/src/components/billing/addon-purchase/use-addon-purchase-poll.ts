import type { AddonPurchaseReadResponseSchema } from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { visibleApiMessage } from '@/lib/api-errors';
import { purchaseStateFrom } from '@/lib/billing/addon-purchase';

type PurchaseRead = z.infer<typeof AddonPurchaseReadResponseSchema>;

/** Time between two reads of a waiting purchase. */
export const POLL_INTERVAL_MS = 3000;
/** Reads before the screen stops asking and says the result will come by mail (P-1, HOS-2405). */
export const POLL_MAX_ATTEMPTS = 10;

/**
 * Re-reads one of the owner's purchases until it settles or the poll budget runs out
 * (HOS-2179 P-1). The first read goes out at once, because coming back from the provider is
 * what makes the API confirm a waiting one-time payment by id (§5.3 path 2); the later ones
 * are spaced. The return URL's own parameters are never read here.
 *
 * @param input.orderRequestId - The purchase to read; null reads nothing
 * @param input.enabled - Whether the screen is waiting on that purchase
 * @param input.loadError - The copy for a read that failed without an API message
 * @returns The last read, whether the budget ran out, and the last read error
 */
export function useAddonPurchasePoll(input: {
    readonly orderRequestId: string | null;
    readonly enabled: boolean;
    readonly loadError: string;
}): {
    readonly read: PurchaseRead | null;
    readonly exhausted: boolean;
    readonly error: string | null;
} {
    const { orderRequestId, enabled, loadError } = input;
    const [attempt, setAttempt] = useState(0);
    const [read, setRead] = useState<PurchaseRead | null>(null);
    const [error, setError] = useState<string | null>(null);

    // A new purchase to wait on starts its own budget.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the purchase changes
    useEffect(() => {
        setAttempt(0);
        setRead(null);
    }, [orderRequestId]);

    const settled = read !== null && purchaseStateFrom({ read }) !== 'PROCESSING';
    useEffect(() => {
        if (!orderRequestId || !enabled || settled || attempt >= POLL_MAX_ATTEMPTS) return;
        let alive = true;
        const readOnce = async (): Promise<void> => {
            try {
                const result = await billingAddonApi.readPurchase({ orderRequestId });
                if (!alive) return;
                if (result.ok) {
                    setRead(result.data);
                    setError(null);
                } else setError(visibleApiMessage({ error: result.error }) ?? loadError);
            } catch (cause: unknown) {
                if (!alive) return;
                setError(cause instanceof Error ? cause.message : loadError);
            }
            setAttempt((value) => value + 1);
        };
        const timer = window.setTimeout(
            () => {
                void readOnce();
            },
            attempt === 0 ? 0 : POLL_INTERVAL_MS
        );
        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [attempt, enabled, loadError, orderRequestId, settled]);

    return { read, exhausted: attempt >= POLL_MAX_ATTEMPTS && !settled, error };
}
