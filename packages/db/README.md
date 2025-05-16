# @repo/db

Database layer for the Hospeda monorepo using Drizzle ORM with PostgreSQL.

## Overview

The `@repo/db` package provides the complete data access layer for the Hospeda platform. It's built using Drizzle ORM with a PostgreSQL database and implements a layered architecture with schemas, models, and services to ensure clean separation of concerns.

## Features

- **TypeScript Integration**: Full type safety from database to application code
- **Layered Architecture**:
  - Schema definitions using Drizzle ORM
  - Model layer for raw database operations
  - Service layer with business logic and authorization
- **Comprehensive Entity Coverage**: Complete support for all platform entities
- **Migration System**: SQL-based migrations for database schema changes
- **Seeding Scripts**: Populate the database with required and example data
- **Soft Deletion**: Support for soft delete patterns across entities
- **Audit Trails**: Automatic tracking of creation, updates, and deletions
- **Security**: Built-in authorization checks at the service layer

## Structure

```
src/
├── client.ts                 # PostgreSQL/Drizzle client setup
├── index.ts                  # Main exports
├── migrations/               # Database migrations
├── model/                    # Direct database operations
├── schema/                   # Database schema definitions
├── seeds/                    # Database seeding scripts
│   ├── example/              # Sample data for testing
│   └── required/             # Required initial data
├── service/                  # Business logic and auth
├── types/                    # Database-specific types
└── utils/                    # Database utilities
```

## Architectural Design

### Three-Layer Architecture

1. **Schema Layer**: Defines the database structure using Drizzle ORM
   - Table definitions
   - Column types and constraints
   - Relationships between tables

2. **Model Layer**: Handles direct database operations
   - CRUD operations for each entity
   - Raw database queries
   - No business logic or authorization checks

3. **Service Layer**: Implements business logic and authorization
   - Permission checking
   - Data validation
   - Complex operations across multiple entities
   - Integration with other services

## Database Schema

### Primary Tables

| Table Name | Description | Key Fields | Relationships |
|------------|-------------|------------|---------------|
| `users` | User accounts and profiles | id, name, userName, roleId, passwordHash | roles, bookmarks, permissions |
| `roles` | User roles for access control | id, name, displayName, isBuiltIn | users, permissions |
| `permissions` | Permission definitions | id, name, displayName, isBuiltIn | roles, users |
| `accommodations` | Lodging properties and listings | id, name, displayName, type, destinationId, ownerId | destinations, amenities, features, reviews |
| `destinations` | Tourist destinations and cities | id, name, displayName, slug, location | accommodations, attractions, reviews |
| `events` | Activities, festivals, and gatherings | id, name, displayName, category, date, authorId | organizers, locations |
| `posts` | Blog articles and content | id, title, content, category, authorId | sponsorships |

### Relation Tables

| Table Name | Description | Key Fields | Relationships |
|------------|-------------|------------|---------------|
| `accommodation_amenities` | Links amenities to accommodations | accommodationId, amenityId | accommodations, amenities |
| `accommodation_features` | Links features to accommodations | accommodationId, featureId | accommodations, features |
| `r_entity_tag` | Links entities to tags | entityId, entityType, tagId | various entities, tags |
| `r_role_permission` | Links roles to permissions | roleId, permissionId | roles, permissions |
| `r_user_permission` | Links users to permissions | userId, permissionId | users, permissions |
| `user_bookmarks` | User bookmarks for entities | id, ownerId, entityId, entityType | users, various entities |

### Support Tables

| Table Name | Description | Key Fields | Relationships |
|------------|-------------|------------|---------------|
| `amenities` | Available amenities for accommodations | id, name, displayName, type | accommodation_amenities |
| `features` | Available features for accommodations | id, name, displayName, isBuiltIn | accommodation_features |
| `tags` | Content classification tags | id, name, displayName, ownerId, color | r_entity_tag |
| `event_locations` | Event venue locations | id, name, displayName, state, country | events |
| `event_organizers` | Event organizing entities | id, name, displayName, logo | events |
| `post_sponsors` | Sponsorship organizations | id, name, displayName, type | post_sponsorships |
| `post_sponsorships` | Sponsorship details for posts | id, sponsorId, postId, paid | posts, post_sponsors |

## Service Layer

### AccommodationService

