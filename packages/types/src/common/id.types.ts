// ID branding for entities
export type Brand<K, T> = K & { __brand: T };

export type UserId = Brand<string, 'UserId'>;
export type RoleId = Brand<string, 'RoleId'>;
export type PermissionId = Brand<string, 'PermissionId'>;
export type UserBookmarkId = Brand<string, 'UserBookmarkId'>;

export type TagId = Brand<string, 'TagId'>;

export type AccommodationId = Brand<string, 'AccommodationId'>;
export type AmenityId = Brand<string, 'AmenityId'>;
export type FeatureId = Brand<string, 'FeatureId '>;

export type DestinationId = Brand<string, 'DestinationId'>;

export type EventId = Brand<string, 'EventId'>;
export type EventLocationId = Brand<string, 'EventLocationId '>;
export type EventOrganizerId = Brand<string, 'EventOrganizerId '>;

export type PostId = Brand<string, 'PostId'>;
export type PostSponsorId = Brand<string, 'PostSponsorId '>;
export type PostSponsorshipId = Brand<string, 'PostSponsorshipId '>;
