import type { Amenity } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { amenities } from '../../schemas/accommodation/amenity.dbschema';

export class AmenityModel extends BaseModel<Amenity> {
    protected table = amenities;
    protected entityName = 'amenities';

    protected getTableName(): string {
        return 'amenities';
    }
}
