import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ExchangeRateTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Singleton configuration table for exchange rate system settings.
 *
 * This table should only contain one row with configuration for:
 * - Default exchange rate type to display
 * - Fetch intervals for different APIs
 * - Disclaimer settings
 * - Auto-fetch enablement
 *
 * @see ExchangeRateTypePgEnum for available rate types
 */
export const exchangeRateConfig = pgTable('exchange_rate_config', {
    id: uuid('id').primaryKey().defaultRandom(),
    defaultRateType: ExchangeRateTypePgEnum('default_rate_type').notNull().default('oficial'),
    dolarApiFetchIntervalMinutes: integer('dolar_api_fetch_interval_minutes').notNull().default(15),
    exchangeRateApiFetchIntervalHours: integer('exchange_rate_api_fetch_interval_hours')
        .notNull()
        .default(6),
    showConversionDisclaimer: boolean('show_conversion_disclaimer').notNull().default(true),
    disclaimerText: text('disclaimer_text'),
    enableAutoFetch: boolean('enable_auto_fetch').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
});
