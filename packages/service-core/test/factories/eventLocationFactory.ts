import type {
    EventLocation,
    EventLocationCreateInput,
    EventLocationIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Builder for EventLocation test objects.
 * Allows fluent creation of event location test data with sensible defaults.
 */
export class EventLocationFactoryBuilder {
    private eventLocation: EventLocation;

    constructor() {
        this.eventLocation = {
            id: getMockId('feature') as EventLocationIdType, // 'feature' is used for location-like entities
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
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };
    }

    with(fields: Partial<EventLocation>): this {
        this.eventLocation = { ...this.eventLocation, ...fields };
        return this;
    }

    build(): EventLocation {
        return { ...this.eventLocation };
    }

    static create(fields: Partial<EventLocation> = {}): EventLocation {
        return new EventLocationFactoryBuilder().with(fields).build();
    }
}

/**
 * Creates a mock EventLocation with default test values.
 * Use the EventLocationFactoryBuilder for more complex setup scenarios.
 */
export const createMockEventLocation = (overrides: Partial<EventLocation> = {}): EventLocation => {
    return EventLocationFactoryBuilder.create(overrides);
};

/**
 * Creates a valid event location create input (without auto-generated fields)
 * Use this for testing create operations
 */
export const createMockEventLocationCreateInput = (
    overrides: Partial<EventLocationCreateInput> = {}
): EventLocationCreateInput => {
    const baseInput = {
        street: 'Main St',
        number: '123',
        city: 'CityName',
        department: 'Dept',
        country: 'Country',
        placeName: 'Venue'
    };

    return {
        ...baseInput,
        ...overrides
    } as EventLocationCreateInput;
};
