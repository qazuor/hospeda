import { ClientTypeEnum } from '@repo/types';
import { z } from 'zod';

export const ClientTypeEnumSchema = z.enum(Object.values(ClientTypeEnum) as [string, ...string[]], {
    errorMap: () => ({ message: 'zodError.enums.clientType.invalid' })
});
