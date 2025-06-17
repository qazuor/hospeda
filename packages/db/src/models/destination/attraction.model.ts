import type { AttractionType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { attractions } from '../../schemas/destination/attraction.dbschema';

export class AttractionModel extends BaseModel<AttractionType> {
    protected table = attractions;
    protected entityName = 'attractions';
}
