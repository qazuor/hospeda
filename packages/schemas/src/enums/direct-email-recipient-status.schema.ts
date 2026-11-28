import { z } from 'zod';
import { DirectEmailRecipientStatusEnum } from './direct-email-recipient-status.enum.js';

export const DirectEmailRecipientStatusEnumSchema = z.nativeEnum(DirectEmailRecipientStatusEnum, {
    error: () => ({ message: 'zodError.enums.directEmailRecipientStatus.invalid' })
});
