import { CurrencyEnum } from '@repo/types/src/enums/currency.enum';
import { z } from 'zod';

export const CurrencyEnumSchema = z.enum(Object.values(CurrencyEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.currency.invalid' })
});
