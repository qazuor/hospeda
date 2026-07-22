/**
 * Unit tests for `roundToNearestThousand` and `convertImportedPriceToArs` (BETA-181).
 */

import type { ExchangeRate } from '@repo/schemas';
import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    convertImportedPriceToArs,
    roundToNearestThousand
} from '../../../src/services/accommodation-import/price-conversion.js';
import type { ExchangeRateConfigService } from '../../../src/services/exchange-rate/exchange-rate-config.service.js';
import type {
    ExchangeRateFetcher,
    GetRateWithFallbackResult
} from '../../../src/services/exchange-rate/exchange-rate-fetcher.js';
import type { Actor } from '../../../src/types/index.js';

const fakeActor: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'HOST',
    permissions: []
} as unknown as Actor;

/** Builds a minimal fake ExchangeRateFetcher whose `getRateWithFallback` resolves to `result`. */
function makeFetcher(result: GetRateWithFallbackResult): ExchangeRateFetcher {
    return {
        getRateWithFallback: async () => result
    } as unknown as ExchangeRateFetcher;
}

/** Builds a minimal fake ExchangeRateFetcher whose `getRateWithFallback` throws. */
function makeThrowingFetcher(): ExchangeRateFetcher {
    return {
        getRateWithFallback: async () => {
            throw new Error('network down');
        }
    } as unknown as ExchangeRateFetcher;
}

/** Builds a minimal fake ExchangeRateConfigService returning `defaultRateType`. */
function makeConfigService(defaultRateType?: ExchangeRateTypeEnum): ExchangeRateConfigService {
    return {
        getConfig: async () => ({
            data: defaultRateType === undefined ? undefined : { defaultRateType }
        })
    } as unknown as ExchangeRateConfigService;
}

describe('roundToNearestThousand', () => {
    it('should round up when the remainder is 500 or more', () => {
        expect(roundToNearestThousand({ amount: 149999 })).toBe(150000);
        expect(roundToNearestThousand({ amount: 150500 })).toBe(151000);
    });

    it('should round down when the remainder is less than 500', () => {
        expect(roundToNearestThousand({ amount: 1400 })).toBe(1000);
    });

    it('should round to the nearest 1000 for small amounts', () => {
        expect(roundToNearestThousand({ amount: 1500 })).toBe(2000);
        expect(roundToNearestThousand({ amount: 500 })).toBe(1000);
    });

    it('should return 0 when the amount is 0', () => {
        expect(roundToNearestThousand({ amount: 0 })).toBe(0);
    });
});

describe('convertImportedPriceToArs', () => {
    const fakeRate: ExchangeRate = {
        id: '11111111-1111-4111-8111-111111111111',
        fromCurrency: PriceCurrencyEnum.USD,
        toCurrency: PriceCurrencyEnum.ARS,
        rate: 1500,
        inverseRate: 1 / 1500,
        rateType: ExchangeRateTypeEnum.OFICIAL,
        source: ExchangeRateSourceEnum.DOLARAPI,
        isManualOverride: false,
        fetchedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const okRateResult: GetRateWithFallbackResult = {
        rate: fakeRate,
        quality: 'fresh'
    };

    it('should convert a USD price to ARS rounded to the nearest 1000', async () => {
        const result = await convertImportedPriceToArs({
            price: 100,
            currency: 'USD',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        expect(result).toEqual({
            originalPrice: 100,
            originalCurrency: 'USD',
            convertedPrice: 150000,
            rate: 1500,
            rateType: ExchangeRateTypeEnum.OFICIAL
        });
    });

    it('should normalize a lowercase currency code before matching', async () => {
        const result = await convertImportedPriceToArs({
            price: 10,
            currency: 'usd',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        expect(result?.originalCurrency).toBe('USD');
        expect(result?.convertedPrice).toBe(15000);
    });

    it('should default to the oficial rate type when config has no data', async () => {
        const result = await convertImportedPriceToArs({
            price: 100,
            currency: 'USD',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(undefined),
            actor: fakeActor
        });

        expect(result?.rateType).toBe(ExchangeRateTypeEnum.OFICIAL);
    });

    it('should return null when the currency is already ARS', async () => {
        const result = await convertImportedPriceToArs({
            price: 150000,
            currency: 'ARS',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        expect(result).toBeNull();
    });

    it('should return null for an unsupported currency (e.g. BRL)', async () => {
        const result = await convertImportedPriceToArs({
            price: 100,
            currency: 'BRL',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        expect(result).toBeNull();
    });

    it('should return null for an implausible sub-$1 USD price (never convert to 0 ARS)', async () => {
        const result = await convertImportedPriceToArs({
            price: 0.1,
            currency: 'USD',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        // 0.1 USD * 1500 = 150 → rounds to 0 ARS; must be rejected, not surfaced.
        expect(result).toBeNull();
    });

    it('should return null for an implausibly high USD price (likely mislabeled local currency)', async () => {
        const result = await convertImportedPriceToArs({
            price: 15964.5,
            currency: 'USD',
            exchangeRateFetcher: makeFetcher(okRateResult),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        // Above PER_NIGHT_MAX_USD (3000) — the BETA-169 magnitude signal for a
        // mislabeled ARS value; leave it for the host rather than fabricate millions of ARS.
        expect(result).toBeNull();
    });

    it('should return null when no rate is available', async () => {
        const result = await convertImportedPriceToArs({
            price: 100,
            currency: 'USD',
            exchangeRateFetcher: makeFetcher({ rate: null, quality: 'not_found' }),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        expect(result).toBeNull();
    });

    it('should return null and never throw when the fetcher throws', async () => {
        const result = await convertImportedPriceToArs({
            price: 100,
            currency: 'USD',
            exchangeRateFetcher: makeThrowingFetcher(),
            exchangeRateConfigService: makeConfigService(ExchangeRateTypeEnum.OFICIAL),
            actor: fakeActor
        });

        expect(result).toBeNull();
    });
});
