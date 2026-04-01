import { boolean, index, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
    ExchangeRateSourcePgEnum,
    ExchangeRateTypePgEnum,
    PriceCurrencyPgEnum
} from '../enums.dbschema.ts';

export const exchangeRates = pgTable(
    'exchange_rates',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        fromCurrency: PriceCurrencyPgEnum('from_currency').notNull(),
        toCurrency: PriceCurrencyPgEnum('to_currency').notNull(),
        /** Conversion rate from source to target currency. Drizzle mode:'number' ensures runtime JS number type. */
        rate: numeric('rate', { precision: 20, scale: 10, mode: 'number' }).notNull(),
        /** Inverse conversion rate (1/rate). Drizzle mode:'number' ensures runtime JS number type. */
        inverseRate: numeric('inverse_rate', {
            precision: 20,
            scale: 10,
            mode: 'number'
        }).notNull(),
        rateType: ExchangeRateTypePgEnum('rate_type').notNull(),
        source: ExchangeRateSourcePgEnum('source').notNull(),
        isManualOverride: boolean('is_manual_override').notNull().default(false),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        exchange_rates_currency_pair_type_idx: index('exchange_rates_currency_pair_type_idx').on(
            table.fromCurrency,
            table.toCurrency,
            table.rateType
        ),
        exchange_rates_fetched_at_idx: index('exchange_rates_fetched_at_idx').on(table.fetchedAt),
        exchange_rates_source_idx: index('exchange_rates_source_idx').on(table.source)
    })
);
