import type {
    ExchangeRate,
    ExchangeRateSearchInput,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum
} from '@repo/schemas';
import { and, count, desc, eq, gte, lte, max } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { exchangeRates } from '../../schemas/exchange-rate/exchange-rate.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

export class ExchangeRateModel extends BaseModelImpl<ExchangeRate> {
    protected table = exchangeRates;
    public entityName = 'exchange_rates';

    protected getTableName(): string {
        return 'exchange_rates';
    }

    /**
     * Finds the most recent exchange rate for a specific currency pair.
     * Returns the latest rate ordered by fetchedAt in descending order.
     *
     * @param input - Search parameters
     * @param input.fromCurrency - Source currency code
     * @param input.toCurrency - Target currency code
     * @param input.rateType - Optional rate type filter (SPOT, OFFICIAL, BLUE, etc.)
     * @returns Promise resolving to the latest exchange rate or null if not found
     *
     * @example
     * ```typescript
     * const latestRate = await model.findLatestRate({
     *   fromCurrency: PriceCurrencyEnum.USD,
     *   toCurrency: PriceCurrencyEnum.ARS,
     *   rateType: ExchangeRateTypeEnum.BLUE
     * });
     * ```
     */
    async findLatestRate(
        input: {
            fromCurrency: PriceCurrencyEnum;
            toCurrency: PriceCurrencyEnum;
            rateType?: ExchangeRateTypeEnum;
        },
        tx?: DrizzleClient
    ): Promise<ExchangeRate | null> {
        const db = this.getClient(tx);
        const { fromCurrency, toCurrency, rateType } = input;

        const whereClauses = [
            eq(exchangeRates.fromCurrency, fromCurrency),
            eq(exchangeRates.toCurrency, toCurrency)
        ];

        if (rateType) {
            whereClauses.push(eq(exchangeRates.rateType, rateType));
        }

        const result = await db
            .select()
            .from(exchangeRates)
            .where(and(...whereClauses))
            .orderBy(desc(exchangeRates.fetchedAt))
            .limit(1);

        return (result[0] ?? null) as ExchangeRate | null;
    }

    /**
     * Finds the latest exchange rates for all currency pair/type combinations.
     * Returns one row per unique (fromCurrency, toCurrency, rateType) combination,
     * selecting the most recent rate by fetchedAt.
     *
     * @param input - Optional pagination parameters
     * @param input.limit - Maximum number of results (default: 100)
     * @param input.offset - Number of results to skip (default: 0)
     * @returns Promise resolving to array of latest exchange rates
     *
     * @example
     * ```typescript
     * const latestRates = await model.findLatestRates({ limit: 50 });
     * ```
     */
    async findLatestRates(
        input?: {
            limit?: number;
            offset?: number;
        },
        tx?: DrizzleClient
    ): Promise<ExchangeRate[]> {
        const db = this.getClient(tx);
        const { limit = 100, offset = 0 } = input ?? {};

        const subquery = db
            .select({
                fromCurrency: exchangeRates.fromCurrency,
                toCurrency: exchangeRates.toCurrency,
                rateType: exchangeRates.rateType,
                maxFetchedAt: max(exchangeRates.fetchedAt)
            })
            .from(exchangeRates)
            .groupBy(exchangeRates.fromCurrency, exchangeRates.toCurrency, exchangeRates.rateType)
            .as('latest');

        const results = await db
            .select()
            .from(exchangeRates)
            .innerJoin(
                subquery,
                and(
                    eq(exchangeRates.fromCurrency, subquery.fromCurrency),
                    eq(exchangeRates.toCurrency, subquery.toCurrency),
                    eq(exchangeRates.rateType, subquery.rateType),
                    eq(exchangeRates.fetchedAt, subquery.maxFetchedAt)
                )
            )
            .limit(limit)
            .offset(offset);

        return results.map((row) => row.exchange_rates) as unknown as ExchangeRate[];
    }

