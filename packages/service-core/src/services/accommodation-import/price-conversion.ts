/**
 * Accommodation Import — USD → ARS Price Conversion (BETA-181)
 *
 * The URL import pipeline can scrape a price in USD (Airbnb, Booking,
 * MercadoLibre). Hospeda is ARS-only, so this module converts a scraped USD
 * price to ARS inside the import pipeline, rounded to the nearest 1000 ARS,
 * using the platform's existing exchange-rate infrastructure
 * ({@link ExchangeRateFetcher} / {@link ExchangeRateConfigService}).
 *
 * The conversion is **advisory, never forced**: the caller (see
 * `finalize-import-draft.ts`) rewrites the draft's price fields to the
 * converted ARS value AND surfaces a `priceConversion` object on the response
 * so the host-facing wizard can show a "converted automatically, please
 * review" banner. The pre-filled price stays fully editable — the host
 * confirms before publishing.
 *
 * **Never throws** — any failure (missing config, no rate available, thrown
 * error) degrades to `null`, which the caller treats as "leave the price
 * untouched, no conversion happened".
 *
 * @module services/accommodation-import/price-conversion
 */

import { ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';

import type { Actor } from '../../types/index.js';
import { convertAmount } from '../exchange-rate/exchange-rate.helpers.js';
import type { ExchangeRateConfigService } from '../exchange-rate/exchange-rate-config.service.js';
import type { ExchangeRateFetcher } from '../exchange-rate/exchange-rate-fetcher.js';
import { isPlausiblePerNightUsd } from './adapters/price-plausibility.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of a successful USD → ARS price conversion.
 */
export interface PriceConversion {
    /** Original numeric price as scraped, before conversion. */
    readonly originalPrice: number;
    /** Original currency code as scraped (normalised, e.g. `'USD'`). */
    readonly originalCurrency: string;
    /** Converted price, rounded to the nearest 1000 ARS. */
    readonly convertedPrice: number;
    /** Exchange rate applied (1 unit of `originalCurrency` in ARS). */
    readonly rate: number;
    /** Rate type used for the conversion (e.g. `'oficial'`, `'blue'`). */
    readonly rateType: string;
}

/**
 * Input for {@link convertImportedPriceToArs}.
 */
export interface ConvertImportedPriceToArsInput {
    /** Scraped numeric price, in `currency`. */
    readonly price: number;
    /** Scraped currency code or label (e.g. `'USD'`, `'usd'`, `'ARS'`). */
    readonly currency: string;
    /** Fetcher used to read the current USD→ARS exchange rate. */
    readonly exchangeRateFetcher: ExchangeRateFetcher;
    /** Config service used to read the platform's default rate type. */
    readonly exchangeRateConfigService: ExchangeRateConfigService;
    /** Actor performing the import operation (forwarded to the config service). */
    readonly actor: Actor;
}

// ---------------------------------------------------------------------------
// roundToNearestThousand
// ---------------------------------------------------------------------------

/**
 * Rounds a numeric amount to the nearest multiple of 1000.
 *
 * @param input - Object containing the amount to round.
 * @returns The amount rounded to the nearest 1000.
 *
 * @example
 * ```ts
 * roundToNearestThousand({ amount: 149999 }) // 150000
 * roundToNearestThousand({ amount: 150500 }) // 151000
 * roundToNearestThousand({ amount: 1500 })   // 2000
 * ```
 */
export function roundToNearestThousand(input: { amount: number }): number {
    return Math.round(input.amount / 1000) * 1000;
}

// ---------------------------------------------------------------------------
// convertImportedPriceToArs
// ---------------------------------------------------------------------------

/**
 * Converts a scraped price to ARS when it was extracted in USD.
 *
 * Only USD → ARS conversion is supported — there is no reliable BRL rate in
 * the platform's exchange-rate infrastructure, so any currency other than
 * `'ARS'`/`'USD'` is left untouched (returns `null`). An `'ARS'` price also
 * returns `null` since there is nothing to convert. A USD price whose
 * per-night magnitude is implausible ({@link isPlausiblePerNightUsd} band —
 * below $1 or above $3000) also returns `null` so a mis-parsed value is never
 * converted into a `0` or absurdly-high ARS price (BETA-169).
 *
 * **Never throws.** Any error (config lookup, rate lookup, unexpected
 * exception) degrades to `null` so the caller can safely leave the scraped
 * price as-is with no advisory banner.
 *
 * @param input - Scraped price/currency plus the exchange-rate dependencies and actor.
 * @returns The conversion result, or `null` when no conversion applies or is possible.
 *
 * @example
 * ```ts
 * const conversion = await convertImportedPriceToArs({
 *   price: 100,
 *   currency: 'USD',
 *   exchangeRateFetcher,
 *   exchangeRateConfigService,
 *   actor,
 * });
 * // conversion?.convertedPrice // e.g. 150000 (rounded to nearest 1000)
 * ```
 */
export async function convertImportedPriceToArs(
    input: ConvertImportedPriceToArsInput
): Promise<PriceConversion | null> {
    try {
        const { price, exchangeRateFetcher, exchangeRateConfigService, actor } = input;
        const cur = input.currency.trim().toUpperCase();

        // Nothing to convert — already ARS.
        if (cur === 'ARS') {
            return null;
        }

        // Only USD→ARS is supported — no reliable BRL rate exists.
        if (cur !== 'USD') {
            return null;
        }

        // Plausibility floor (BETA-169 band [PER_NIGHT_MIN_USD, PER_NIGHT_MAX_USD]).
        // The OTA price-probe guard runs INSIDE the Airbnb/Booking adapters, but the
        // generic/JSON-LD/AI adapter does NOT — so a mis-parsed sub-$1 or absurdly
        // high "USD" per-night value can reach here. Converting a sub-$1 price would
        // silently round to 0 ARS and still show a "converted" banner; an ~1000x
        // value would fabricate a millions-of-ARS price. In both cases leave the
        // scraped price untouched (return null) for the host to fix manually —
        // under-resolve is safer than mis-resolve.
        if (!isPlausiblePerNightUsd(price)) {
            return null;
        }

        const cfg = await exchangeRateConfigService.getConfig({ actor });
        const rateType = cfg.data?.defaultRateType ?? ExchangeRateTypeEnum.OFICIAL;

        const rateResult = await exchangeRateFetcher.getRateWithFallback({
            fromCurrency: PriceCurrencyEnum.USD,
            toCurrency: PriceCurrencyEnum.ARS,
            rateType,
            maxAgeMinutes: 60
        });

        if (!rateResult.rate) {
            return null;
        }

        const convertedPrice = roundToNearestThousand({
            amount: convertAmount({ amount: price, rate: rateResult.rate.rate })
        });

        return {
            originalPrice: price,
            originalCurrency: cur,
            convertedPrice,
            rate: rateResult.rate.rate,
            rateType: rateResult.rate.rateType
        };
    } catch {
        // Defensive guard — this function must never throw.
        return null;
    }
}
