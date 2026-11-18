import { CACHE_TAG_HOST_TRADE_CATEGORIES } from '@repo/cache-tags';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';

/**
 * Purges the provider trade catalog cache tag (`CACHE_TAG_HOST_TRADE_CATEGORIES`)
 * through the shared revalidation fan-out (HOS-919).
 *
 * The catalog (groups, categories, keywords) is one document that changes as a
 * whole, so every admin write on either table calls this once, AFTER the write
 * succeeded. It is best effort: a purge failure, or a revalidation service that
 * was never initialized, must not fail the write that already committed, so it
 * logs nothing fatal and never throws.
 *
 * @param params.triggeredBy - Actor id recorded in the revalidation audit log.
 * @returns Resolves once the purge attempt finished (successfully or not).
 */
export async function purgeHostTradeCategoriesCache({
    triggeredBy
}: {
    readonly triggeredBy?: string;
}): Promise<void> {
    try {
        const service = getRevalidationService();
        if (!service) return;
        await service.revalidateTags({
            tags: [CACHE_TAG_HOST_TRADE_CATEGORIES],
            triggeredBy,
            trigger: 'hook',
            entityType: 'host_trade_category'
        });
    } catch {
        // Best effort by design: the write already committed.
    }
}
