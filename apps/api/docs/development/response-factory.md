# Response Factory

Standardized response patterns using ResponseFactory.

---

## Overview

`ResponseFactory` provides consistent response formats across all API endpoints.

**Location**: `src/utils/response-factory.ts`

---

## Response Methods

### Success Response

```typescript
import { ResponseFactory } from '../utils/response-factory';

return ResponseFactory.success(c, data, 200);
```

**Response:**

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```typescript
return ResponseFactory.error(
  c,
  'Resource not found',
  404,
  ServiceErrorCode.NOT_FOUND
);
```

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### Paginated Response

```typescript
return ResponseFactory.paginated(c, {
  data: items,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 100,
    totalPages: 10
  }
});
```

**Response:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Validation Error

```typescript
return ResponseFactory.validationError(c, errors);
```

---

## Usage in Routes

```typescript
export const myRoute = createOpenApiRoute({
  handler: async (c, params, body) => {
    const service = new MyService(c);
    const result = await service.create(body);

    if (!result.success) {
      return ResponseFactory.error(
        c,
        result.error.message,
        400
      );
    }

    return ResponseFactory.success(c, result.data, 201);
  }
});
```

---

## Best Practices

- Always use ResponseFactory for consistency
- Don't return raw `c.json()` responses
- Use appropriate status codes
- Include error codes for errors

---

⬅️ Back to [Development Guide](README.md)
