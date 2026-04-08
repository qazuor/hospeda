import type { EventLocation } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { eventLocations } from '../../schemas/event/event_location.dbschema.ts';

export class EventLocationModel extends BaseModelImpl<EventLocation> {
    protected table = eventLocations;
    protected entityName = 'eventLocations';

    protected getTableName(): string {
        return 'eventLocations';
    }
}