    /**
     * Finds historical exchange rates for a specific currency pair.
     * Returns rates ordered by fetchedAt in descending order (newest first).
     * Supports pagination through limit and offset parameters.
     *
     * @param input - Search parameters
     * @param input.fromCurrency - Source currency code
     * @param input.toCurrency - Target currency code
     * @param input.rateType - Optional rate type filter
     * @param input.limit - Maximum number of results (default: 20)
     * @param input.offset - Number of results to skip (default: 0)
     * @returns Promise resolving to array of historical exchange rates
     *
     * @example
     * ```typescript
     * const history = await model.findRateHistory({
     *   fromCurrency: PriceCurrencyEnum.USD,
     *   toCurrency: PriceCurrencyEnum.ARS,
     *   rateType: ExchangeRateTypeEnum.BLUE,
     *   limit: 30
     * });
     * ```
     */
    async findRateHistory(
        input: {
            fromCurrency: PriceCurrencyEnum;
            toCurrency: PriceCurrencyEnum;
            rateType?: ExchangeRateTypeEnum;
            limit?: number;
            offset?: number;
        },
        tx?: DrizzleClient
    ): Promise<ExchangeRate[]> {
        const db = this.getClient(tx);
        const { fromCurrency, toCurrency, rateType, limit = 20, offset = 0 } = input;

        const whereClauses = [
            eq(exchangeRates.fromCurrency, fromCurrency),
            eq(exchangeRates.toCurrency, toCurrency)
        ];

        if (rateType) {
            whereClauses.push(eq(exchangeRates.rateType, rateType));
        }

        const results = await db
            .select()
            .from(exchangeRates)
            .where(and(...whereClauses))
            .orderBy(desc(exchangeRates.fetchedAt))
            .limit(limit)
            .offset(offset);

        return results as unknown as ExchangeRate[];
    }

    /**
     * Finds all manual override exchange rates.
     * Returns rates where isManualOverride is true,
     * ordered by createdAt in descending order (newest first).
     *
     * @returns Promise resolving to array of manual override rates
     *
     * @example
     * ```typescript
     * const overrides = await model.findManualOverrides();
     * ```
     */
    async findManualOverrides(tx?: DrizzleClient): Promise<ExchangeRate[]> {
        const db = this.getClient(tx);

        const results = await db
            .select()
            .from(exchangeRates)
            .where(eq(exchangeRates.isManualOverride, true))
            .orderBy(desc(exchangeRates.createdAt));

        return results as unknown as ExchangeRate[];
    }

    /**
     * Finds exchange rates with optional date range filters on fetchedAt.
     * Supports all standard equality filters plus fromDate/toDate range.
     * Results are ordered by fetchedAt descending (newest first).
     *
     * @param input - Search parameters including optional date range
     * @param input.fromCurrency - Optional source currency filter
     * @param input.toCurrency - Optional target currency filter
     * @param input.rateType - Optional rate type filter
     * @param input.source - Optional source filter
     * @param input.isManualOverride - Optional manual override filter
     * @param input.fromDate - Optional lower bound for fetchedAt (inclusive)
     * @param input.toDate - Optional upper bound for fetchedAt (inclusive)
     * @param pagination - Page and pageSize for pagination
     * @returns Promise resolving to paginated exchange rates with total count
     */
    async findAllWithDateRange(
        input: ExchangeRateSearchInput,
        pagination: { page: number; pageSize: number },
        tx?: DrizzleClient
    ): Promise<{ items: ExchangeRate[]; total: number }> {
        const db = this.getClient(tx);
        const { fromDate, toDate, ...eqFilters } = input;
        const { page, pageSize } = pagination;
        const offset = (page - 1) * pageSize;

        const whereClauses: SQL[] = [];

        if (eqFilters.fromCurrency) {
            whereClauses.push(eq(exchangeRates.fromCurrency, eqFilters.fromCurrency));
        }
        if (eqFilters.toCurrency) {
            whereClauses.push(eq(exchangeRates.toCurrency, eqFilters.toCurrency));
        }
        if (eqFilters.rateType) {
            whereClauses.push(eq(exchangeRates.rateType, eqFilters.rateType));
        }
        if (eqFilters.source) {
            whereClauses.push(eq(exchangeRates.source, eqFilters.source));
        }
        if (eqFilters.isManualOverride !== undefined) {
            whereClauses.push(eq(exchangeRates.isManualOverride, eqFilters.isManualOverride));
        }

        if (fromDate) {
            whereClauses.push(gte(exchangeRates.fetchedAt, fromDate));
        }
        if (toDate) {
            whereClauses.push(lte(exchangeRates.fetchedAt, toDate));
        }

        const whereClause = whereClauses.length > 0 ? and(...whereClauses) : undefined;

        const [items, totalResult] = await Promise.all([
            db
                .select()
                .from(exchangeRates)
                .where(whereClause)
                .orderBy(desc(exchangeRates.fetchedAt))
                .limit(pageSize)
                .offset(offset),
            db.select({ count: count() }).from(exchangeRates).where(whereClause)
        ]);

        return {
            items: items as unknown as ExchangeRate[],
            total: Number(totalResult[0]?.count ?? 0)
        };
    }
}

/** Singleton instance of ExchangeRateModel for use across the application. */
export const exchangeRateModel = new ExchangeRateModel();
