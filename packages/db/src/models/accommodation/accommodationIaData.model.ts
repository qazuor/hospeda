import type { AccommodationIaData } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { accommodationIaData } from '../../schemas/accommodation/accommodation_iaData.dbschema.ts';

export class AccommodationIaDataModel extends BaseModel<AccommodationIaData> {
    protected table = accommodationIaData;
    protected entityName = 'accommodationIaData';

    protected getTableName(): string {
        return 'accommodationIaData';
    }
}
