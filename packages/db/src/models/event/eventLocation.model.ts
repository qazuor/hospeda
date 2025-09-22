import type { EventLocation } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { eventLocations } from '../../schemas/event/event_location.dbschema';

export class EventLocationModel extends BaseModel<EventLocation> {
    protected table = eventLocations;
    protected entityName = 'eventLocations';
}
