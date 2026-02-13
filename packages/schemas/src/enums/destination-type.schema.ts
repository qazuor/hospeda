import { z } from 'zod';
import { DestinationTypeEnum } from './destination-type.enum.js';

export const DestinationTypeEnumSchema = z.nativeEnum(DestinationTypeEnum, {
    error: () => ({ message: 'zodError.enums.destinationType.invalid' })
});
export type DestinationType = z.infer<typeof DestinationTypeEnumSchema>;
