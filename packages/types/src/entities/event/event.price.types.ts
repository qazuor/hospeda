import type { BasePriceType } from '../../common/price.types.js';

export interface EventPriceType extends BasePriceType {
    isFree: boolean;
    priceFrom?: number;
    priceTo?: number;
    pricePerGroup?: number;
}
