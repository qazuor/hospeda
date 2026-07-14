import { z } from 'zod';
import { OccupancySourceEnum } from './occupancy-source.enum.js';

export const OccupancySourceEnumSchema = z.nativeEnum(OccupancySourceEnum, {
    error: () => ({ message: 'zodError.enums.occupancySource.invalid' })
});
export type OccupancySourceSchema = z.infer<typeof OccupancySourceEnumSchema>;
