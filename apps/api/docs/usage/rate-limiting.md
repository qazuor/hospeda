# Rate Limiting

API request limits and quotas.

---

## Default Limits

- **100 requests/minute** per IP address
- **1000 requests/hour** per authenticated user

---

## Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699084800
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

---

## Rate Limit Exceeded

When limit exceeded, API returns `429 Too Many Requests`:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again later."
  }
}
```

**Retry After:** Check `X-RateLimit-Reset` header

---

## Handling Rate Limits

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations')

const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0')

if (response.status === 429) {
  const waitTime = reset - Math.floor(Date.now() / 1000)
  console.log(`Rate limited. Wait ${waitTime} seconds`)
}
```

---

⬅️ Back to [API Usage Guide](README.md)
