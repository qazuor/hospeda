// packages/types/src/entities/accommodation/accommodation.input.types.ts

import type { NewEntityInput, Writable } from '../../../common/helpers.types.js';
import type { AccommodationType } from '../accommodation.types.js';

/**
 * Partial editable structure of an AccommodationType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialAccommodation = Partial<Writable<AccommodationType>>;

/**
 * Input structure used to create a new accommodation.
 * Omits fields that are auto-generated or related to internal state.
 */
export type NewAccommodationInput = NewEntityInput<AccommodationType>;

/**
 * Input structure used to update an existing accommodation.
 * All fields are optional for partial patching.
 */
export type UpdateAccommodationInput = PartialAccommodation;
