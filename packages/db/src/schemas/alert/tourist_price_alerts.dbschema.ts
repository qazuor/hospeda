import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Tourist price-alert subscriptions table (SPEC-286 G-1).
 *
 * A tourist subscribes to be notified when a watched accommodation's price
 * drops. `basePriceSnapshot` is the price captured at subscription time and
 * is the baseline the daily digest cron compares against the accommodation's
 * current price to compute the drop percentage.
 *
 * `targetPercentDropUnique` intentionally allows only **one active alert per
 * `(user_id, accommodation_id)` pair**: the partial unique index is scoped to
 * `deleted_at IS NULL` so a tourist can re-subscribe after soft-deleting a
 * prior alert for the same accommodation (the old, deleted row does not
 * block the new one).
 */
export const touristPriceAlerts = pgTable(
    'tourist_price_alerts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        /**
         * Price snapshot (integer centavos) taken at subscription time. Used as
         * the baseline for computing the percentage drop against the
         * accommodation's current price.
         */
        basePriceSnapshot: integer('base_price_snapshot').notNull(),
        /**
         * Minimum percentage drop (1-100) required to trigger this alert.
         * `null` means "notify on any drop" — the evaluator falls back to the
         * platform-wide default threshold instead of a per-alert value.
         */
        targetPercentDrop: integer('target_percent_drop'),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        touristPriceAlerts_userId_idx: index('touristPriceAlerts_userId_idx').on(table.userId),
        touristPriceAlerts_accommodationId_idx: index('touristPriceAlerts_accommodationId_idx').on(
            table.accommodationId
        ),
        touristPriceAlerts_isActive_idx: index('touristPriceAlerts_isActive_idx').on(
            table.isActive
        ),
        /**
         * Only one *live* alert per user+accommodation pair. Scoped to
         * `deleted_at IS NULL` so soft-deleted alerts don't block
         * re-subscription.
         */
        touristPriceAlerts_userAccommodation_activeUnique: uniqueIndex(
            'idx_tourist_price_alerts_user_accommodation_active_unique'
        )
            .on(table.userId, table.accommodationId)
            .where(sql`deleted_at IS NULL`)
    })
);

/**
 * Relations for `tourist_price_alerts`.
 *
 * Deliberately does NOT add a matching `many(touristPriceAlerts)` back-relation
 * on `users`/`accommodations` — this table lives in its own domain folder
 * (`schemas/alert/`), and the most recent comparable cross-folder child table
 * (`owner_promotions`, SPEC-285) followed the same one-directional pattern.
 */
export const touristPriceAlertsRelations = relations(touristPriceAlerts, ({ one }) => ({
    user: one(users, {
        fields: [touristPriceAlerts.userId],
        references: [users.id]
    }),
    accommodation: one(accommodations, {
        fields: [touristPriceAlerts.accommodationId],
        references: [accommodations.id]
    })
}));