Handles all business logic and authorization checks for accommodations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertAccommodation, actor: UserType` | `Promise<AccommodationRecord>` | Creates a new accommodation |
| `getById` | `id: string, actor: UserType` | `Promise<AccommodationRecord>` | Fetches an accommodation by ID |
| `list` | `filter: SelectAccommodationFilter, actor: UserType` | `Promise<AccommodationRecord[]>` | Lists accommodations with filtering |
| `update` | `id: string, changes: Partial<InsertAccommodation>, actor: UserType` | `Promise<AccommodationRecord>` | Updates an accommodation |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes an accommodation |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted accommodation |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes an accommodation |
| `getByOwner` | `ownerId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationRecord[]>` | Gets accommodations by owner |
| `getByType` | `type: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationRecord[]>` | Gets accommodations by type |
| `getByState` | `state: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationRecord[]>` | Gets accommodations by state |
| `listByDestination` | `destinationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationRecord[]>` | Lists accommodations by destination |
| `addReview` | `accommodationId: string, data: Record<string, unknown>, actor: UserType` | `Promise<AccommodationReviewRecord>` | Adds a review to an accommodation |
| `listReviews` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationReviewRecord[]>` | Lists reviews for an accommodation |
| `getAverageRating` | `accommodationId: string, actor: UserType` | `Promise<AccommodationRatingType>` | Gets the average rating |
| `getTopRated` | `limit: number, actor: UserType` | `Promise<AccommodationRecord[]>` | Gets top-rated accommodations |
| `searchFullText` | `query: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationRecord[]>` | Searches accommodations by text |
| `listAmenities` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AmenityRecord[]>` | Lists amenities for an accommodation |
| `listFeatures` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<FeatureRecord[]>` | Lists features for an accommodation |
| `listFaqs` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationFaqRecord[]>` | Lists FAQs for an accommodation |
| `listIaData` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationIaDataRecord[]>` | Lists IA data for an accommodation |
| `addAmenity` | `accommodationId: string, amenityId: string, isOptional: boolean, actor: UserType, additionalCost?: Record<string, unknown>, additionalCostPercent?: number` | `Promise<{ relation: AccommodationAmenityRecord; amenity: AmenityRecord }>` | Adds an amenity to an accommodation |
| `addFeature` | `accommodationId: string, featureId: string, hostReWriteName: string, comments: string, actor: UserType` | `Promise<{ relation: AccommodationFeatureRecord; feature: FeatureRecord }>` | Adds a feature to an accommodation |
| `addFaq` | `accommodationId: string, data: Record<string, unknown>, actor: UserType` | `Promise<AccommodationFaqRecord>` | Adds a FAQ to an accommodation |
| `addIaData` | `accommodationId: string, data: Record<string, unknown>, actor: UserType` | `Promise<AccommodationIaDataRecord>` | Adds IA data to an accommodation |
| `getWithDetails` | `id: string, actor: UserType` | `Promise<AccommodationRecord & { amenities: AmenityRecord[]; features: FeatureRecord[]; faqs: AccommodationFaqRecord[]; iaData: AccommodationIaDataRecord[]; reviews: AccommodationReviewRecord[] }>` | Gets an accommodation with all related details |
| `addTag` | `accommodationId: string, tagId: string, actor: UserType` | `Promise<EntityTagRecord>` | Adds a tag to an accommodation |
| `recommendSimilar` | `accommodationId: string, limit: number, actor: UserType` | `Promise<AccommodationRecord[]>` | Recommends similar accommodations |

### AccommodationAmenityService

