import type { EventOrganizer } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { eventOrganizers } from '../../schemas/event/event_organizer.dbschema.ts';

export class EventOrganizerModel extends BaseModel<EventOrganizer> {
    protected table = eventOrganizers;
    protected entityName = 'eventOrganizers';

    protected getTableName(): string {
        return 'eventOrganizers';
    }
}
