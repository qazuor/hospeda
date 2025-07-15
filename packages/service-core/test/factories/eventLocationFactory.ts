import type { EventLocationId, EventLocationType } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Builder for EventLocationType test objects.
 * Allows fluent creation of event location test data with sensible defaults.
 */
export class EventLocationFactoryBuilder {
    private eventLocation: EventLocationType;

    constructor() {
        this.eventLocation = {
            id: getMockId('feature') as EventLocationId, // 'feature' is used for location-like entities
            street: 'Main St',
            number: '123',
            floor: '1',
            apartment: 'A',
            neighborhood: 'Centro',
            city: 'CityName',
            department: 'Dept',
            placeName: 'Venue',
            state: 'State',
            zipCode: '12345',
            country: 'Country',
            coordinates: { lat: '1.0', long: '2.0' },
            adminInfo: { favorite: false },
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as EventLocationType['createdById'],
            updatedById: getMockId('user') as EventLocationType['updatedById'],
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };
    }

    with(fields: Partial<EventLocationType>): this {
        this.eventLocation = { ...this.eventLocation, ...fields };
        return this;
    }

    build(): EventLocationType {
        return { ...this.eventLocation };
    }

    static create(fields: Partial<EventLocationType> = {}): EventLocationType {
        return new EventLocationFactoryBuilder().with(fields).build();
    }
}
