import { z } from 'zod';
import { PointOfInterestDestinationRelationEnum } from './point-of-interest-destination-relation.enum.js';

export const PointOfInterestDestinationRelationEnumSchema = z.nativeEnum(
    PointOfInterestDestinationRelationEnum,
    {
        error: () => ({ message: 'zodError.enums.pointOfInterestDestinationRelation.invalid' })
    }
);
export type PointOfInterestDestinationRelationSchema = z.infer<
    typeof PointOfInterestDestinationRelationEnumSchema
>;
