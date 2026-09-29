import { ExchangeRateModel } from '@repo/db';
import { ExchangeRateService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory, whereFixtureFields } from '../utils/index.js';

/**
 * Seed factory for exchange rates
 *
 * Creates exchange rate records from JSON files, excluding metadata fields.
 * Provides initial reference rates for currency conversion.
 */
export const seedExchangeRates = createSeedFactory({
    entityName: 'ExchangeRates',
    serviceClass: ExchangeRateService,
    folder: 'src/data/exchangeRate',
    files: requiredManifest.exchangeRates,

    // HOS-735: `exchange_rates` has NO unique constraint, so a re-run did not fail, it
    // silently DUPLICATED the four reference rows. The natural key is the pair, the
    // rate type and the source (the cron writes other sources; only 'manual' is ours).
    existing: {
        modelClass: ExchangeRateModel,
        getWhere: whereFixtureFields({
            fields: ['fromCurrency', 'toCurrency', 'rateType', 'source']
        })
    },

    // Exclude metadata fields
    normalizer: (data) => {
        const { $schema, id, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Custom entity info for better logging
    getEntityInfo: (item, _context) => {
        const rate = item as {
            fromCurrency: string;
            toCurrency: string;
            rateType: string;
            rate: number;
        };
        return `${rate.fromCurrency}/${rate.toCurrency} (${rate.rateType}): ${rate.rate}`;
    }
});
