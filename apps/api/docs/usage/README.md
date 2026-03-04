# API Usage Guide

Documentation for consuming the Hospeda API from external applications.

---

## 🚀 Quick Start

1. **Get authenticated** - [Authentication Guide](authentication.md)
2. **Make your first request** - [Request/Response Format](request-response.md)
3. **Browse endpoints** - [Endpoints Reference](endpoints-reference.md)
4. **Handle errors** - [Error Handling](errors.md)

---

## 📚 Documentation

### Getting Started

- **[Authentication](authentication.md)** - How to authenticate with Better Auth JWT tokens
- **[Request/Response Format](request-response.md)** - Standard request and response structures
- **[OpenAPI Documentation](openapi.md)** - Interactive API documentation

### API Reference

- **[Endpoints Reference](endpoints-reference.md)** - Complete list of all available endpoints
  - Accommodations CRUD
  - Destinations CRUD
  - Events CRUD
  - Posts CRUD
  - Users CRUD
  - Health & Metrics

### Best Practices

- **[Error Handling](errors.md)** - Error codes, formats, and how to handle them
- **[Rate Limiting](rate-limiting.md)** - Request quotas and limits

---

## 🎯 Common Use Cases

### Making Authenticated Requests

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
})

const data = await response.json()
```

[Full guide →](authentication.md)

### Handling Pagination

```typescript
const response = await fetch(
  'https://api.hospeda.com/api/v1/accommodations?page=1&pageSize=10'
)

const { data, pagination } = await response.json()
// pagination: { page, pageSize, total, totalPages }
```

[Request/Response guide →](request-response.md#pagination)

### Error Handling

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations/123')

if (!response.ok) {
  const error = await response.json()
  // error.error.code, error.error.message
  console.error(`Error: ${error.error.code}`)
}
```

[Error handling guide →](errors.md)

---

## 🔗 Base URLs

### Production

```text
https://api.hospeda.com
```

### Staging

```text
https://api-staging.hospeda.com
```

### Local Development

```text
http://localhost:3001
```

---

## 📊 API Status

Check API health and status:

```bash
curl https://api.hospeda.com/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2024-11-04T12:00:00.000Z",
  "uptime": 123456.789,
  "version": "1.0.0"
}
```

---

## 🔐 Authentication Overview

The Hospeda API uses **Better Auth** for authentication. You need:

1. **Better Auth Account** - Sign up at [better-auth.com](https://better-auth.com)
2. **JWT Token** - Obtained via Better Auth SDK
3. **Bearer Token** - Include in `Authorization` header

[Complete authentication guide →](authentication.md)

---

## 📦 Response Format

All API responses follow this standard format:

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Hotel Example"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Accommodation not found"
  }
}
```

### Paginated Response

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

[Full format guide →](request-response.md)

---

## ⚡ Rate Limiting

Default limits:

- **100 requests/minute** per IP address
- **1000 requests/hour** per authenticated user
- Custom limits for specific endpoints

[Rate limiting guide →](rate-limiting.md)

---

## 🛠️ Development Tools

### OpenAPI/Swagger UI

Interactive API documentation:

- **Production**: <https://api.hospeda.com/ui>
- **Staging**: <https://api-staging.hospeda.com/ui>
- **Local**: <http://localhost:3001/ui>

### Scalar API Reference

Modern API reference:

- **Production**: <https://api.hospeda.com/reference>
- **Staging**: <https://api-staging.hospeda.com/reference>
- **Local**: <http://localhost:3001/reference>

[OpenAPI documentation guide →](openapi.md)

---

## 📞 Support

Need help?

- 💬 [GitHub Discussions](https://github.com/hospeda/discussions)
- 🐛 [Report Bug](https://github.com/hospeda/issues)
- 📖 [Developer Documentation](../README.md)

---

⬅️ Back to [API Documentation](../README.md)
