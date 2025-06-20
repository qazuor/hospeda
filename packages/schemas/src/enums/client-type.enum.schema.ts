import { ClientTypeEnum } from '@repo/types';
import { z } from 'zod';

export const ClientTypeEnumSchema = z.nativeEnum(ClientTypeEnum, {
    errorMap: () => ({ message: 'zodError.enums.clientType.invalid' })
});
