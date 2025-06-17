import type { EventLocationType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { eventLocations } from '../../schemas/event/event_location.dbschema';

export class EventLocationModel extends BaseModel<EventLocationType> {
    protected table = eventLocations;
    protected entityName = 'eventLocations';
}
