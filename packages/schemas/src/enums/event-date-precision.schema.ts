import { z } from 'zod';
import { EventDatePrecisionEnum } from './event-date-precision.enum.js';

export const EventDatePrecisionEnumSchema = z.nativeEnum(EventDatePrecisionEnum, {
    error: () => ({ message: 'zodError.enums.eventDatePrecision.invalid' })
});
