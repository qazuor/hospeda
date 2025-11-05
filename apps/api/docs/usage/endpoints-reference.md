# Endpoints Reference

Complete reference of all available API endpoints.

---

## Base URL

```text
https://api.hospeda.com
```

All endpoints are prefixed with `/api/v1` unless noted otherwise.

---

## Health & Metrics

### GET /health

Check API health status.

**Auth Required:** No

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-11-04T12:00:00.000Z",
  "uptime": 123456.789,
  "version": "1.0.0"
}
```

### GET /metrics

Get API performance metrics.

**Auth Required:** No

**Response:** Prometheus-formatted metrics

---

## Accommodations

### GET /api/v1/accommodations

List all accommodations.

**Auth Required:** No

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 10 | Items per page |
| `isActive` | boolean | - | Filter by status |
| `search` | string | - | Search by name |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "name": "Hotel Example",
      "slug": "hotel-example",
      "address": "123 Main St",
      "city": "Buenos Aires",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### GET /api/v1/accommodations/:id

Get single accommodation by ID.

**Auth Required:** No

**Path Parameters:**

- `id` (string) - Accommodation ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Hotel Example",
    "slug": "hotel-example",
    "address": "123 Main St",
    "city": "Buenos Aires",
    "province": "Buenos Aires",
    "country": "Argentina",
    "description": "Comfortable hotel...",
    "isActive": true,
    "createdAt": "2024-11-04T12:00:00.000Z",
    "updatedAt": "2024-11-04T12:00:00.000Z"
  }
}
```

### POST /api/v1/accommodations

Create new accommodation.

**Auth Required:** Yes

**Request Body:**

```json
{
  "name": "New Hotel",
  "slug": "new-hotel",
  "address": "123 Main St",
  "city": "Buenos Aires",
  "province": "Buenos Aires",
  "country": "Argentina",
  "description": "A comfortable hotel",
  "isActive": true
}
```

**Response:** 201 Created

```json
{
  "success": true,
  "data": {
    "id": "124",
    "name": "New Hotel",
    "slug": "new-hotel",
    ...
  }
}
```

### PATCH /api/v1/accommodations/:id

Update accommodation.

**Auth Required:** Yes

**Path Parameters:**

- `id` (string) - Accommodation ID

**Request Body:**

```json
{
  "name": "Updated Hotel Name",
  "description": "Updated description"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Updated Hotel Name",
    ...
  }
}
```

### DELETE /api/v1/accommodations/:id

Delete accommodation (soft delete).

**Auth Required:** Yes

**Path Parameters:**

- `id` (string) - Accommodation ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "123",
    "deletedAt": "2024-11-04T12:00:00.000Z"
  }
}
```

---

## Destinations

### GET /api/v1/destinations

List all destinations.

**Auth Required:** No

**Query Parameters:** Same as accommodations

**Response:** Paginated list of destinations

### GET /api/v1/destinations/:id

Get single destination.

**Auth Required:** No

### POST /api/v1/destinations

Create destination.

**Auth Required:** Yes

### PATCH /api/v1/destinations/:id

Update destination.

**Auth Required:** Yes

### DELETE /api/v1/destinations/:id

Delete destination.

**Auth Required:** Yes

---

## Events

### GET /api/v1/events

List all events.

**Auth Required:** No

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `pageSize` | number | Items per page |
| `startDate` | string (ISO) | Filter by start date |
| `endDate` | string (ISO) | Filter by end date |

### GET /api/v1/events/:id

Get single event.

**Auth Required:** No

### POST /api/v1/events

Create event.

**Auth Required:** Yes

### PATCH /api/v1/events/:id

Update event.

**Auth Required:** Yes

### DELETE /api/v1/events/:id

Delete event.

**Auth Required:** Yes

---

## Posts

### GET /api/v1/posts

List all posts.

**Auth Required:** No

### GET /api/v1/posts/:id

Get single post.

**Auth Required:** No

### POST /api/v1/posts

Create post.

**Auth Required:** Yes

### PATCH /api/v1/posts/:id

Update post.

**Auth Required:** Yes

### DELETE /api/v1/posts/:id

Delete post.

**Auth Required:** Yes

---

## Users

### GET /api/v1/users

List all users.

**Auth Required:** Yes (Admin only)

### GET /api/v1/users/:id

Get single user.

**Auth Required:** Yes

### PATCH /api/v1/users/:id

Update user.

**Auth Required:** Yes

### DELETE /api/v1/users/:id

Delete user.

**Auth Required:** Yes (Admin only)

---

## Example Requests

### cURL

```bash
# List accommodations
curl https://api.hospeda.com/api/v1/accommodations

# Get specific accommodation
curl https://api.hospeda.com/api/v1/accommodations/123

# Create accommodation (authenticated)
curl -X POST https://api.hospeda.com/api/v1/accommodations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Hotel","slug":"new-hotel"}'
```

### JavaScript/TypeScript

```typescript
// List accommodations
const response = await fetch('https://api.hospeda.com/api/v1/accommodations')
const data = await response.json()

// Create accommodation (authenticated)
const token = await getToken()
const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'New Hotel',
    slug: 'new-hotel'
  })
})
```

---

## Next Steps

- [Authentication](authentication.md) - How to authenticate
- [Request/Response Format](request-response.md) - API format
- [Error Handling](errors.md) - Error codes

---

⬅️ Back to [API Usage Guide](README.md)
