import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { eq, getDb, partners } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { type CoverageNoticeRegistry, getRevalidationService } from '@repo/service-core';
import { invalidateCacheByPathPrefix } from '../../middlewares/cache';
import { apiLogger } from '../logger';

const registeredRegistries = new WeakSet<CoverageNoticeRegistry>();

/** Revalidates the public Partner surfaces after its billing coverage changes. */
async function revalidatePartnerPresence(event: CoverageChangedEvent): Promise<void> {
    if (event.vertical !== VerticalEnum.PARTNER) return;

    try {
        const [partner] = await getDb()
            .select({ id: partners.id, slug: partners.slug })
            .from(partners)
            .where(eq(partners.ownerUserId, event.userId))
            .limit(1);
        if (!partner) return;

        try {
            getRevalidationService()?.scheduleRevalidation({
                entityType: 'partner',
                id: partner.id,
                slug: partner.slug
            });
        } catch (error) {
            apiLogger.warn(
                { error, partnerId: partner.id },
                '[partner-billing] edge revalidation scheduling failed'
            );
        }
        invalidateCacheByPathPrefix({ pathPrefix: '/api/v1/public/partners' });
    } catch (error) {
        apiLogger.warn(
            { error, userId: event.userId },
            '[partner-billing] public presence invalidation failed'
        );
    }
}

/** Registers one Partner visibility listener on the process coverage registry. */
export function registerPartnerCoverageRevalidation(registry: CoverageNoticeRegistry): void {
    if (registeredRegistries.has(registry)) return;
    registry.onCoverageChanged(revalidatePartnerPresence);
    registeredRegistries.add(registry);
}
