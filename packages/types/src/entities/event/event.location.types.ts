import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '@repo/types/common/helpers.types.js';
import type { EventLocationId } from '@repo/types/common/id.types.js';
import type { BaseLocationType } from '../../common/location.types.js';

export interface EventLocationType
    extends BaseLocationType,
        WithAudit,
        WithLifecycleState,
        WithAdminInfo {
    id: EventLocationId;
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    department?: string;
    placeName?: string;
}

/**
 * Partial editable structure of an EventLocationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEventLocationType = Partial<Writable<EventLocationType>>;

/**
 * Input structure used to create a new event location.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewEventLocationInputType = NewEntityInput<EventLocationType>;

/**
 * Input structure used to update an existing event location.
 * All fields are optional for partial patching.
 */
export type UpdateEventLocationInputType = PartialEventLocationType;
