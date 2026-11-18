import { CACHE_TAG_PARTNER_TYPES } from '@repo/cache-tags';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';

/**
 * Purges the partner type catalog cache tag (`CACHE_TAG_PARTNER_TYPES`)
 * through the shared revalidation fan-out (HOS-2336, AC-3.7).
 *
 * The tag is carried by the public partner-types endpoint AND by every public
 * partner page (they render the type name), so one purge refreshes both after
 * a rename. Called once per admin write, AFTER the write succeeded. Best
 * effort: a purge failure, or a revalidation service that was never
 * initialized, must not fail the write that already committed, so it never
 * throws.
 *
 * @param params.triggeredBy - Actor id recorded in the revalidation audit log.
 * @returns Resolves once the purge attempt finished (successfully or not).
 */
export async function purgePartnerTypesCache({
    triggeredBy
}: {
    readonly triggeredBy?: string;
}): Promise<void> {
    try {
        const service = getRevalidationService();
        if (!service) return;
        await service.revalidateTags({
            tags: [CACHE_TAG_PARTNER_TYPES],
            triggeredBy,
            trigger: 'hook',
            entityType: 'partner_type'
        });
    } catch {
        // Best effort by design: the write already committed.
    }
}