Manages relationships between accommodations and amenities.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertAccommodationAmenity, actor: UserType` | `Promise<AccommodationAmenityRecord>` | Creates a new accommodation-amenity relationship |
| `getByIds` | `accommodationId: string, amenityId: string, actor: UserType` | `Promise<AccommodationAmenityRecord>` | Gets a relationship by IDs |
| `listByAccommodation` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationAmenityRecord[]>` | Lists amenity relationships for an accommodation |
| `update` | `accommodationId: string, amenityId: string, changes: UpdateAccommodationAmenityData, actor: UserType` | `Promise<AccommodationAmenityRecord>` | Updates a relationship |
| `delete` | `accommodationId: string, amenityId: string, actor: UserType` | `Promise<void>` | Soft-deletes a relationship |
| `restore` | `accommodationId: string, amenityId: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted relationship |
| `hardDelete` | `accommodationId: string, amenityId: string, actor: UserType` | `Promise<void>` | Permanently deletes a relationship |
| `removeAllFromAccommodation` | `accommodationId: string, actor: UserType` | `Promise<void>` | Removes all amenity relationships for an accommodation |

### AccommodationFaqService

Manages FAQs for accommodations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertAccommodationFaq, actor: UserType` | `Promise<AccommodationFaqRecord>` | Creates a new FAQ entry |
| `getById` | `id: string, actor: UserType` | `Promise<AccommodationFaqRecord>` | Gets a FAQ by ID |
| `list` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationFaqRecord[]>` | Lists FAQs for an accommodation |
| `update` | `id: string, changes: UpdateAccommodationFaqData, actor: UserType` | `Promise<AccommodationFaqRecord>` | Updates a FAQ |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a FAQ |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted FAQ |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a FAQ |

### AccommodationFeatureService

Manages relationships between accommodations and features.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `accommodationId: string, featureId: string, hostReWriteName: string, comments: string, actor: UserType` | `Promise<{ relation: AccommodationFeatureRecord; feature: FeatureRecord }>` | Creates a new accommodation-feature relationship |
| `getByIds` | `accommodationId: string, featureId: string, actor: UserType` | `Promise<AccommodationFeatureRecord>` | Gets a relationship by IDs |
| `listByAccommodation` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationFeatureRecord[]>` | Lists feature relationships for an accommodation |
| `update` | `accommodationId: string, featureId: string, changes: Partial<AccommodationFeatureRecord>, actor: UserType` | `Promise<AccommodationFeatureRecord>` | Updates a relationship |
| `delete` | `accommodationId: string, featureId: string, actor: UserType` | `Promise<void>` | Soft-deletes a relationship |
| `restore` | `accommodationId: string, featureId: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted relationship |
| `hardDelete` | `accommodationId: string, featureId: string, actor: UserType` | `Promise<void>` | Permanently deletes a relationship |
| `removeAllFromAccommodation` | `accommodationId: string, actor: UserType` | `Promise<void>` | Removes all feature relationships for an accommodation |

### AccommodationIaDataService

Manages AI-generated data for accommodations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertAccommodationIaData, actor: UserType` | `Promise<AccommodationIaDataRecord>` | Creates a new IA data entry |
| `getById` | `id: string, actor: UserType` | `Promise<AccommodationIaDataRecord>` | Gets an IA data entry by ID |
| `list` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationIaDataRecord[]>` | Lists IA data entries for an accommodation |
| `update` | `id: string, changes: UpdateAccommodationIaData, actor: UserType` | `Promise<AccommodationIaDataRecord>` | Updates an IA data entry |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes an IA data entry |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted IA data entry |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes an IA data entry |
| `search` | `accommodationId: string, query: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationIaDataRecord[]>` | Searches IA data entries by keyword |

### AccommodationReviewService

Manages reviews for accommodations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertAccommodationReview, actor: UserType` | `Promise<AccommodationReviewRecord>` | Creates a new review |
| `getById` | `id: string, actor: UserType` | `Promise<AccommodationReviewRecord>` | Gets a review by ID |
| `list` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<AccommodationReviewRecord[]>` | Lists reviews for an accommodation |
| `update` | `id: string, changes: UpdateAccommodationReviewData, actor: UserType` | `Promise<AccommodationReviewRecord>` | Updates a review |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a review |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted review |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a review |
| `getAverageRating` | `accommodationId: string, actor: UserType` | `Promise<AccommodationRatingType>` | Gets the average rating |
| `countByAccommodation` | `accommodationId: string, actor: UserType` | `Promise<number>` | Counts reviews for an accommodation |

### AmenityService

Manages amenities that can be added to accommodations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertAmenity, actor: UserType` | `Promise<AmenityRecord>` | Creates a new amenity |
| `getById` | `id: string, actor: UserType` | `Promise<AmenityRecord>` | Gets an amenity by ID |
| `list` | `filter: SelectAmenityFilter, actor: UserType` | `Promise<AmenityRecord[]>` | Lists amenities with filtering |
| `update` | `id: string, changes: UpdateAmenityData, actor: UserType` | `Promise<AmenityRecord>` | Updates an amenity |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes an amenity |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted amenity |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes an amenity |
| `getByType` | `type: string, actor: UserType, filter: PaginationParams` | `Promise<AmenityRecord[]>` | Gets amenities by type |
| `getBuiltIn` | `actor: UserType, filter: PaginationParams` | `Promise<AmenityRecord[]>` | Gets built-in amenities |
| `getCustom` | `actor: UserType, filter: PaginationParams` | `Promise<AmenityRecord[]>` | Gets custom amenities |

### BookmarkService

