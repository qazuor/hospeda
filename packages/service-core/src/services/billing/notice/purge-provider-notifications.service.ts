import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';

/** Technical retention window for received provider deliveries. */
export const PROVIDER_NOTIFICATION_RETENTION_DAYS = 180;
const logger = createLogger('provider-delivery-retention');

/** Deletes deliveries older than the fixed technical retention window. */
export async function purgeProviderNotifications(
    _input: Record<string, never>,
    ports: { readonly clock: Clock }
): Promise<{ readonly deleted: number; readonly cutoff: Date }> {
    const cutoff = new Date(
        ports.clock.now().getTime() - PROVIDER_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const { providerNotificationModel } = await import('@repo/db');
    const { deleted } = await providerNotificationModel.deleteReceivedBefore({ cutoff });
    logger.info({ deleted }, 'Provider delivery retention pass completed');
    return { deleted, cutoff };
}
