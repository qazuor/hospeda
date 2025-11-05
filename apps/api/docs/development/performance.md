# Performance Optimization

Performance tips and best practices for the Hospeda API.

---

## Query Optimization

### Use Indexes

```typescript
// Add index to frequently queried columns
export const accommodations = pgTable('accommodations', {
  city: text('city').notNull(),
  // ...
}, (table) => ({
  cityIdx: index('city_idx').on(table.city)
}));
```

### Select Specific Columns

```typescript
// ✅ Good - Select only needed columns
const users = await db
  .select({ id: users.id, name: users.name })
  .from(users);

// ❌ Bad - Select all columns
const users = await db.select().from(users);
```

### Use Pagination

```typescript
// Always paginate list endpoints
const results = await db
  .select()
  .from(table)
  .limit(pageSize)
  .offset((page - 1) * pageSize);
```

---

## Caching

### Response Caching

```typescript
export const route = createListRoute({
  // ...
  options: {
    cacheTTL: 300  // Cache for 5 minutes
  }
});
```

### Query Result Caching

```typescript
// Cache frequently accessed data
const cache = new Map();

async function getConfig() {
  if (cache.has('config')) {
    return cache.get('config');
  }
  
  const config = await db.query...;
  cache.set('config', config);
  return config;
}
```

---

## Rate Limiting

### Custom Rate Limits

```typescript
// Lower limits for expensive operations
options: {
  customRateLimit: {
    requests: 10,
    windowMs: 60000  // 10 req/min
  }
}
```

---

## Database Connection

### Connection Pooling

Drizzle handles this automatically, but verify:

```typescript
// Max connections in DATABASE_URL
?connection_limit=10
```

---

## Monitoring

### Metrics Endpoint

```bash
# Check performance metrics
curl http://localhost:3001/metrics
```

### Response Time Header

```typescript
// Check X-Response-Time header
```

---

## Best Practices

- Use database indexes
- Implement pagination
- Cache static data
- Use SELECT only needed columns
- Monitor with `/metrics`
- Set appropriate rate limits
- Optimize N+1 queries

---

⬅️ Back to [Development Guide](README.md)