Manages user bookmarks for various entities.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: Omit<InsertUserBookmark, 'id' \| 'ownerId' \| 'createdById' \| 'updatedById' \| 'deletedById' \| 'createdAt' \| 'updatedAt' \| 'deletedAt'>, ownerId: string, actor: UserType` | `Promise<BookmarkRecord>` | Creates a new bookmark |
| `getById` | `id: string, actor: UserType` | `Promise<BookmarkRecord>` | Gets a bookmark by ID |
| `list` | `filter: SelectBookmarkFilter, actor: UserType` | `Promise<BookmarkRecord[]>` | Lists bookmarks with filtering |
| `getByOwnerId` | `ownerId: string, actor: UserType, filter: PaginationParams` | `Promise<BookmarkRecord[]>` | Gets bookmarks by owner |
| `getByEntityType` | `type: EntityTypeEnum, actor: UserType, filter: PaginationParams` | `Promise<BookmarkRecord[]>` | Gets bookmarks by entity type |
| `getByEntityId` | `id: string, actor: UserType, filter: PaginationParams` | `Promise<BookmarkRecord[]>` | Gets bookmarks by entity ID |
| `update` | `id: string, changes: UpdateUserBookmarkData, actor: UserType` | `Promise<BookmarkRecord>` | Updates a bookmark |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a bookmark |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted bookmark |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a bookmark |
| `countByOwner` | `ownerId: string, actor: UserType` | `Promise<number>` | Counts bookmarks for an owner |
| `exists` | `ownerId: string, entityType: EntityTypeEnum, entityId: string` | `Promise<boolean>` | Checks if a bookmark exists |
| `bulkDeleteByOwner` | `ownerId: string, actor: UserType` | `Promise<void>` | Deletes all bookmarks for an owner |
| `purgeOld` | `cutoffDate: Date, actor: UserType` | `Promise<void>` | Purges old soft-deleted bookmarks |
| `getMostBookmarkedEntities` | `limit: number, actor: UserType` | `Promise<Array<{ entityType: EntityTypeEnum; entityId: string; bookmarkCount: number }>>` | Gets most bookmarked entities |

### DestinationService

Manages tourist destinations and locations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertDestination, actor: UserType` | `Promise<DestinationRecord>` | Creates a new destination |
| `getById` | `id: string, actor: UserType` | `Promise<DestinationRecord>` | Gets a destination by ID |
| `getBySlug` | `slug: string, actor: UserType` | `Promise<DestinationRecord>` | Gets a destination by slug |
| `list` | `filter: SelectDestinationFilter, actor: UserType` | `Promise<DestinationRecord[]>` | Lists destinations with filtering |
| `update` | `id: string, changes: UpdateDestinationData, actor: UserType` | `Promise<DestinationRecord>` | Updates a destination |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a destination |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted destination |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a destination |
| `getByVisibility` | `visibility: string, actor: UserType, filter: PaginationParams` | `Promise<DestinationRecord[]>` | Gets destinations by visibility |
| `addAttraction` | `destinationId: string, data: InsertDestinationAttraction, actor: UserType` | `Promise<DestinationAttractionRecord>` | Adds an attraction to a destination |
| `removeAttraction` | `destinationId: string, attractionId: string, actor: UserType` | `Promise<void>` | Removes an attraction from a destination |
| `listAttractions` | `destinationId: string, actor: UserType, filter: PaginationParams` | `Promise<DestinationAttractionRecord[]>` | Lists attractions for a destination |
| `addReview` | `destinationId: string, data: InsertDestinationReview, actor: UserType` | `Promise<DestinationReviewRecord>` | Adds a review to a destination |
| `removeReview` | `destinationId: string, reviewId: string, actor: UserType` | `Promise<void>` | Removes a review from a destination |
| `listReviews` | `destinationId: string, actor: UserType, filter: PaginationParams` | `Promise<DestinationReviewRecord[]>` | Lists reviews for a destination |
| `getStats` | `destinationId: string, actor: UserType` | `Promise<{ reviewCount: number; averageRating: DestinationRatingType; attractionCount: number; bookmarkCount: number; }>` | Gets statistics for a destination |
| `findNearby` | `latitude: number, longitude: number, radiusKm: number, actor: UserType, filter: PaginationParams` | `Promise<DestinationRecord[]>` | Finds destinations near a location |
| `listTop` | `limit: number, actor: UserType` | `Promise<DestinationRecord[]>` | Lists top destinations |
| `updateVisibility` | `id: string, visibility: string, actor: UserType` | `Promise<DestinationRecord>` | Updates the visibility of a destination |
| `getFeatured` | `limit: number, actor: UserType` | `Promise<DestinationRecord[]>` | Gets featured destinations |
| `getTags` | `destinationId: string, actor: UserType` | `Promise<TagRecord[]>` | Gets tags for a destination |
| `addTag` | `destinationId: string, tagId: string, actor: UserType` | `Promise<EntityTagRecord>` | Adds a tag to a destination |
| `removeTag` | `destinationId: string, tagId: string, actor: UserType` | `Promise<void>` | Removes a tag from a destination |
| `getBookmarkCount` | `destinationId: string, actor: UserType` | `Promise<number>` | Gets the number of bookmarks for a destination |
| `isBookmarked` | `destinationId: string, userId: string, actor: UserType` | `Promise<boolean>` | Checks if a destination is bookmarked by a user |

### DestinationAttractionService

Manages attractions associated with destinations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertDestinationAttraction, actor: UserType` | `Promise<DestinationAttractionRecord>` | Creates a new attraction |
| `getById` | `id: string, actor: UserType` | `Promise<DestinationAttractionRecord>` | Gets an attraction by ID |
| `list` | `filter: SelectDestinationAttractionFilter, actor: UserType` | `Promise<DestinationAttractionRecord[]>` | Lists attractions with filtering |
| `update` | `id: string, changes: UpdateDestinationAttractionData, actor: UserType` | `Promise<DestinationAttractionRecord>` | Updates an attraction |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes an attraction |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted attraction |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes an attraction |
| `countByDestination` | `destinationId: string, actor: UserType` | `Promise<number>` | Counts attractions for a destination |
| `search` | `query: string, actor: UserType, filter: PaginationParams` | `Promise<DestinationAttractionRecord[]>` | Searches attractions by query |

### DestinationReviewService

Manages reviews for destinations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertDestinationReview, actor: UserType` | `Promise<DestinationReviewRecord>` | Creates a new review |
| `getById` | `id: string, actor: UserType` | `Promise<DestinationReviewRecord>` | Gets a review by ID |
| `list` | `destinationId: string, actor: UserType, filter: PaginationParams` | `Promise<DestinationReviewRecord[]>` | Lists reviews for a destination |
| `update` | `id: string, changes: UpdateDestinationReviewData, actor: UserType` | `Promise<DestinationReviewRecord>` | Updates a review |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a review |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted review |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a review |
| `getAverageRating` | `destinationId: string, actor: UserType` | `Promise<DestinationRatingType>` | Gets the average rating for a destination |
| `listByUser` | `userId: string, actor: UserType, filter: PaginationParams` | `Promise<DestinationReviewRecord[]>` | Lists reviews created by a user |

### EventService

