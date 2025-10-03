/**
 * @file Entity Select Fields Index
 *
 * Exports all specific entity select field components with encapsulated logic.
 * These components provide simplified configuration and built-in API integration.
 */

export { DestinationSelectField } from './DestinationSelectField';
export { UserSelectField } from './UserSelectField';

// Export types
export type { DestinationSelectFieldProps } from './DestinationSelectField';
export type { UserSelectFieldProps } from './UserSelectField';

// TODO [250b020f-9a83-47e0-a291-c74cab6954a8]: Add more entity select fields as needed:
// export { AccommodationSelectField } from './AccommodationSelectField';
// export { EventSelectField } from './EventSelectField';
// export { PostSelectField } from './PostSelectField';
// export { FeatureSelectField } from './FeatureSelectField';
// export { AmenitySelectField } from './AmenitySelectField';
// export { TagSelectField } from './TagSelectField';
