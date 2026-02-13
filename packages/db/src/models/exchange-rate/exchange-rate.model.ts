import type { ExchangeRate } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { exchangeRates } from '../../schemas/exchange-rate/exchange-rate.dbschema.ts';

export class ExchangeRateModel extends BaseModel<ExchangeRate> {
    protected table = exchangeRates;
    protected entityName = 'exchange_rates';

    protected getTableName(): string {
        return 'exchange_rates';
    }
}
