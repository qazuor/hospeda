/**
 * Tests for numeric column coercion configuration.
 *
 * Verifies that Drizzle ORM numeric columns use `mode: 'number'` so that
 * PostgreSQL `numeric` values are returned as JavaScript `number` primitives
 * instead of strings (the default Drizzle behaviour for `numeric()`).
 *
 * These are schema-level, in-process tests that do NOT require a running
 * PostgreSQL instance — they inspect the Drizzle column metadata objects
 * directly via `getTableConfig`.
 *
 * @see packages/db/src/schemas/accommodation/accommodation.dbschema.ts
 * @see packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts
 * @see packages/db/src/schemas/destination/destination.dbschema.ts
 * @see packages/db/src/schemas/destination/destination_review.dbschema.ts
 * @see packages/db/src/schemas/exchange-rate/exchange-rate.dbschema.ts
 */

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { accommodations } from '../src/schemas/accommodation/accommodation.dbschema.ts';
import { accommodationReviews } from '../src/schemas/accommodation/accommodation_review.dbschema.ts';
import { destinations } from '../src/schemas/destination/destination.dbschema.ts';
import { destinationReviews } from '../src/schemas/destination/destination_review.dbschema.ts';
import { exchangeRates } from '../src/schemas/exchange-rate/exchange-rate.dbschema.ts';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Finds a column's config by its SQL column name (the string passed to `numeric('...')`).
 *
 * @param table - Drizzle table instance
 * @param sqlName - The SQL column name (snake_case, as declared in the schema)
 */
