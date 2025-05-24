import type { PriceCurrencyEnum } from '../enums/currency.enum.js';

export interface BasePriceType {
    price?: number;
    currency?: PriceCurrencyEnum;
}
