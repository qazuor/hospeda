import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { quotedList } from './quoted-list.ts';

export const PROVIDER_NOTIFICATION_CHANNELS = ['IPN', 'WEBHOOKS'] as const;

/** Provider delivery retained for inspection (B3.md, AC:B3:21). */
export const providerNotifications = pgTable(
    'provider_notification',
    {
        /** id (FILA:B3) */
        id: uuid('id').primaryKey().defaultRandom(),
        /** el canal (FILA:B3) */
        channel: varchar('channel', { length: 16 }).notNull(),
        /** la URL con su query (FILA:B3) */
        url: text('url').notNull(),
        /** el cuerpo crudo (FILA:B3) */
        body: text('body').notNull(),
        /** el instante de llegada (FILA:B3) */
        receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        channel: check(
            'ck_provider_notification_channel',
            sql`${t.channel} IN (${quotedList(PROVIDER_NOTIFICATION_CHANNELS)})`
        ),
        receivedAt: index('idx_provider_notification_received_at').on(t.receivedAt)
    })
);

export type ProviderNotificationChannel = (typeof PROVIDER_NOTIFICATION_CHANNELS)[number];
/** Insert shape for a provider notification. */
export type InsertProviderNotification = typeof providerNotifications.$inferInsert;
/** Select shape for a provider notification. */
export type SelectProviderNotification = typeof providerNotifications.$inferSelect;
