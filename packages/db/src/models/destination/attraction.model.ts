import type { Attraction } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { attractions } from '../../schemas/destination/attraction.dbschema';

export class AttractionModel extends BaseModel<Attraction> {
    protected table = attractions;
    protected entityName = 'attractions';

    protected getTableName(): string {
        return 'attractions';
    }
}
