import type { EventOrganizer } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { eventOrganizers } from '../../schemas/event/event_organizer.dbschema';

export class EventOrganizerModel extends BaseModel<EventOrganizer> {
    protected table = eventOrganizers;
    protected entityName = 'eventOrganizers';
}
