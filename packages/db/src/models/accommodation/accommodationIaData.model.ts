import type { AccommodationIaDataType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { accommodationIaData } from '../../schemas/accommodation/accommodation_iaData.dbschema';

export class AccommodationIaDataModel extends BaseModel<AccommodationIaDataType> {
    protected table = accommodationIaData;
    protected entityName = 'accommodationIaData';
}
