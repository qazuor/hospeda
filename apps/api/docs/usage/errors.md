# Error Handling

How to handle errors when consuming the Hospeda API.

---

## Error Response Format

All errors follow a standard format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

With validation errors:

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
      },
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Handling Errors

### TypeScript/JavaScript

```typescript
try {
  const response = await fetch('https://api.hospeda.com/api/v1/accommodations/123')

  if (!response.ok) {
    const error = await response.json()

    switch (error.error.code) {
      case 'NOT_FOUND':
        console.error('Accommodation not found')
        break
      case 'UNAUTHORIZED':
        // Redirect to login
        break
      case 'VALIDATION_ERROR':
        // Show validation errors
        error.error.details?.forEach(detail => {
          console.error(`${detail.field}: ${detail.message}`)
        })
        break
      default:
        console.error('Unknown error:', error.error.message)
    }

    return
  }

  const data = await response.json()
  // Handle success
} catch (error) {
  console.error('Network error:', error)
}
```

### React Hook

```typescript
import { useState } from 'react'

function useAPI<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error.message)
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { data, error, loading, fetchData }
}
```

---

## Common Errors

### 400 Bad Request

**Cause:** Validation error

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "slug",
        "message": "Slug must be URL-friendly"
      }
    ]
  }
}
```

**Solution:** Fix validation errors and retry

### 401 Unauthorized

**Cause:** Missing or invalid authentication token

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Solution:** Ensure `Authorization: Bearer <token>` header is included

### 403 Forbidden

**Cause:** Valid token but insufficient permissions

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

**Solution:** Contact admin to grant required permissions

### 404 Not Found

**Cause:** Resource doesn't exist

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Accommodation not found"
  }
}
```

**Solution:** Verify resource ID and retry

### 429 Too Many Requests

**Cause:** Rate limit exceeded

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again later."
  }
}
```

**Response Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699084800
```

**Solution:** Wait for rate limit reset (see `X-RateLimit-Reset` header)

### 500 Internal Server Error

**Cause:** Server error

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

**Solution:** Retry request. If persists, contact support.

---

## Error Recovery

### Retry Logic

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)

      if (response.ok) {
        return await response.json()
      }

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        const error = await response.json()
        throw new Error(error.error.message)
      }

      // Retry server errors (5xx)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        continue
      }

      throw new Error('Max retries exceeded')
    } catch (error) {
      if (i === maxRetries - 1) throw error
    }
  }
}
```

### Exponential Backoff

```typescript
async function fetchWithBackoff(url: string, options: RequestInit) {
  let retries = 0
  const maxRetries = 5

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options)

      if (response.ok) {
        return await response.json()
      }

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const backoffMs = Math.pow(2, retries) * 1000
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        retries++
        continue
      }

      // Other errors
      const error = await response.json()
      throw new Error(error.error.message)
    } catch (error) {
      if (retries === maxRetries - 1) throw error
      retries++
    }
  }
}
```

---

## Best Practices

1. **Always check `response.ok`** before parsing JSON
2. **Handle specific error codes** with switch/case
3. **Display user-friendly messages** for validation errors
4. **Implement retry logic** for server errors (5xx)
5. **Respect rate limits** - implement exponential backoff
6. **Log errors** for debugging
7. **Don't retry client errors** (4xx) except 429

---

## Next Steps

- [Authentication](authentication.md) - Authentication guide
- [Rate Limiting](rate-limiting.md) - Rate limit policies
- [Request/Response Format](request-response.md) - API format

---

⬅️ Back to [API Usage Guide](README.md)