Manages events and activities.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertEvent, actor: UserType` | `Promise<EventRecord>` | Creates a new event |
| `getById` | `id: string, actor: UserType` | `Promise<EventRecord>` | Gets an event by ID |
| `getBySlug` | `slug: string, actor: UserType` | `Promise<EventRecord>` | Gets an event by slug |
| `list` | `filter: SelectEventFilter, actor: UserType` | `Promise<EventRecord[]>` | Lists events with filtering |
| `update` | `id: string, changes: UpdateEventData, actor: UserType` | `Promise<EventRecord>` | Updates an event |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes an event |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted event |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes an event |
| `getByCategory` | `category: string, actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Gets events by category |
| `updateOrganizer` | `organizerId: string, changes: UpdateEventOrganizerData, actor: UserType` | `Promise<EventOrganizerRecord>` | Updates an event organizer |
| `updateLocation` | `locationId: string, changes: UpdateEventLocationData, actor: UserType` | `Promise<EventLocationRecord>` | Updates an event location |
| `listByLocation` | `locationId: string, actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists events by location |
| `listByOrganizer` | `organizerId: string, actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists events by organizer |
| `listUpcoming` | `actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists upcoming events |
| `listPast` | `actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists past events |
| `listThisMonth` | `actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists events for the current month |
| `listThisWeek` | `actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists events for the current week |
| `getByDateRange` | `startDate: Date, endDate: Date, actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Gets events within a date range |
| `publish` | `id: string, actor: UserType` | `Promise<EventRecord>` | Publishes an event |
| `unpublish` | `id: string, actor: UserType` | `Promise<EventRecord>` | Unpublishes an event |

### EventLocationService

Manages locations for events.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertEventLocation, actor: UserType` | `Promise<EventLocationRecord>` | Creates a new location |
| `getById` | `id: string, actor: UserType` | `Promise<EventLocationRecord>` | Gets a location by ID |
| `list` | `filter: SelectEventLocationFilter, actor: UserType` | `Promise<EventLocationRecord[]>` | Lists locations with filtering |
| `update` | `id: string, changes: UpdateEventLocationData, actor: UserType` | `Promise<EventLocationRecord>` | Updates a location |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a location |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted location |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a location |
| `listEvents` | `locationId: string, actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists events for a location |

### EventOrganizerService

Manages organizers for events.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertEventOrganizer, actor: UserType` | `Promise<EventOrganizerRecord>` | Creates a new organizer |
| `getById` | `id: string, actor: UserType` | `Promise<EventOrganizerRecord>` | Gets an organizer by ID |
| `list` | `filter: SelectEventOrganizerFilter, actor: UserType` | `Promise<EventOrganizerRecord[]>` | Lists organizers with filtering |
| `update` | `id: string, changes: UpdateEventOrganizerData, actor: UserType` | `Promise<EventOrganizerRecord>` | Updates an organizer |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes an organizer |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted organizer |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes an organizer |
| `assignToEvent` | `eventId: string, organizerId: string, actor: UserType` | `Promise<EventRecord>` | Assigns an organizer to an event |
| `listEvents` | `organizerId: string, actor: UserType, filter: PaginationParams` | `Promise<EventRecord[]>` | Lists events for an organizer |

### FeatureService

Manages features for accommodations.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertFeature, actor: UserType` | `Promise<FeatureRecord>` | Creates a new feature |
| `getById` | `id: string, actor: UserType` | `Promise<FeatureRecord>` | Gets a feature by ID |
| `list` | `filter: SelectFeatureFilter, actor: UserType` | `Promise<FeatureRecord[]>` | Lists features with filtering |
| `update` | `id: string, changes: UpdateFeatureData, actor: UserType` | `Promise<FeatureRecord>` | Updates a feature |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a feature |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted feature |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a feature |
| `getBuiltIn` | `actor: UserType, filter: PaginationParams` | `Promise<FeatureRecord[]>` | Gets built-in features |
| `getCustom` | `actor: UserType, filter: PaginationParams` | `Promise<FeatureRecord[]>` | Gets custom features |

### PermissionService

Manages permissions for user access control.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertPermission, actor: UserType` | `Promise<PermissionRecord>` | Creates a new permission |
| `getById` | `id: string, actor: UserType` | `Promise<PermissionRecord>` | Gets a permission by ID |
| `list` | `filter: SelectPermissionFilter, actor: UserType` | `Promise<PermissionRecord[]>` | Lists permissions with filtering |
| `update` | `id: string, changes: UpdatePermissionData, actor: UserType` | `Promise<PermissionRecord>` | Updates a permission |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a permission |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted permission |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a permission |
| `getDeprecated` | `actor: UserType, filter: PaginationParams` | `Promise<PermissionRecord[]>` | Gets deprecated permissions |
| `addToRole` | `roleId: string, permissionId: string, actor: UserType` | `Promise<RolePermissionRecord>` | Adds a permission to a role |
| `removeFromRole` | `roleId: string, permissionId: string, actor: UserType` | `Promise<void>` | Removes a permission from a role |
| `listForRole` | `roleId: string, actor: UserType, filter: PaginationParams` | `Promise<RolePermissionRecord[]>` | Lists permissions for a role |
| `addToUser` | `userId: string, permissionId: string, actor: UserType` | `Promise<UserPermissionRecord>` | Adds a permission to a user |
| `removeFromUser` | `userId: string, permissionId: string, actor: UserType` | `Promise<void>` | Removes a permission from a user |
| `listForUser` | `userId: string, actor: UserType, filter: PaginationParams` | `Promise<UserPermissionRecord[]>` | Lists permissions for a user |
| `getRoles` | `id: string, actor: UserType, filter: PaginationParams` | `Promise<RoleRecord[]>` | Gets roles that have a permission |
| `userHas` | `userId: string, permissionId: string` | `Promise<boolean>` | Checks if a user has a permission |
| `roleHas` | `roleId: string, permissionId: string` | `Promise<boolean>` | Checks if a role has a permission |
| `clearAllFromRole` | `roleId: string, actor: UserType` | `Promise<void>` | Clears all permissions from a role |
| `clearAllFromUser` | `userId: string, actor: UserType` | `Promise<void>` | Clears all permissions from a user |