function findColumnConfigBySqlName(
    table: ReturnType<typeof getTableConfig>['columns'][number]['table'],
    sqlName: string
): { dataType: string; columnType: string; precision?: number; scale?: number } | undefined {
    const { columns } = getTableConfig(table);
    const col = columns.find((c) => c.name === sqlName);
    if (col)
        return col.config as {
            dataType: string;
            columnType: string;
            precision?: number;
            scale?: number;
        };
    return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Numeric column coercion configuration', () => {
    /**
     * When `mode: 'number'` is set on a Drizzle `numeric()` column the
     * runtime `dataType` property is `'number'` and the Drizzle column class
     * used internally is `PgNumericNumber` (instead of the default `PgNumeric`
     * which yields `dataType: 'string'`).
     */

    describe('accommodation_reviews', () => {
        it('averageRating column has dataType "number"', () => {
            // Arrange
            const config = findColumnConfigBySqlName(accommodationReviews, 'average_rating');

            // Assert
            expect(config).toBeDefined();
            expect(config?.dataType).toBe('number');
        });

        it('averageRating column uses PgNumericNumber column class', () => {
            // Arrange
            const config = findColumnConfigBySqlName(accommodationReviews, 'average_rating');

            // Assert
            expect(config?.columnType).toBe('PgNumericNumber');
        });

        it('averageRating column has correct precision and scale', () => {
            // Arrange
            const config = findColumnConfigBySqlName(accommodationReviews, 'average_rating');

            // Assert — rating is stored as numeric(3, 2), i.e. 0.00–5.00
            expect(config?.precision).toBe(3);
            expect(config?.scale).toBe(2);
        });
    });

    describe('destination_reviews', () => {
        it('averageRating column has dataType "number"', () => {
            // Arrange
            const config = findColumnConfigBySqlName(destinationReviews, 'average_rating');

            // Assert
            expect(config).toBeDefined();
            expect(config?.dataType).toBe('number');
        });

        it('averageRating column uses PgNumericNumber column class', () => {
            // Arrange
            const config = findColumnConfigBySqlName(destinationReviews, 'average_rating');

            // Assert
            expect(config?.columnType).toBe('PgNumericNumber');
        });

        it('averageRating column has correct precision and scale', () => {
            // Arrange
            const config = findColumnConfigBySqlName(destinationReviews, 'average_rating');

            // Assert
            expect(config?.precision).toBe(3);
            expect(config?.scale).toBe(2);
        });
    });

    describe('exchange_rates', () => {
        it('rate column has dataType "number"', () => {
            // Arrange
            const config = findColumnConfigBySqlName(exchangeRates, 'rate');

            // Assert
            expect(config).toBeDefined();
            expect(config?.dataType).toBe('number');
        });

        it('rate column uses PgNumericNumber column class', () => {
            // Arrange
            const config = findColumnConfigBySqlName(exchangeRates, 'rate');

            // Assert
            expect(config?.columnType).toBe('PgNumericNumber');
        });

        it('rate column has high precision for currency conversion', () => {
            // Arrange
            const config = findColumnConfigBySqlName(exchangeRates, 'rate');

            // Assert — exchange rates use numeric(20, 10)
            expect(config?.precision).toBe(20);
            expect(config?.scale).toBe(10);
        });

        it('inverseRate column has dataType "number"', () => {
            // Arrange
            const config = findColumnConfigBySqlName(exchangeRates, 'inverse_rate');

            // Assert
            expect(config).toBeDefined();
            expect(config?.dataType).toBe('number');
        });

        it('inverseRate column uses PgNumericNumber column class', () => {
            // Arrange
            const config = findColumnConfigBySqlName(exchangeRates, 'inverse_rate');

            // Assert
            expect(config?.columnType).toBe('PgNumericNumber');
        });

        it('inverseRate column has high precision for currency conversion', () => {
            // Arrange
            const config = findColumnConfigBySqlName(exchangeRates, 'inverse_rate');

            // Assert
            expect(config?.precision).toBe(20);
            expect(config?.scale).toBe(10);
        });
    });

    describe('accommodations', () => {
        it('averageRating column has dataType "number"', () => {
            // Arrange
            const config = findColumnConfigBySqlName(accommodations, 'average_rating');

            // Assert
            expect(config).toBeDefined();
            expect(config?.dataType).toBe('number');
        });

        it('averageRating column uses PgNumericNumber column class', () => {
            // Arrange
            const config = findColumnConfigBySqlName(accommodations, 'average_rating');

            // Assert
            expect(config?.columnType).toBe('PgNumericNumber');
        });

        it('averageRating column has correct precision and scale', () => {
            // Arrange
            const config = findColumnConfigBySqlName(accommodations, 'average_rating');

            // Assert
            expect(config?.precision).toBe(3);
            expect(config?.scale).toBe(2);
        });
    });

    describe('destinations', () => {
        it('averageRating column has dataType "number"', () => {
            // Arrange
            const config = findColumnConfigBySqlName(destinations, 'average_rating');

            // Assert
            expect(config).toBeDefined();
            expect(config?.dataType).toBe('number');
        });

        it('averageRating column uses PgNumericNumber column class', () => {
            // Arrange
            const config = findColumnConfigBySqlName(destinations, 'average_rating');

            // Assert
            expect(config?.columnType).toBe('PgNumericNumber');
        });

        it('averageRating column has correct precision and scale', () => {
            // Arrange
            const config = findColumnConfigBySqlName(destinations, 'average_rating');

            // Assert
            expect(config?.precision).toBe(3);
            expect(config?.scale).toBe(2);
        });
    });

    describe('type-level contract: mode: "number" vs default string', () => {
        /**
         * This test documents the difference between the two modes so that
         * future developers understand why `mode: 'number'` is required.
         * It verifies both states using identical schema declarations.
         */
        it('numeric() without mode produces dataType "string"', async () => {
            // Arrange — import inline to avoid polluting module scope
            const { numeric, pgTable } = await import('drizzle-orm/pg-core');
            const testTable = pgTable('__test_string_mode', {
                value: numeric('value', { precision: 3, scale: 2 })
            });

            // Act
            const { columns } = getTableConfig(testTable);
            const col = columns[0];

            // Assert — without mode, Drizzle returns strings from PostgreSQL numeric
            expect(col?.config?.dataType).toBe('string');
            expect(col?.config?.columnType).toBe('PgNumeric');
        });

        it('numeric() with mode: "number" produces dataType "number"', async () => {
            // Arrange
            const { numeric, pgTable } = await import('drizzle-orm/pg-core');
            const testTable = pgTable('__test_number_mode', {
                value: numeric('value', { precision: 3, scale: 2, mode: 'number' })
            });

            // Act
            const { columns } = getTableConfig(testTable);
            const col = columns[0];

            // Assert — with mode: 'number', Drizzle coerces PostgreSQL numeric to JS number
            expect(col?.config?.dataType).toBe('number');
            expect(col?.config?.columnType).toBe('PgNumericNumber');
        });
    });
});
