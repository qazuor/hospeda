import { z } from 'zod';
import { ServiceErrorCode } from './service-error-code.enum.js';

export const ServiceErrorCodeSchema = z.nativeEnum(ServiceErrorCode, {
    error: () => ({ message: 'zodError.enums.serviceErrorCode.invalid' })
});
export type ServiceErrorCodeSchema = z.infer<typeof ServiceErrorCodeSchema>;
