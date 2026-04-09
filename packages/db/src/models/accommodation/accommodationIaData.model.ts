import type { AccommodationIaData } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodationIaData } from '../../schemas/accommodation/accommodation_iaData.dbschema.ts';

export class AccommodationIaDataModel extends BaseModelImpl<AccommodationIaData> {
    protected table = accommodationIaData;
    public entityName = 'accommodationIaData';

    protected getTableName(): string {
        return 'accommodationIaData';
    }
}

/** Singleton instance of AccommodationIaDataModel for use across the application. */
export const accommodationIaDataModel = new AccommodationIaDataModel();