### PostService

Manages blog posts and content.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertPost, actor: UserType` | `Promise<PostRecord>` | Creates a new post |
| `getById` | `id: string, actor: UserType` | `Promise<PostRecord>` | Gets a post by ID |
| `list` | `filter: SelectPostFilter, actor: UserType` | `Promise<PostRecord[]>` | Lists posts with filtering |
| `update` | `id: string, changes: UpdatePostData, actor: UserType` | `Promise<PostRecord>` | Updates a post |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a post |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted post |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a post |
| `getByCategory` | `category: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets posts by category |
| `getByVisibility` | `visibility: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets posts by visibility |
| `addSponsor` | `postId: string, sponsorId: string, sponsorshipData: Object, actor: UserType` | `Promise<PostSponsorshipRecord>` | Adds a sponsor to a post |
| `removeSponsor` | `postId: string, sponsorId: string, actor: UserType` | `Promise<void>` | Removes a sponsor from a post |
| `addTag` | `postId: string, tagId: string, actor: UserType` | `Promise<EntityTagRecord>` | Adds a tag to a post |
| `removeTag` | `postId: string, tagId: string, actor: UserType` | `Promise<void>` | Removes a tag from a post |
| `getByDateRange` | `startDate: Date, endDate: Date, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets posts within a date range |
| `getFeatured` | `limit: number, actor: UserType` | `Promise<PostRecord[]>` | Gets featured posts |
| `getNews` | `limit: number, actor: UserType` | `Promise<PostRecord[]>` | Gets news posts |
| `getByRelatedDestination` | `destinationId: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets posts related to a destination |
| `getByRelatedAccommodation` | `accommodationId: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets posts related to an accommodation |
| `getByRelatedEvent` | `eventId: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets posts related to an event |
| `getBySlug` | `slug: string, actor: UserType` | `Promise<PostRecord>` | Gets a post by slug |
| `search` | `query: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Searches posts by text |
| `getDrafts` | `actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Gets draft posts |

### PostSponsorService

Manages sponsors for content.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertPostSponsor, actor: UserType` | `Promise<PostSponsorRecord>` | Creates a new sponsor |
| `getById` | `id: string, actor: UserType` | `Promise<PostSponsorRecord>` | Gets a sponsor by ID |
| `list` | `filter: SelectPostSponsorFilter, actor: UserType` | `Promise<PostSponsorRecord[]>` | Lists sponsors with filtering |
| `update` | `id: string, changes: UpdatePostSponsorData, actor: UserType` | `Promise<PostSponsorRecord>` | Updates a sponsor |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a sponsor |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted sponsor |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a sponsor |
| `getByPostId` | `postId: string, actor: UserType, filter: PaginationParams` | `Promise<PostSponsorshipRecord[]>` | Gets sponsors for a post |
| `assignToPost` | `postId: string, sponsorId: string, sponsorshipData: Object, actor: UserType` | `Promise<PostSponsorshipRecord>` | Assigns a sponsor to a post |
| `removeFromPost` | `postId: string, sponsorId: string, actor: UserType` | `Promise<void>` | Removes a sponsor from a post |
| `listPosts` | `sponsorId: string, actor: UserType, filter: PaginationParams` | `Promise<PostRecord[]>` | Lists posts for a sponsor |
| `getActive` | `actor: UserType, filter: PaginationParams` | `Promise<PostSponsorRecord[]>` | Gets active sponsors |

### PostSponsorshipService

