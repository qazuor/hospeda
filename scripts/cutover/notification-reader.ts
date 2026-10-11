import type { ReadOnlyClient } from './known-ids.ts';
import { connectReadOnly } from './known-ids.ts';
import type { DeliveryChannel, DeliveryReader } from './types.ts';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DELIVERY_SEEN_SQL = `
    SELECT 1 FROM provider_notification
    WHERE channel = $1
      AND (url || chr(10) || body) ~ ('(^|[^A-Za-z0-9_-])' || $2 || '([^A-Za-z0-9_-]|$)')
    LIMIT 1`;

/**
 * Reads the new database in a read-only transaction and returns only whether a delivery exists.
 * This query is exempt from G17(c) because it lives under `scripts/cutover/` (U3.3).
 */
export async function readDeliverySeen({
    client,
    channel,
    resourceId
}: {
    readonly client: ReadOnlyClient;
    readonly channel: DeliveryChannel;
    readonly resourceId: string;
}): Promise<boolean> {
    if (!SAFE_ID.test(resourceId)) throw new Error('invalid delivery resource id');
    await client.query('BEGIN READ ONLY');
    try {
        const result = await client.query(DELIVERY_SEEN_SQL, [channel, resourceId]);
        return result.rows.length > 0;
    } finally {
        await client.query('ROLLBACK');
    }
}

/** Opens a read-only connection per lookup and always closes it after the boolean result. */
export function createDeliveryReader({
    connectionString
}: {
    readonly connectionString: string;
}): DeliveryReader {
    return async ({ channel, resourceId }) => {
        const client = await connectReadOnly({ connectionString });
        try {
            return await readDeliverySeen({ client, channel, resourceId });
        } finally {
            await client.end();
        }
    };
}
