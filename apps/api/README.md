# Hospeda API

The Hospeda API provides a comprehensive backend for the Hospeda platform, offering endpoints for managing accommodations, destinations, events, users, and more.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Public API](#public-api)
  - [Admin API](#admin-api)
- [Middleware](#middleware)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Types](#types)

## Overview

The Hospeda API is built with Hono.js, a lightweight, high-performance framework. It provides both public-facing endpoints for the frontend application and admin endpoints for the management interface.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm start
```

## Authentication

The API uses JWT-based authentication. Include the JWT token in the `Authorization` header as follows:

```
Authorization: Bearer <token>
```

Authentication middleware provides these functions:
- `authMiddleware`: Attaches user to context if authenticated
- `requireAuth`: Ensures the request is authenticated
- `requireAdmin`: Ensures the user has admin privileges
- `requirePermission(permission)`: Ensures the user has a specific permission

## Endpoints

### Public API

#### Health Check

- **GET** `/health`
  - Returns API operational status
  - Response: `{ status: 'ok', timestamp: string }`

#### Search

- **GET** `/api/v1/public/search`
  - Search across multiple entity types
  - Parameters:
    - `q` (string): Search query
    - `types` (array): Entity types to search (`accommodations`, `destinations`, `events`, `posts`)
    - `limit` (number): Maximum results per type
  - Response: Combined search results across requested entity types

#### Accommodations

- **GET** `/api/v1/public/accommodations`
  - List public accommodations
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `type` (string, optional): Accommodation type
    - `destinationId` (UUID, optional): Filter by destination
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured accommodations
  - Response: Paginated list of accommodations

- **GET** `/api/v1/public/accommodations/:id`
  - Get accommodation details
  - Parameters:
    - `id` (UUID): Accommodation ID
  - Response: Detailed accommodation information

- **GET** `/api/v1/public/accommodations/featured`
  - Get featured accommodations
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of featured accommodations

- **GET** `/api/v1/public/accommodations/search`
  - Search accommodations
  - Parameters:
    - `query` (string): Search query
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated search results

- **GET** `/api/v1/public/accommodations/destination/:id`
  - Get accommodations by destination
  - Parameters:
    - `id` (UUID): Destination ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of accommodations in the destination

#### Destinations

- **GET** `/api/v1/public/destinations`
  - List public destinations
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured destinations
  - Response: Paginated list of destinations

- **GET** `/api/v1/public/destinations/:id`
  - Get destination details
  - Parameters:
    - `id` (UUID): Destination ID
  - Response: Detailed destination information

- **GET** `/api/v1/public/destinations/featured`
  - Get featured destinations
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of featured destinations

- **GET** `/api/v1/public/destinations/top`
  - Get top-rated destinations
  - Parameters:
    - `limit` (number): Maximum number of destinations to return
  - Response: List of top-rated destinations

- **GET** `/api/v1/public/destinations/nearby`
  - Find destinations near coordinates
  - Parameters:
    - `lat` (number): Latitude (-90 to 90)
    - `lng` (number): Longitude (-180 to 180)
    - `radius` (number): Search radius in kilometers
    - `limit` (number): Maximum results
  - Response: List of nearby destinations

#### Events

- **GET** `/api/v1/public/events`
  - List public events
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `category` (string, optional): Event category
    - `locationId` (UUID, optional): Filter by location
    - `organizerId` (UUID, optional): Filter by organizer
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured events
  - Response: Paginated list of events

- **GET** `/api/v1/public/events/:id`
  - Get event details
  - Parameters:
    - `id` (UUID): Event ID
  - Response: Detailed event information

- **GET** `/api/v1/public/events/upcoming`
  - Get upcoming events
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of upcoming events

- **GET** `/api/v1/public/events/this-week`
  - Get events this week
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of this week's events

- **GET** `/api/v1/public/events/date-range`
  - Get events within a date range
  - Parameters:
    - `startDate` (string): Start date (YYYY-MM-DD)
    - `endDate` (string): End date (YYYY-MM-DD)
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of events within date range

#### Posts

- **GET** `/api/v1/public/posts`
  - List public posts
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `category` (string, optional): Post category
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured posts
    - `isNews` (boolean, optional): Filter news posts
  - Response: Paginated list of posts

- **GET** `/api/v1/public/posts/:id`
  - Get post details
  - Parameters:
    - `id` (UUID): Post ID
  - Response: Detailed post information

- **GET** `/api/v1/public/posts/slug/:slug`
  - Get post by slug
  - Parameters:
    - `slug` (string): Post slug
  - Response: Detailed post information

- **GET** `/api/v1/public/posts/featured`
  - Get featured posts
  - Parameters:
    - `limit` (number): Maximum number of posts to return
  - Response: List of featured posts

- **GET** `/api/v1/public/posts/news`
  - Get news posts
  - Parameters:
    - `limit` (number): Maximum number of posts to return
  - Response: List of news posts

- **GET** `/api/v1/public/posts/category/:category`
  - Get posts by category
  - Parameters:
    - `category` (string): Post category
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of posts in category

- **GET** `/api/v1/public/posts/destination/:id`
  - Get posts related to a destination
  - Parameters:
    - `id` (UUID): Destination ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of related posts

### Admin API

#### Accommodations

- **GET** `/api/v1/admin/accommodations`
  - List all accommodations (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `type` (string, optional): Accommodation type
    - `destinationId` (UUID, optional): Filter by destination
    - `ownerId` (UUID, optional): Filter by owner
    - `state` (string, optional): Filter by state
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured accommodations
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of accommodations

- **GET** `/api/v1/admin/accommodations/:id`
  - Get accommodation by ID (requires admin)
  - Parameters:
    - `id` (UUID): Accommodation ID
  - Response: Detailed accommodation information

- **POST** `/api/v1/admin/accommodations`
  - Create accommodation (requires admin)
  - Body: Accommodation data (following AccommodationCreateSchema)
  - Response: Created accommodation

- **PUT** `/api/v1/admin/accommodations/:id`
  - Update accommodation (requires admin)
  - Parameters:
    - `id` (UUID): Accommodation ID
  - Body: Accommodation data (following AccommodationUpdateSchema)
  - Response: Updated accommodation

- **DELETE** `/api/v1/admin/accommodations/:id`
  - Soft-delete accommodation (requires admin)
  - Parameters:
    - `id` (UUID): Accommodation ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/accommodations/:id/restore`
  - Restore soft-deleted accommodation (requires admin)
  - Parameters:
    - `id` (UUID): Accommodation ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/accommodations/destination/:id`
  - List accommodations by destination (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of accommodations

#### Amenities

- **GET** `/api/v1/admin/amenities`
  - List all amenities (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `type` (string, optional): Amenity type
    - `state` (string, optional): Filter by state
    - `isBuiltin` (boolean, optional): Filter built-in amenities
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of amenities

- **GET** `/api/v1/admin/amenities/:id`
  - Get amenity by ID (requires admin)
  - Parameters:
    - `id` (UUID): Amenity ID
  - Response: Detailed amenity information

- **POST** `/api/v1/admin/amenities`
  - Create amenity (requires admin)
  - Body: Amenity data (following AmenitySchema)
  - Response: Created amenity

- **PUT** `/api/v1/admin/amenities/:id`
  - Update amenity (requires admin)
  - Parameters:
    - `id` (UUID): Amenity ID
  - Body: Amenity data (following AmenitySchema)
  - Response: Updated amenity

- **DELETE** `/api/v1/admin/amenities/:id`
  - Soft-delete amenity (requires admin)
  - Parameters:
    - `id` (UUID): Amenity ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/amenities/:id/restore`
  - Restore soft-deleted amenity (requires admin)
  - Parameters:
    - `id` (UUID): Amenity ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/amenities/type/:type`
  - List amenities by type (requires admin)
  - Parameters:
    - `type` (string): Amenity type
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of amenities

- **GET** `/api/v1/admin/amenities/builtin`
  - List built-in amenities (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of built-in amenities

#### Destinations

- **GET** `/api/v1/admin/destinations`
  - List all destinations (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `visibility` (string, optional): Filter by visibility
    - `state` (string, optional): Filter by state
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured destinations
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of destinations

- **GET** `/api/v1/admin/destinations/:id`
  - Get destination by ID (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
  - Response: Detailed destination information

- **POST** `/api/v1/admin/destinations`
  - Create destination (requires admin)
  - Body: Destination data (following DestinationCreateSchema)
  - Response: Created destination

- **PUT** `/api/v1/admin/destinations/:id`
  - Update destination (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
  - Body: Destination data (following DestinationUpdateSchema)
  - Response: Updated destination

- **DELETE** `/api/v1/admin/destinations/:id`
  - Soft-delete destination (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/destinations/:id/restore`
  - Restore soft-deleted destination (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/destinations/:id/stats`
  - Get destination statistics (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
  - Response: Destination statistics

- **PATCH** `/api/v1/admin/destinations/:id/visibility`
  - Update destination visibility (requires admin)
  - Parameters:
    - `id` (UUID): Destination ID
  - Body: `{ visibility: 'PUBLIC' | 'DRAFT' | 'PRIVATE' }`
  - Response: Updated destination

#### Events

- **GET** `/api/v1/admin/events`
  - List all events (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `category` (string, optional): Filter by category
    - `authorId` (UUID, optional): Filter by author
    - `locationId` (UUID, optional): Filter by location
    - `organizerId` (UUID, optional): Filter by organizer
    - `visibility` (string, optional): Filter by visibility
    - `state` (string, optional): Filter by state
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured events
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of events

- **GET** `/api/v1/admin/events/:id`
  - Get event by ID (requires admin)
  - Parameters:
    - `id` (UUID): Event ID
  - Response: Detailed event information

- **POST** `/api/v1/admin/events`
  - Create event (requires admin)
  - Body: Event data (following EventCreateSchema)
  - Response: Created event

- **PUT** `/api/v1/admin/events/:id`
  - Update event (requires admin)
  - Parameters:
    - `id` (UUID): Event ID
  - Body: Event data (following EventUpdateSchema)
  - Response: Updated event

- **DELETE** `/api/v1/admin/events/:id`
  - Soft-delete event (requires admin)
  - Parameters:
    - `id` (UUID): Event ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/events/:id/restore`
  - Restore soft-deleted event (requires admin)
  - Parameters:
    - `id` (UUID): Event ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/events/location/:id`
  - List events by location (requires admin)
  - Parameters:
    - `id` (UUID): Location ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of events at location

- **GET** `/api/v1/admin/events/organizer/:id`
  - List events by organizer (requires admin)
  - Parameters:
    - `id` (UUID): Organizer ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of events by organizer

- **POST** `/api/v1/admin/events/:id/publish`
  - Publish an event (requires admin)
  - Parameters:
    - `id` (UUID): Event ID
  - Response: Updated event with PUBLIC visibility

- **POST** `/api/v1/admin/events/:id/unpublish`
  - Unpublish an event (requires admin)
  - Parameters:
    - `id` (UUID): Event ID
  - Response: Updated event with DRAFT visibility

#### Features

- **GET** `/api/v1/admin/features`
  - List all features (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `state` (string, optional): Filter by state
    - `isBuiltin` (boolean, optional): Filter built-in features
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of features

- **GET** `/api/v1/admin/features/:id`
  - Get feature by ID (requires admin)
  - Parameters:
    - `id` (UUID): Feature ID
  - Response: Detailed feature information

- **POST** `/api/v1/admin/features`
  - Create feature (requires admin)
  - Body: Feature data (following FeatureSchema)
  - Response: Created feature

- **PUT** `/api/v1/admin/features/:id`
  - Update feature (requires admin)
  - Parameters:
    - `id` (UUID): Feature ID
  - Body: Feature data (following FeatureSchema)
  - Response: Updated feature

- **DELETE** `/api/v1/admin/features/:id`
  - Soft-delete feature (requires admin)
  - Parameters:
    - `id` (UUID): Feature ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/features/:id/restore`
  - Restore soft-deleted feature (requires admin)
  - Parameters:
    - `id` (UUID): Feature ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/features/builtin`
  - List built-in features (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of built-in features

#### Permissions

- **GET** `/api/v1/admin/permissions`
  - List all permissions (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `isDeprecated` (boolean, optional): Filter deprecated permissions
    - `state` (string, optional): Filter by state
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of permissions

- **GET** `/api/v1/admin/permissions/:id`
  - Get permission by ID (requires admin)
  - Parameters:
    - `id` (UUID): Permission ID
  - Response: Detailed permission information

- **POST** `/api/v1/admin/permissions`
  - Create permission (requires admin)
  - Body: Permission data (following PermissionCreateSchema)
  - Response: Created permission

- **PUT** `/api/v1/admin/permissions/:id`
  - Update permission (requires admin)
  - Parameters:
    - `id` (UUID): Permission ID
  - Body: Permission data (following PermissionUpdateSchema)
  - Response: Updated permission

- **DELETE** `/api/v1/admin/permissions/:id`
  - Soft-delete permission (requires admin)
  - Parameters:
    - `id` (UUID): Permission ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/permissions/:id/restore`
  - Restore soft-deleted permission (requires admin)
  - Parameters:
    - `id` (UUID): Permission ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/permissions/:id/roles`
  - List roles with this permission (requires admin)
  - Parameters:
    - `id` (UUID): Permission ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: List of roles that have this permission

- **POST** `/api/v1/admin/permissions/assign/user`
  - Assign permission to user (requires admin)
  - Body: `{ userId: string, permissionId: string }`
  - Response: Created user-permission relation

- **DELETE** `/api/v1/admin/permissions/assign/user`
  - Remove permission from user (requires admin)
  - Body: `{ userId: string, permissionId: string }`
  - Response: Success confirmation

- **GET** `/api/v1/admin/permissions/deprecated`
  - List deprecated permissions (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of deprecated permissions

#### Posts

- **GET** `/api/v1/admin/posts`
  - List all posts (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `category` (string, optional): Filter by category
    - `visibility` (string, optional): Filter by visibility
    - `state` (string, optional): Filter by state
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `isFeatured` (boolean, optional): Filter featured posts
    - `isNews` (boolean, optional): Filter news posts
    - `isFeaturedInWebsite` (boolean, optional): Filter posts featured on website
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of posts

- **GET** `/api/v1/admin/posts/:id`
  - Get post by ID (requires admin)
  - Parameters:
    - `id` (UUID): Post ID
  - Response: Detailed post information

- **POST** `/api/v1/admin/posts`
  - Create post (requires admin)
  - Body: Post data (following PostCreateSchema)
  - Response: Created post

- **PUT** `/api/v1/admin/posts/:id`
  - Update post (requires admin)
  - Parameters:
    - `id` (UUID): Post ID
  - Body: Post data (following PostUpdateSchema)
  - Response: Updated post

- **DELETE** `/api/v1/admin/posts/:id`
  - Soft-delete post (requires admin)
  - Parameters:
    - `id` (UUID): Post ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/posts/:id/restore`
  - Restore soft-deleted post (requires admin)
  - Parameters:
    - `id` (UUID): Post ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/posts/:id/sponsors`
  - Add sponsor to post (requires admin)
  - Parameters:
    - `id` (UUID): Post ID
  - Body: Sponsorship data
  - Response: Created sponsorship

- **DELETE** `/api/v1/admin/posts/:id/sponsors/:sponsorId`
  - Remove sponsor from post (requires admin)
  - Parameters:
    - `id` (UUID): Post ID
    - `sponsorId` (UUID): Sponsor ID
  - Response: Success confirmation

#### Roles

- **GET** `/api/v1/admin/roles`
  - List all roles (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `isBuiltIn` (boolean, optional): Filter built-in roles
    - `isDeprecated` (boolean, optional): Filter deprecated roles
    - `isDefault` (boolean, optional): Filter default roles
    - `state` (string, optional): Filter by state
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of roles

- **GET** `/api/v1/admin/roles/:id`
  - Get role by ID (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
  - Response: Detailed role information

- **POST** `/api/v1/admin/roles`
  - Create role (requires admin)
  - Body: Role data (following RoleCreateSchema)
  - Response: Created role

- **PUT** `/api/v1/admin/roles/:id`
  - Update role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
  - Body: Role data (following RoleUpdateSchema)
  - Response: Updated role

- **DELETE** `/api/v1/admin/roles/:id`
  - Soft-delete role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/roles/:id/restore`
  - Restore soft-deleted role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/roles/:id/users`
  - List users with this role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: Paginated list of users with this role

- **GET** `/api/v1/admin/roles/:id/permissions`
  - List permissions for role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
    - `page` (number): Page number
    - `limit` (number): Items per page
  - Response: List of permissions for this role

- **POST** `/api/v1/admin/roles/:id/permissions`
  - Add permission to role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
  - Body: `{ permissionId: string }`
  - Response: Created role-permission relation

- **DELETE** `/api/v1/admin/roles/:id/permissions/:permissionId`
  - Remove permission from role (requires admin)
  - Parameters:
    - `id` (UUID): Role ID
    - `permissionId` (UUID): Permission ID
  - Response: Success confirmation

#### Users

- **GET** `/api/v1/admin/users`
  - List all users (requires admin)
  - Parameters:
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `query` (string, optional): Search query
    - `roleId` (UUID, optional): Filter by role
    - `state` (string, optional): Filter by state
    - `orderBy` (string, optional): Sort field
    - `order` (enum, optional): Sort order (`asc` or `desc`)
    - `includeDeleted` (boolean, optional): Include soft-deleted records
  - Response: Paginated list of users

- **GET** `/api/v1/admin/users/:id`
  - Get user by ID (requires admin)
  - Parameters:
    - `id` (UUID): User ID
  - Response: Detailed user information

- **POST** `/api/v1/admin/users`
  - Create user (requires admin)
  - Body: User data (following UserCreateSchema)
  - Response: Created user

- **PUT** `/api/v1/admin/users/:id`
  - Update user (requires admin)
  - Parameters:
    - `id` (UUID): User ID
  - Body: User data (following UserUpdateSchema)
  - Response: Updated user

- **DELETE** `/api/v1/admin/users/:id`
  - Soft-delete user (requires admin)
  - Parameters:
    - `id` (UUID): User ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/users/:id/restore`
  - Restore soft-deleted user (requires admin)
  - Parameters:
    - `id` (UUID): User ID
  - Response: Success confirmation

- **POST** `/api/v1/admin/users/:id/role`
  - Change user's role (requires admin)
  - Parameters:
    - `id` (UUID): User ID
  - Body: `{ roleId: string }`
  - Response: Updated user

- **POST** `/api/v1/admin/users/:id/reset-password`
  - Reset user's password (requires admin)
  - Parameters:
    - `id` (UUID): User ID
  - Response: Success confirmation

- **GET** `/api/v1/admin/users/:id/bookmarks`
  - List user's bookmarks (requires admin or self)
  - Parameters:
    - `id` (UUID): User ID
    - `page` (number): Page number
    - `limit` (number): Items per page
    - `entityType` (string, optional): Filter by entity type
  - Response: Paginated list of bookmarks

## Middleware

### Error Middleware

The error middleware (`errorMiddleware`) catches and formats all errors thrown during request processing:

- Validation errors (ZodError)
- HTTP errors with status codes
- General server errors

### Logger Middleware

The logger middleware (`loggerMiddleware`) logs information about requests and responses:

- Start of request
- End of request with status and response time
- Errors

### Auth Middleware

Authentication middleware provides several functions:

- `authMiddleware`: Extracts and verifies JWT token, attaches user to context
- `requireAuth`: Ensures the request is authenticated
- `requireAdmin`: Ensures the user has admin privileges
- `requirePermission(permission)`: Ensures the user has a specific permission

## Response Format

All API endpoints return responses in a consistent format:

### Success Responses

Simple success:
```json
{
  "success": true,
  "data": { ... }
}
```

Paginated success:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3,
    "hasMore": true
  }
}
```

### Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": [ ... ]  // Optional, present for validation errors
  }
}
```

Common error codes:
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Permission denied
- `SERVER_ERROR`: Internal server error

## Error Handling

The API uses a centralized error handling middleware that:

1. Catches all exceptions during request processing
2. Formats errors into a consistent response format
3. Logs errors with appropriate context
4. Returns appropriate HTTP status codes

For validation errors (ZodError), the response includes detailed validation issues.

## Types

The API uses TypeScript for type safety. Key type definitions:

### Public User

A default user object used for public API access:

```typescript
const publicUser: UserType = {
    id: 'public',
    roleId: 'USER',
    permissions: [],
    userName: '',
    passwordHash: '',
    state: StateEnum.ACTIVE,
    name: '',
    displayName: '',
    createdAt: new Date(),
    createdById: '',
    updatedAt: new Date(),
    updatedById: ''
};
```

This is used to make calls to services from public endpoints without requiring authentication.

## Database Integration

The API integrates with the `@repo/db` package for data access, which provides:

- Data models for all entities
- Service layer with business logic
- Type-safe database operations using Drizzle ORM
