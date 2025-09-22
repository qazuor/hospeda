import { z } from 'zod';
import { ClientTypeEnum } from './client-type.enum.js';

export const ClientTypeEnumSchema = z.nativeEnum(ClientTypeEnum, {
    error: () => ({ message: 'zodError.enums.clientType.invalid' })
});
