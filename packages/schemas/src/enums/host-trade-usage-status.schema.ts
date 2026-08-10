import { z } from 'zod';
import { HostTradeUsageStatusEnum } from './host-trade-usage-status.enum.js';

export const HostTradeUsageStatusEnumSchema = z.nativeEnum(HostTradeUsageStatusEnum, {
    error: () => ({ message: 'zodError.enums.hostTradeUsageStatus.invalid' })
});
