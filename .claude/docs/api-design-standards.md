# API Design Standards

This document defines REST API design standards for building consistent, predictable, and well-documented APIs.

---

## Table of Contents

1. [General Principles](#general-principles)
2. [URL Naming Conventions](#url-naming-conventions)
3. [HTTP Methods](#http-methods)
4. [Request Format](#request-format)
5. [Response Format](#response-format)
6. [Pagination](#pagination)
7. [Filtering and Sorting](#filtering-and-sorting)
8. [Error Responses](#error-responses)
9. [Versioning](#versioning)
10. [Authentication](#authentication)
11. [Rate Limiting](#rate-limiting)
12. [Documentation](#documentation)

---

## General Principles

1. **Consistency**: All endpoints follow the same patterns
2. **Predictability**: Developers can guess the API shape
3. **Simplicity**: Keep it as simple as possible, but no simpler
4. **JSON first**: Use `application/json` for request and response bodies
5. **Stateless**: Each request contains all information needed to process it

---

## URL Naming Conventions

### Rules

| Rule | Example |
|------|---------|
| Use plural nouns for resources | `/api/users`, `/api/orders` |
| Use kebab-case | `/api/order-items`, NOT `/api/orderItems` |
| Use lowercase | `/api/users`, NOT `/api/Users` |
| Nest sub-resources | `/api/users/:id/orders` |
| No verbs in URLs | `/api/users`, NOT `/api/getUsers` |
| No trailing slashes | `/api/users`, NOT `/api/users/` |

### URL Structure

```
/api/{version}/{resource}
/api/{version}/{resource}/{id}
/api/{version}/{resource}/{id}/{sub-resource}
```

### Examples

```
GET    /api/v1/users              # List users
GET    /api/v1/users/123          # Get user by ID
POST   /api/v1/users              # Create user
PUT    /api/v1/users/123          # Update user
DELETE /api/v1/users/123          # Delete user
GET    /api/v1/users/123/orders   # List user's orders
```

---

## HTTP Methods

| Method | Purpose | Idempotent | Body |
|--------|---------|-----------|------|
| `GET` | Retrieve resource(s) | Yes | No |
| `POST` | Create resource | No | Yes |
| `PUT` | Replace resource | Yes | Yes |
| `PATCH` | Partial update | No | Yes |
| `DELETE` | Remove resource | Yes | No |

### Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `200` | OK | Successful GET, PUT, PATCH, DELETE |
| `201` | Created | Successful POST |
| `204` | No Content | Successful DELETE with no body |
| `400` | Bad Request | Validation error, malformed request |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but lacks permission |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Resource already exists, version conflict |
| `422` | Unprocessable Entity | Semantically invalid request |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |

---

## Request Format

### Headers

```
Content-Type: application/json
Authorization: Bearer <token>
Accept: application/json
X-Request-ID: <uuid>              # Optional: for tracing
```

### Request Body (POST/PUT/PATCH)

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "editor"
}
```

### Rules

- Use camelCase for field names
- Include only mutable fields in request body
- Do not include server-generated fields (id, createdAt, updatedAt)
- Use ISO 8601 format for dates: `"2024-01-15T10:30:00Z"`

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "editor",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### List Response

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "1", "name": "Alice" },
      { "id": "2", "name": "Bob" }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### Rules

- Always wrap response in `{ success, data }` or `{ success, error }`
- Use camelCase for all field names
- Include `id` in every resource response
- Include `createdAt` and `updatedAt` timestamps
- Use ISO 8601 for all dates (UTC)
- Use UUIDs for resource identifiers

---

## Pagination

### Offset-Based (Default)

```
GET /api/v1/users?page=2&pageSize=20
```

**Query Parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | 1 | - | Page number (1-based) |
| `pageSize` | number | 20 | 100 | Items per page |

**Response:**

```json
{
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Cursor-Based (For Large Datasets)

```
GET /api/v1/events?cursor=eyJpZCI6MTIzfQ&limit=20
```

**Response:**

```json
{
  "pagination": {
    "nextCursor": "eyJpZCI6MTQzfQ",
    "hasMore": true
  }
}
```

**When to use cursor-based:**

- Large datasets (100k+ records)
- Real-time data with frequent inserts
- Infinite scroll UIs

---

## Filtering and Sorting

### Filtering

```
GET /api/v1/users?role=admin&status=active
GET /api/v1/products?minPrice=10&maxPrice=100
GET /api/v1/orders?createdAfter=2024-01-01T00:00:00Z
```

### Searching

```
GET /api/v1/users?q=john
GET /api/v1/products?search=laptop
```

### Sorting

```
GET /api/v1/users?sortBy=createdAt&sortOrder=desc
GET /api/v1/products?sortBy=price&sortOrder=asc
```

**Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `sortBy` | string | `createdAt` | Any sortable field |
| `sortOrder` | string | `desc` | `asc`, `desc` |

---

## Error Responses

### Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists or version conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Rules

- Never expose internal error details (stack traces, DB errors) to clients
- Always include a machine-readable `code`
- Include a human-readable `message`
- Include `details` array for field-level validation errors
- Log full error details server-side for debugging

---

## Versioning

### URL-Based Versioning (Recommended)

```
/api/v1/users
/api/v2/users
```

### Versioning Rules

1. Start with `v1`
2. Increment major version only for breaking changes
3. Add new fields without breaking existing clients (backward compatible)
4. Deprecate old versions with a clear timeline
5. Document migration guide between versions

### What Constitutes a Breaking Change

- Removing a field from the response
- Renaming a field
- Changing a field type
- Removing an endpoint
- Changing required/optional status of a request field

---

## Authentication

### Bearer Token (JWT)

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key (Service-to-Service)

```
X-API-Key: YOUR_SECRET_KEY_HERE
```

### Authentication Rules

- Use HTTPS for all authenticated endpoints
- Return 401 for missing/invalid credentials
- Return 403 for valid credentials without permission
- Never include tokens in URLs (use headers)
- Implement token refresh for JWTs

---

## Rate Limiting

### Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
Retry-After: 60
```

### Rate Limits by Tier

| Tier | Limit | Window |
|------|-------|--------|
| Anonymous | 20 req | 1 minute |
| Authenticated | 100 req | 1 minute |
| Premium | 500 req | 1 minute |
| Login endpoint | 5 req | 15 minutes |

---

## Documentation

### Every Endpoint Must Document

1. **URL and method**
2. **Description** of what it does
3. **Authentication** requirements
4. **Request** parameters, headers, and body schema
5. **Response** format with examples
6. **Error** responses with codes
7. **Rate limits** that apply

### Use OpenAPI/Swagger

Generate interactive documentation from OpenAPI specs. Keep specs in sync with implementation by generating from code annotations.

---

## Summary Checklist

Before publishing an API endpoint:

- [ ] URL follows naming conventions (plural, kebab-case, no verbs)
- [ ] Correct HTTP method and status codes
- [ ] Request validation with Zod or equivalent
- [ ] Response wrapped in standard format
- [ ] Pagination for list endpoints
- [ ] Error responses follow standard format
- [ ] Authentication and authorization enforced
- [ ] Rate limiting configured
- [ ] OpenAPI documentation written
- [ ] Integration tests covering happy path and error cases

---

**API design decisions affect every consumer. Follow these standards for consistency across all endpoints.**
