# Request/Response Format

Standard formats for requests and responses in the Hospeda API.

---

## Response Format

All API responses follow a standardized JSON structure.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Hotel Example",
    "slug": "hotel-example"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [
    { "id": "1", "name": "Hotel A" },
    { "id": "2", "name": "Hotel B" }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

## Pagination

List endpoints support pagination via query parameters.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 10 | Items per page (1-100) |

### Example Request

```bash
curl "https://api.hospeda.com/api/v1/accommodations?page=2&pageSize=20"
```

### Example Response

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Pagination Logic

```typescript
const response = await fetch(
  `https://api.hospeda.com/api/v1/accommodations?page=${page}&pageSize=${pageSize}`
)

const { data, pagination } = await response.json()

console.log(`Page ${pagination.page} of ${pagination.totalPages}`)
console.log(`Showing ${data.length} of ${pagination.total} items`)
```

---

## Request Headers

### Required Headers

```http
Content-Type: application/json
```

### Optional Headers

```http
Authorization: Bearer <token>
Accept-Language: es
```

### Example

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
    'Accept-Language': 'es'
  }
})
```

---

## Request Body

POST and PATCH requests require JSON body.

### POST Example

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'New Hotel',
    slug: 'new-hotel',
    address: '123 Main St',
    city: 'Buenos Aires'
  })
})
```

### PATCH Example

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations/123', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Updated Hotel Name'
  })
})
```

---

## Filtering & Search

### Filtering

```bash
# Filter by status
curl "https://api.hospeda.com/api/v1/accommodations?isActive=true"

# Multiple filters
curl "https://api.hospeda.com/api/v1/accommodations?isActive=true&city=Buenos Aires"
```

### Sorting

```bash
# Sort by name ascending
curl "https://api.hospeda.com/api/v1/accommodations?sortBy=name&sortOrder=asc"

# Sort by creation date descending
curl "https://api.hospeda.com/api/v1/accommodations?sortBy=createdAt&sortOrder=desc"
```

### Search

```bash
# Search by name
curl "https://api.hospeda.com/api/v1/accommodations?search=hotel"
```

---

## HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | OK | Successful GET/PATCH/DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Content Type

### JSON Only

The API only accepts and returns `application/json`.

```typescript
// Correct
headers: {
  'Content-Type': 'application/json'
}

// Will fail
headers: {
  'Content-Type': 'application/x-www-form-urlencoded'
}
```

---

## Response Examples

### Single Resource

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Hotel Example",
    "slug": "hotel-example",
    "address": "123 Main St",
    "city": "Buenos Aires",
    "isActive": true,
    "createdAt": "2024-11-04T12:00:00.000Z",
    "updatedAt": "2024-11-04T12:00:00.000Z"
  }
}
```

### Collection (Paginated)

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Hotel A"
    },
    {
      "id": "2",
      "name": "Hotel B"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

### No Results

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

---

## Next Steps

- [Authentication](authentication.md) - How to authenticate
- [Endpoints Reference](endpoints-reference.md) - Available endpoints
- [Error Handling](errors.md) - Error codes

---

⬅️ Back to [API Usage Guide](README.md)
