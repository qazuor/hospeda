import { z } from 'zod';
import { HostTradeUsageDeclaredByEnum } from './host-trade-usage-declared-by.enum.js';

export const HostTradeUsageDeclaredByEnumSchema = z.nativeEnum(HostTradeUsageDeclaredByEnum, {
    error: () => ({ message: 'zodError.enums.hostTradeUsageDeclaredBy.invalid' })
});
