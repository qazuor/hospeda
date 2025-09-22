import type { AccommodationIaData } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { accommodationIaData } from '../../schemas/accommodation/accommodation_iaData.dbschema';

export class AccommodationIaDataModel extends BaseModel<AccommodationIaData> {
    protected table = accommodationIaData;
    protected entityName = 'accommodationIaData';
}
