import { OwnerRecurringAddonsResponseSchema } from '@repo/schemas';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { parseOwnSubscriptions } from '@/lib/billing/self-cancel';

const TTL_MS = 60_000;
const cache = new Map<string, { readonly value: boolean; readonly expiresAt: number }>();
const inflight = new Map<string, Promise<boolean>>();

/** Cached subscription or active add-on presence, scoped by user; failed reads hide the entry. */
export async function hasBillingPresence({
    userId,
    cookieHeader
}: {
    readonly userId: string;
    readonly cookieHeader?: string;
}): Promise<boolean> {
    if (!userId || !cookieHeader) return false;
    const now = Date.now();
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > now) return cached.value;
    const pending = inflight.get(userId);
    if (pending) return pending;
    const read = async (): Promise<boolean> => {
        let value = false;
        try {
            const parsed = parseOwnSubscriptions({
                result: await billingSubscriptionApi.listMine({ cookieHeader })
            });
            value = parsed !== null && parsed.subscriptions.length > 0;
            // Only query add-ons when a valid subscription read is empty.
            if (parsed !== null && !value) {
                const result = await billingAddonApi.listRecurringAddons({ cookieHeader });
                const addons = result.ok
                    ? OwnerRecurringAddonsResponseSchema.safeParse(result.data)
                    : null;
                value =
                    addons?.success === true &&
                    addons.data.items.some((item) => item.status === 'ACTIVE');
            }
        } catch {
            value = false;
        }
        // Evict expired entries instead of retaining every account the process has seen.
        for (const [key, entry] of cache) {
            if (entry.expiresAt <= Date.now()) cache.delete(key);
        }
        cache.set(userId, { value, expiresAt: Date.now() + TTL_MS });
        return value;
    };
    const request = read().finally(() => inflight.delete(userId));
    inflight.set(userId, request);
    return request;
}
