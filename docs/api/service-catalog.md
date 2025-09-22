# Service Catalog - API Reference

Complete catalog of all available services in the Hospeda platform.

## 🔐 Authentication

All API requests require authentication via Clerk. Include the following header:

```http
Authorization: Bearer <clerk_session_token>
```

### Actor System

The API uses an **Actor-based permission system**:

- **Actor**: Represents the authenticated user making the request
- **Roles**: `USER`, `ADMIN`, `SUPER_ADMIN`
- **Permissions**: Granular permissions like `ACCOMMODATION_CREATE`, `USER_DELETE`, etc.

## 📊 Standard Response Format

All API responses follow this format:

```typescript
type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
};
```

## 🏠 Accommodation Service

Manages accommodation listings (hotels, apartments, etc.).

### Base URL: `/accommodations`

#### List Accommodations
```http
GET /accommodations
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `pageSize` (number): Items per page (default: 10, max: 100)
- `q` (string): Search query (name, description)
- `destinationId` (string): Filter by destination
- `priceMin` (number): Minimum price filter
- `priceMax` (number): Maximum price filter
- `accommodationType` (string): Filter by type
- `visibility` (string): `PUBLIC` | `PRIVATE` | `RESTRICTED`

**Response:**
```typescript
{
    success: true,
    data: {
        items: Accommodation[],
        pagination: {
            page: number,
            pageSize: number,
            total: number,
            totalPages: number
        }
    }
}
```

#### Get Accommodation by ID
```http
GET /accommodations/{id}
```

**Response:**
```typescript
{
    success: true,
    data: Accommodation
}
```

#### Create Accommodation
```http
POST /accommodations
```

**Required Permissions:** `ACCOMMODATION_CREATE`

**Request Body:**
```typescript
{
    name: string,
    description: string,
    accommodationType: AccommodationTypeEnum,
    destinationId: string,
    location: LocationInput,
    amenities: string[],
    pricePerNight: number,
    currency: CurrencyEnum,
    maxGuests: number,
    // ... other fields
}
```

#### Update Accommodation
```http
PUT /accommodations/{id}
```

**Required Permissions:** `ACCOMMODATION_UPDATE` or ownership

#### Delete Accommodation
```http
DELETE /accommodations/{id}
```

**Required Permissions:** `ACCOMMODATION_DELETE` or ownership

---

## 🌍 Destination Service

Manages tourist destinations.

### Base URL: `/destinations`

#### List Destinations
```http
GET /destinations
```

**Query Parameters:**
- `page`, `pageSize`: Pagination
- `q`: Search query
- `country`: Filter by country
- `isFeatured`: Filter featured destinations

#### Get Destination by ID
```http
GET /destinations/{id}
```

#### Get Destination by Slug
```http
GET /destinations/slug/{slug}
```

#### Create Destination
```http
POST /destinations
```

**Required Permissions:** `DESTINATION_CREATE`

**Request Body:**
```typescript
{
    slug: string,
    name: string,
    summary: string,
    description: string,
    location: LocationInput,
    isFeatured?: boolean,
    media?: MediaInput
}
```

---

## 👤 User Service

Manages user accounts and profiles.

### Base URL: `/users`

#### Search Users
```http
GET /users
```

**Required Permissions:** `USER_LIST`

**Query Parameters:**
- `page`, `pageSize`: Pagination
- `q`: Search by name, email
- `role`: Filter by role
- `status`: Filter by status

#### Get User by ID
```http
GET /users/{id}
```

**Required Permissions:** `USER_READ` or self-access

#### Update User
```http
PUT /users/{id}
```

**Required Permissions:** `USER_UPDATE` or self-access

#### Assign Role
```http
POST /users/{id}/role
```

**Required Permissions:** `USER_ROLE_ASSIGN`

**Request Body:**
```typescript
{
    role: RoleEnum
}
```

#### Add Permission
```http
POST /users/{id}/permissions
```

**Required Permissions:** `USER_PERMISSION_MANAGE`

**Request Body:**
```typescript
{
    permission: PermissionEnum
}
```

---

## 🔖 User Bookmark Service

Manages user bookmarks for accommodations and destinations.

### Base URL: `/user-bookmarks`

#### List User Bookmarks
```http
GET /user-bookmarks
```

**Query Parameters:**
- `userId`: Filter by user (admins only)
- `entityType`: Filter by entity type
- `page`, `pageSize`: Pagination

#### Create Bookmark
```http
POST /user-bookmarks
```

**Request Body:**
```typescript
{
    entityId: string,
    entityType: EntityTypeEnum,
    name?: string,
    description?: string
}
```

#### Delete Bookmark
```http
DELETE /user-bookmarks/{id}
```

---

## 📅 Event Service

Manages events and activities.

### Base URL: `/events`

#### List Events
```http
GET /events
```

**Query Parameters:**
- `page`, `pageSize`: Pagination
- `q`: Search query
- `category`: Filter by category
- `organizerId`: Filter by organizer
- `locationId`: Filter by location
- `startDate`: Filter events after date
- `endDate`: Filter events before date

#### Get Upcoming Events
```http
GET /events/upcoming
```

#### Get Free Events
```http
GET /events/free
```

#### Get Events by Category
```http
GET /events/category/{category}
```

#### Create Event
```http
POST /events
```

**Required Permissions:** `EVENT_CREATE`

**Request Body:**
```typescript
{
    name: string,
    description: string,
    category: EventCategoryEnum,
    startDate: Date,
    endDate: Date,
    location: EventLocationInput,
    organizerId: string,
    price?: PriceInput,
    maxAttendees?: number
}
```

---

## 📝 Post Service

Manages blog posts and content.

### Base URL: `/posts`

#### List Posts
```http
GET /posts
```

**Query Parameters:**
- `page`, `pageSize`: Pagination
- `q`: Search query
- `category`: Filter by category
- `authorId`: Filter by author
- `isFeatured`: Filter featured posts
- `isNews`: Filter news posts

#### Get Post by ID
```http
GET /posts/{id}
```

#### Get Post by Slug
```http
GET /posts/slug/{slug}
```

#### Create Post
```http
POST /posts
```

**Required Permissions:** `POST_CREATE`

**Request Body:**
```typescript
{
    slug: string,
    title: string,
    summary: string,
    content: string,
    category: PostCategoryEnum,
    media?: MediaInput,
    isFeatured?: boolean,
    isNews?: boolean,
    publishedAt?: Date
}
```

---

## 🏷️ Tag Service

Manages tags for content organization.

### Base URL: `/tags`

#### List Tags
```http
GET /tags
```

#### Create Tag
```http
POST /tags
```

**Required Permissions:** `TAG_CREATE`

**Request Body:**
```typescript
{
    name: string,
    color?: string,
    description?: string
}
```

---

## 🎯 Amenity Service

Manages accommodation amenities.

### Base URL: `/amenities`

#### List Amenities
```http
GET /amenities
```

#### Create Amenity
```http
POST /amenities
```

**Required Permissions:** `AMENITY_CREATE`

---

## 📍 Attraction Service

Manages tourist attractions.

### Base URL: `/attractions`

#### List Attractions
```http
GET /attractions
```

#### Get Attractions by Destination
```http
GET /attractions/destination/{destinationId}
```

---

## 🚨 Error Codes

Standard error codes used across all services:

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `INTERNAL_ERROR` | Server error |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## 📊 Pagination

All list endpoints support pagination:

```typescript
{
    page: number,        // Current page (1-based)
    pageSize: number,    // Items per page (max 100)
    total: number,       // Total items
    totalPages: number   // Total pages
}
```

## 🔍 Search

Most endpoints support text search via the `q` parameter:

- Searches across relevant text fields (name, description, etc.)
- Case-insensitive partial matching
- Supports multiple words

## 🎛️ Filtering

Services support various filters:

- **Enum fields**: Exact matching
- **Date fields**: Range filtering with `startDate`/`endDate`
- **Numeric fields**: Range filtering with `min`/`max` prefixes
- **Boolean fields**: `true`/`false` values
- **Reference fields**: ID-based filtering

## 📈 Rate Limiting

Default rate limits apply:

- **Authenticated requests**: 100 requests per minute
- **Unauthenticated requests**: 20 requests per minute
- **Create/Update/Delete**: 30 requests per minute

## 🔒 Permissions Reference

### User Permissions
- `USER_CREATE`, `USER_READ`, `USER_UPDATE`, `USER_DELETE`
- `USER_LIST`, `USER_ROLE_ASSIGN`, `USER_PERMISSION_MANAGE`

### Accommodation Permissions
- `ACCOMMODATION_CREATE`, `ACCOMMODATION_READ`, `ACCOMMODATION_UPDATE`, `ACCOMMODATION_DELETE`
- `ACCOMMODATION_LIST`, `ACCOMMODATION_MODERATE`

### Destination Permissions
- `DESTINATION_CREATE`, `DESTINATION_READ`, `DESTINATION_UPDATE`, `DESTINATION_DELETE`
- `DESTINATION_LIST`, `DESTINATION_MODERATE`

### Content Permissions
- `POST_CREATE`, `POST_READ`, `POST_UPDATE`, `POST_DELETE`
- `EVENT_CREATE`, `EVENT_READ`, `EVENT_UPDATE`, `EVENT_DELETE`
- `TAG_CREATE`, `TAG_UPDATE`, `TAG_DELETE`

## 🛠️ SDK Examples

### JavaScript/TypeScript

```typescript
import { HospedaClient } from '@hospeda/sdk';

const client = new HospedaClient({
    baseUrl: 'https://api.hospeda.com',
    token: clerkToken
});

// List accommodations
const accommodations = await client.accommodations.list({
    destinationId: 'uuid',
    priceMax: 100
});

// Create accommodation
const newAccommodation = await client.accommodations.create({
    name: 'Beautiful Villa',
    description: 'A stunning villa...',
    // ... other fields
});
```

### cURL Examples

```bash
# List accommodations
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.hospeda.com/accommodations?destinationId=uuid&priceMax=100"

# Create accommodation
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Beautiful Villa","description":"A stunning villa..."}' \
  "https://api.hospeda.com/accommodations"
```

## 📞 Support

For API support:
- **Documentation Issues**: Update this file with corrections
- **Permission Issues**: Check the permissions reference above
- **Rate Limiting**: Contact admin for limit increases
- **Bug Reports**: Create an issue in the repository