Manages sponsorship details for posts.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertPostSponsorship, actor: UserType` | `Promise<PostSponsorshipRecord>` | Creates a new sponsorship |
| `getById` | `id: string, actor: UserType` | `Promise<PostSponsorshipRecord>` | Gets a sponsorship by ID |
| `list` | `filter: SelectPostSponsorshipFilter, actor: UserType` | `Promise<PostSponsorshipRecord[]>` | Lists sponsorships with filtering |
| `update` | `id: string, changes: UpdatePostSponsorshipData, actor: UserType` | `Promise<PostSponsorshipRecord>` | Updates a sponsorship |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a sponsorship |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted sponsorship |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a sponsorship |
| `listBySponsor` | `sponsorId: string, actor: UserType, filter: PaginationParams` | `Promise<PostSponsorshipRecord[]>` | Lists sponsorships for a sponsor |
| `getActive` | `actor: UserType, filter: PaginationParams` | `Promise<PostSponsorshipRecord[]>` | Gets active sponsorships |
| `getStats` | `actor: UserType` | `Promise<{ totalSponsorships: number; activeSponsorships: number; expiredSponsorships: number; upcomingSponsorships: number; totalSponsors: number; totalRevenue: number; averageDuration: number; }>` | Gets sponsorship statistics |

### RoleService

Manages user roles for access control.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertRole, actor: UserType` | `Promise<RoleRecord>` | Creates a new role |
| `getById` | `id: string, actor: UserType` | `Promise<RoleRecord>` | Gets a role by ID |
| `list` | `filter: SelectRoleFilter, actor: UserType` | `Promise<RoleRecord[]>` | Lists roles with filtering |
| `update` | `id: string, changes: UpdateRoleData, actor: UserType` | `Promise<RoleRecord>` | Updates a role |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a role |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted role |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a role |
| `assignToUser` | `roleId: string, userId: string, actor: UserType` | `Promise<UserRecord>` | Assigns a role to a user |
| `removeFromUser` | `roleId: string, userId: string, actor: UserType` | `Promise<UserRecord>` | Removes a role from a user |
| `listUsers` | `roleId: string, actor: UserType, filter: PaginationParams` | `Promise<UserRecord[]>` | Lists users with a role |
| `listPermissions` | `roleId: string, actor: UserType, filter: PaginationParams` | `Promise<RolePermissionRecord[]>` | Lists permissions for a role |
| `assignPermission` | `roleId: string, permissionId: string, actor: UserType` | `Promise<RolePermissionRecord>` | Assigns a permission to a role |
| `removePermission` | `roleId: string, permissionId: string, actor: UserType` | `Promise<void>` | Removes a permission from a role |
| `listBuiltIn` | `actor: UserType, filter: PaginationParams` | `Promise<RoleRecord[]>` | Lists built-in roles |
| `listCustom` | `actor: UserType, filter: PaginationParams` | `Promise<RoleRecord[]>` | Lists custom roles |
| `countUsers` | `roleId: string, actor: UserType` | `Promise<number>` | Counts users with a role |

### TagService

Manages tags for content categorization.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertTag, actor: UserType` | `Promise<TagRecord>` | Creates a new tag |
| `getById` | `id: string, actor: UserType` | `Promise<TagRecord>` | Gets a tag by ID |
| `list` | `filter: SelectTagFilter, actor: UserType` | `Promise<TagRecord[]>` | Lists tags with filtering |
| `update` | `id: string, changes: UpdateTagData, actor: UserType` | `Promise<TagRecord>` | Updates a tag |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a tag |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted tag |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a tag |
| `addToEntity` | `entityType: EntityTypeEnum, entityId: string, tagId: string, actor: UserType` | `Promise<EntityTagRecord>` | Adds a tag to an entity |
| `removeFromEntity` | `entityType: EntityTypeEnum, entityId: string, tagId: string, actor: UserType` | `Promise<void>` | Removes a tag from an entity |
| `listForEntity` | `entityType: EntityTypeEnum, entityId: string, actor: UserType, filter: PaginationParams` | `Promise<TagRecord[]>` | Lists tags for an entity |
| `listEntities` | `tagId: string, actor: UserType, filter: PaginationParams` | `Promise<EntityTagRecord[]>` | Lists entities for a tag |
| `search` | `query: string, actor: UserType, filter: PaginationParams` | `Promise<TagRecord[]>` | Searches tags by text |
| `getUsageCount` | `tagId: string, actor: UserType` | `Promise<number>` | Gets the usage count for a tag |
| `listMostUsed` | `limit: number, actor: UserType` | `Promise<Array<{ tag: TagRecord; count: number }>>` | Lists most used tags |
| `bulkAdd` | `entityType: EntityTypeEnum, entityId: string, tagIds: string[], actor: UserType` | `Promise<EntityTagRecord[]>` | Adds multiple tags to an entity |
| `bulkRemove` | `entityType: EntityTypeEnum, entityId: string, tagIds: string[], actor: UserType` | `Promise<void>` | Removes multiple tags from an entity |

### UserService

Manages user accounts and profiles.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `data: InsertUser, actor: UserType` | `Promise<UserRecord>` | Creates a new user |
| `getById` | `id: string, actor: UserType` | `Promise<UserRecord>` | Gets a user by ID |
| `list` | `filter: SelectUserFilter, actor: UserType` | `Promise<UserRecord[]>` | Lists users with filtering |
| `update` | `id: string, changes: UpdateUserData, actor: UserType` | `Promise<UserRecord>` | Updates a user |
| `delete` | `id: string, actor: UserType` | `Promise<void>` | Soft-deletes a user |
| `restore` | `id: string, actor: UserType` | `Promise<void>` | Restores a soft-deleted user |
| `hardDelete` | `id: string, actor: UserType` | `Promise<void>` | Permanently deletes a user |
| `changePassword` | `userId: string, newPassword: string, actor: UserType` | `Promise<void>` | Changes a user's password |
| `getByRole` | `roleId: string, actor: UserType, pagination: PaginationParams` | `Promise<UserRecord[]>` | Gets users by role |
| `findByUsername` | `username: string, actor: UserType` | `Promise<UserRecord \| undefined>` | Finds a user by username |
| `findByEmail` | `email: string, actor: UserType` | `Promise<UserRecord \| undefined>` | Finds a user by email |
| `resetPassword` | `userId: string, actor: UserType` | `Promise<void>` | Resets a user's password |
| `changeRole` | `userId: string, newRoleId: string, actor: UserType` | `Promise<UserRecord>` | Changes a user's role |
| `listAdmins` | `actor: UserType, pagination: PaginationParams` | `Promise<UserRecord[]>` | Lists admin users |
| `search` | `query: string, actor: UserType, pagination: PaginationParams` | `Promise<UserRecord[]>` | Searches users by text |
| `getByState` | `state: string, actor: UserType, pagination: PaginationParams` | `Promise<UserRecord[]>` | Gets users by state |
| `addPermission` | `userId: string, permissionId: string, actor: UserType` | `Promise<UserPermissionRecord>` | Adds a permission to a user |
| `removePermission` | `userId: string, permissionId: string, actor: UserType` | `Promise<void>` | Removes a permission from a user |
| `listPermissions` | `userId: string, actor: UserType, filter: PaginationParams` | `Promise<UserPermissionRecord[]>` | Lists permissions for a user |
| `addBookmark` | `userId: string, bookmarkData: Object, actor: UserType` | `Promise<BookmarkRecord>` | Adds a bookmark for a user |
| `removeBookmark` | `bookmarkId: string, actor: UserType` | `Promise<void>` | Removes a bookmark |
| `listBookmarks` | `userId: string, actor: UserType, filter: Object` | `Promise<BookmarkRecord[]>` | Lists bookmarks for a user |
| `updateProfile` | `userId: string, profileData: Partial<UserProfile>, actor: UserType` | `Promise<UserRecord>` | Updates a user's profile |

## Usage

### Setting Up the Database

```typescript
// Load environment variables
import 'dotenv/config';
import { db } from '@repo/db';

