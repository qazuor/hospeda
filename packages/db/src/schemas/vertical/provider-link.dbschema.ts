import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { subscriptions } from './subscription.dbschema.ts';

/** Provider mandate associated with one subscription (B3, H1). */
export const providerLinks = pgTable(
    'provider_link',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** la suscripción que vincula */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** cuál es el proveedor */
        provider: varchar('provider', { length: 32 }).notNull(),
        /** id del proveedor de una suscripción */
        providerId: varchar('provider_id', { length: 255 }).notNull(),
        /** última `version` del recurso que aplicamos */
        lastAppliedVersion: varchar('last_applied_version', { length: 255 }),
        /** `last_modified` de la última relectura por id */
        lastModified: timestamp('last_modified', { withTimezone: true })
    },
    (t) => ({
        subscriptionUnique: unique('uq_provider_link_subscription').on(t.subscriptionId),
        providerIdUnique: unique('uq_provider_link_provider_id').on(t.provider, t.providerId)
    })
);

/** Insert shape for a provider link. */
export type InsertProviderLink = typeof providerLinks.$inferInsert;
/** Select shape for a provider link. */
export type SelectProviderLink = typeof providerLinks.$inferSelect;
