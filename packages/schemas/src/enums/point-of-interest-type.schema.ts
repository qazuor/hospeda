import { z } from 'zod';
import { PointOfInterestTypeEnum } from './point-of-interest-type.enum.js';

export const PointOfInterestTypeEnumSchema = z.nativeEnum(PointOfInterestTypeEnum, {
    error: () => ({ message: 'zodError.enums.pointOfInterestType.invalid' })
});
export type PointOfInterestTypeSchema = z.infer<typeof PointOfInterestTypeEnumSchema>;
