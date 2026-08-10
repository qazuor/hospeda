import { z } from 'zod';
import { HostTradeUsageChannelEnum } from './host-trade-usage-channel.enum.js';

export const HostTradeUsageChannelEnumSchema = z.nativeEnum(HostTradeUsageChannelEnum, {
    error: () => ({ message: 'zodError.enums.hostTradeUsageChannel.invalid' })
});
