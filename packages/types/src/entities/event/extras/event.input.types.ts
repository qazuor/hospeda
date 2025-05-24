// packages/types/src/entities/event/event.input.types.ts

import type { EventLocationType } from '@repo/types/entities/event/event.location.types.js';
import type { EventOrganizerType } from '@repo/types/entities/event/event.organizer.types.js';
import type { NewEntityInput, Writable } from '../../../common/helpers.types.js';
import type { EventType } from '../event.types.js';

/**
 * Partial editable structure of an EventType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEvent = Partial<Writable<EventType>>;

/**
 * Input structure used to create a new event.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewEventInput = NewEntityInput<EventType>;

/**
 * Input structure used to update an existing event.
 * All fields are optional for partial patching.
 */
export type UpdateEventInput = PartialEvent;

/**
 * Partial editable structure of an EventLocationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEventLocation = Partial<Writable<EventLocationType>>;

/**
 * Input structure used to create a new event location.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewEventLocationInput = NewEntityInput<EventLocationType>;

/**
 * Input structure used to update an existing event location.
 * All fields are optional for partial patching.
 */
export type UpdateEventLocationInput = PartialEventLocation;

/**
 * Partial editable structure of an EventOrganizerType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialEventOrganizer = Partial<Writable<EventOrganizerType>>;

/**
 * Input structure used to create a new event organizer.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewEventOrganizerInput = NewEntityInput<EventOrganizerType>;

/**
 * Input structure used to update an existing event organizer.
 * All fields are optional for partial patching.
 */
export type UpdateEventOrganizerInput = PartialEventOrganizer;
