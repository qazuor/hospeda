import type { Attraction } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { attractions } from '../../schemas/destination/attraction.dbschema.ts';

export class AttractionModel extends BaseModelImpl<Attraction> {
    protected table = attractions;
    public entityName = 'attractions';

    protected getTableName(): string {
        return 'attractions';
    }
}

/** Singleton instance of AttractionModel for use across the application. */
export const attractionModel = new AttractionModel();
