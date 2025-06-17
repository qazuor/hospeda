import type { AccommodationType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema';

export class AccommodationModel extends BaseModel<AccommodationType> {
    protected table = accommodations;
    protected entityName = 'accommodations';
}
