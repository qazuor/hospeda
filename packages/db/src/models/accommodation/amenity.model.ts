import type { Amenity } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { amenities } from '../../schemas/accommodation/amenity.dbschema.ts';

export class AmenityModel extends BaseModel<Amenity> {
    protected table = amenities;
    protected entityName = 'amenities';

    protected getTableName(): string {
        return 'amenities';
    }
}
