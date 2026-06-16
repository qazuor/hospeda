import { z } from 'zod';
import { HostTradeCategoryEnum } from './host-trade-category.enum.js';

export const HostTradeCategoryEnumSchema = z.nativeEnum(HostTradeCategoryEnum, {
    error: () => ({ message: 'zodError.enums.hostTradeCategory.invalid' })
});
