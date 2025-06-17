import type { EventOrganizerType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { eventOrganizers } from '../../schemas/event/event_organizer.dbschema';

export class EventOrganizerModel extends BaseModel<EventOrganizerType> {
    protected table = eventOrganizers;
    protected entityName = 'eventOrganizers';
}
