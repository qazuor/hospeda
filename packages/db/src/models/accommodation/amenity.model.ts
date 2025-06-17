import type { AmenityType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { amenities } from '../../schemas/accommodation/amenity.dbschema';

export class AmenityModel extends BaseModel<AmenityType> {
    protected table = amenities;
    protected entityName = 'amenities';
}
