# Debugging Guide

Debugging techniques and common issues in the Hospeda API.

---

## Development Tools

### Enable Debug Logging

```bash
DEBUG=* pnpm dev
```

### TypeScript Validation

```bash
pnpm typecheck
```

### Run Tests

```bash
pnpm test
pnpm test:watch
```

---

## Common Issues

### 1. Route Not Found (404)

**Symptoms**: Endpoint returns 404

**Causes:**

- Route not registered in `routes/index.ts`
- Wrong path in route definition
- Wrong HTTP method

**Solution:**

```typescript
// Check registration
import myRoutes from './my-entity';
app.route('/api/v1/my-entity', myRoutes);

// Verify path matches
path: '/api/v1/my-entity'  // Must match registration
```

### 2. Validation Error (400)

**Symptoms**: Request returns validation error

**Causes:**

- Request body doesn't match schema
- Wrong data types
- Missing required fields

**Solution:**

```bash
# Check request in Swagger UI
http://localhost:3001/ui

# Verify schema definition
# Check Zod schema matches request
```

### 3. Authentication Error (401)

**Symptoms**: Protected route returns 401

**Causes:**

- Missing Authorization header
- Invalid JWT token
- Expired token

**Solution:**

```bash
# Check header format
Authorization: Bearer <token>

# Verify token is valid
# Get fresh token from Clerk
```

### 4. Database Connection Error

**Symptoms**: Cannot connect to database

**Causes:**

- DATABASE_URL not set
- PostgreSQL not running
- Wrong connection string

**Solution:**

```bash
# Check .env file
DATABASE_URL=postgresql://...

# Test connection
pnpm db:studio
```

### 5. Service Error (500)

**Symptoms**: Internal server error

**Causes:**

- Unhandled exception
- Database query error
- Missing error handling

**Solution:**

```typescript
// Add try-catch
try {
  const result = await service.create(body);
  return result;
} catch (error) {
  console.error('Service error:', error);
  return ResponseFactory.error(c, 'Internal error', 500);
}
```

---

## Debugging Techniques

### Console Logging

```typescript
console.log('Request body:', body);
console.log('Query params:', query);
console.log('Actor:', getActorFromContext(c));
```

### Drizzle Studio

```bash
pnpm db:studio
# Opens at http://localhost:4983
```

### Swagger UI Testing

```bash
# Open Swagger UI
http://localhost:3001/ui

# Test endpoints directly
```

### Check Logs

```bash
# Server logs show:
# - Request method and path
# - Response status
# - Execution time
```

---

## Best Practices

- Add logging at key points
- Use try-catch for error handling
- Test with Swagger UI
- Check database with Drizzle Studio
- Enable debug logging in development

---

⬅️ Back to [Development Guide](README.md)
