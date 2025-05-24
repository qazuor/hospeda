// packages/types/src/entities/destination/destination.input.types.ts

import type { NewEntityInput, Writable } from '../../../common/helpers.types.js';
import type { DestinationType } from '../destination.types.js';

/**
 * Partial editable structure of a DestinationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialDestination = Partial<Writable<DestinationType>>;

/**
 * Input structure used to create a new destination.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewDestinationInput = NewEntityInput<DestinationType>;

/**
 * Input structure used to update an existing destination.
 * All fields are optional for partial patching.
 */
export type UpdateDestinationInput = PartialDestination;