async function initializeDatabase() {
  try {
    // Run migrations and seed required data
    // This would normally be done via CLI commands
    console.log('Database initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}
```

### Using the Service Layer (Recommended)

```typescript
import { AccommodationService } from '@repo/db';

async function getAccommodationDetails(id: string, actor: UserType) {
  const accommodationService = new AccommodationService();
  
  try {
    // Service layer handles authorization and business logic
    const accommodation = await accommodationService.getWithDetails(id, actor);
    return accommodation;
  } catch (error) {
    console.error('Error fetching accommodation:', error);
    throw error;
  }
}
```

### Using the Model Layer (Advanced)

```typescript
import { AccommodationModel } from '@repo/db';

async function listAccommodations() {
  try {
    // Model layer for direct database access
    // No authorization checks at this level!
    const accommodations = await AccommodationModel.listAccommodations({
      limit: 10,
      includeDeleted: false
    });
    return accommodations;
  } catch (error) {
    console.error('Error listing accommodations:', error);
    throw error;
  }
}
```

## Database Operations

### Working with Entities

```typescript
// Creating an entity
const newAccommodation = await accommodationService.create({
  name: 'beach-house',
  displayName: 'Beach House',
  type: AccommodationTypeEnum.HOUSE,
  // other required fields...
}, currentUser);

// Updating an entity
const updatedAccommodation = await accommodationService.update(
  accommodationId,
  { displayName: 'Luxury Beach House' },
  currentUser
);

// Soft-deleting an entity
await accommodationService.delete(accommodationId, currentUser);

// Restoring a soft-deleted entity
await accommodationService.restore(accommodationId, currentUser);
```

### Working with Relationships

```typescript
// Adding amenities to an accommodation
await accommodationAmenityService.create({
  accommodationId,
  amenityId,
  isOptional: true
}, currentUser);

// Listing features for an accommodation
const features = await accommodationService.listFeatures(
  accommodationId, 
  currentUser, 
  { limit: 20 }
);
```

## Data Seeding

The package includes comprehensive seeding functionality:

- **Required Seeds**: Essential data like roles, permissions, initial admin user
- **Example Seeds**: Sample data for testing and development

To run seeding scripts:

```bash
# Seed required data only
npm run db:seed:required

# Seed example data
npm run db:seed:example

# Run both required and example seeds
npm run db:seed
```

## Migrations

Database migrations are stored as SQL files in the `src/migrations` directory.

```bash
# Generate a migration
npm run db:generate

# Push migrations to the database
npm run db:migrate

# View database schema in Studio
npm run db:studio
```

## Triggers and Automated Functionality

The database includes several triggers and functions:

- **Updated At Timestamp**: Automatically updates `updated_at` column on record changes
- **Search Index Materialized View**: Powers full-text search across entities
- **Delete Entity Bookmarks Trigger**: Automatically removes bookmarks when an entity is deleted

## Performance Considerations

- **Indexing**: Key columns are indexed for query performance
- **Soft Deletion**: Data is soft-deleted by default to maintain referential integrity
- **Connection Pooling**: Database connections are managed via a connection pool
- **Query Optimization**: Complex queries use prepared statements and indexes

## Best Practices

1. **Always Use Services**: The service layer ensures proper authorization and business logic
2. **Transaction Management**: Use transactions for operations that update multiple tables
3. **Error Handling**: Implement proper error handling and logging
4. **Soft Deletion**: Prefer soft delete over hard delete for data integrity
5. **Audit Fields**: Always include and update audit fields (created/updated/deletedBy)
6. **Connection Management**: Be mindful of connection pooling and resource cleanup

## License

This package is part of the Hospeda monorepo and is subject to the same licensing terms.
