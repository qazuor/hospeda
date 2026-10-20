import { sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import type {
    ProviderNotificationChannel,
    SelectProviderNotification
} from '../../schemas/vertical/provider-notification.dbschema.ts';
import { providerNotifications } from '../../schemas/vertical/provider-notification.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Write-only persistence for deliveries; G17(c) forbids every read of this table. */
export class ProviderNotificationModel {
    /** Appends one delivery. Repeated deliveries remain separate rows. */
    async insertDelivery(input: {
        readonly channel: ProviderNotificationChannel;
        readonly url: string;
        readonly body: string;
        readonly receivedAt: Date;
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderNotification> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .insert(providerNotifications)
            .values({
                channel: input.channel,
                url: input.url,
                body: input.body,
                receivedAt: input.receivedAt
            })
            .returning();
        if (!row) throw new Error('Provider notification insert returned no row');
        return row;
    }

    /** Deletes deliveries strictly older than the retention cutoff. */
    async deleteReceivedBefore(input: {
        readonly cutoff: Date;
        readonly tx?: DrizzleClient;
    }): Promise<{ deleted: number }> {
        const db = input.tx ?? getDb();
        const rows = await db
            .delete(providerNotifications)
            .where(sql`"received_at" < ${input.cutoff}`)
            .returning();
        return { deleted: rows.length };
    }
}

/** Shared write-only provider notification model. */
export const providerNotificationModel = new ProviderNotificationModel();
