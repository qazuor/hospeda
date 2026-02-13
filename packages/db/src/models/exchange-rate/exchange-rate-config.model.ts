import type { ExchangeRateConfig } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { exchangeRateConfig } from '../../schemas/exchange-rate/exchange-rate-config.dbschema.ts';

/**
 * Model for exchange rate configuration.
 *
 * Manages singleton configuration for exchange rate settings including
 * currencies, update frequency, and API integration.
 */
export class ExchangeRateConfigModel extends BaseModel<ExchangeRateConfig> {
    protected table = exchangeRateConfig;
    protected entityName = 'exchange_rate_config';

    protected getTableName(): string {
        return 'exchange_rate_config';
    }
}
