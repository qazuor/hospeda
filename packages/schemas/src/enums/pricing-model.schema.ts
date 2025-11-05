import { z } from 'zod';
import { PricingModelEnum } from './pricing-model.enum';

export const PricingModelEnumSchema = z.nativeEnum(PricingModelEnum, {
    message: 'zodError.enums.pricingModel.invalid'
});
