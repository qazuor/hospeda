# Authentication

How to authenticate with the Hospeda API using Clerk.

---

## Overview

The Hospeda API uses **Clerk** for authentication with **JWT (JSON Web Tokens)**.

**Authentication Flow:**

1. User signs in via Clerk (web/admin app)
2. Clerk issues a JWT token
3. Client includes token in `Authorization` header
4. API validates token and extracts user info

---

## Quick Start

### 1. Get a Clerk Token

From your frontend application:

```typescript
import { useAuth } from '@clerk/clerk-react'

function MyComponent() {
  const { getToken } = useAuth()

  const fetchData = async () => {
    // Get token from Clerk
    const token = await getToken()

    // Make authenticated request
    const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
  }
}
```

### 2. Include Token in Requests

```typescript
const token = await getToken()

const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Hotel Example',
    slug: 'hotel-example'
  })
})
```

---

## Setup (Frontend)

### React Application

Install Clerk React SDK:

```bash
pnpm add @clerk/clerk-react
```

Wrap your app with `ClerkProvider`:

```tsx
import { ClerkProvider } from '@clerk/clerk-react'

function App() {
  return (
    <ClerkProvider publishableKey={process.env.CLERK_PUBLISHABLE_KEY}>
      <YourApp />
    </ClerkProvider>
  )
}
```

Use `useAuth` hook to get tokens:

```tsx
import { useAuth } from '@clerk/clerk-react'

function ProtectedComponent() {
  const { getToken, isSignedIn } = useAuth()

  if (!isSignedIn) {
    return <div>Please sign in</div>
  }

  const makeRequest = async () => {
    const token = await getToken()
    // Use token...
  }

  return <button onClick={makeRequest}>Fetch Data</button>
}
```

### Next.js Application

Install Clerk Next.js SDK:

```bash
pnpm add @clerk/nextjs
```

Configure in `app/layout.tsx`:

```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

Get token in Server Component:

```tsx
import { auth } from '@clerk/nextjs/server'

export default async function ServerComponent() {
  const { getToken } = auth()
  const token = await getToken()

  const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  const data = await response.json()
  return <div>{/* Render data */}</div>
}
```

---

## Making Authenticated Requests

### GET Request

```typescript
const token = await getToken()

const response = await fetch(
  'https://api.hospeda.com/api/v1/accommodations/123',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
)

const data = await response.json()
```

### POST Request

```typescript
const token = await getToken()

const response = await fetch(
  'https://api.hospeda.com/api/v1/accommodations',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'New Hotel',
      slug: 'new-hotel',
      address: '123 Main St'
    })
  }
)

const data = await response.json()
```

### PATCH Request

```typescript
const token = await getToken()

const response = await fetch(
  'https://api.hospeda.com/api/v1/accommodations/123',
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Updated Hotel Name'
    })
  }
)

const data = await response.json()
```

### DELETE Request

```typescript
const token = await getToken()

const response = await fetch(
  'https://api.hospeda.com/api/v1/accommodations/123',
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
)

const data = await response.json()
```

---

## Token Refresh

Clerk automatically handles token refresh. The `getToken()` method:

- Returns cached token if valid
- Refreshes token if expired
- Handles refresh failures

```typescript
// Always use getToken() - it handles refresh automatically
const token = await getToken()
```

**Token Expiration:**

- Default: 60 minutes
- Automatically refreshed by Clerk SDK
- No manual refresh needed

---

## Public vs Protected Endpoints

### Public Endpoints (No Auth Required)

```typescript
// Health check - no token needed
const response = await fetch('https://api.hospeda.com/health')

// List accommodations - public endpoint
const response = await fetch('https://api.hospeda.com/api/v1/accommodations')
```

### Protected Endpoints (Auth Required)

```typescript
// Create accommodation - requires auth
const token = await getToken()
const response = await fetch(
  'https://api.hospeda.com/api/v1/accommodations',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }
)
```

**Endpoint Protection Status:**

| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| GET | `/health` | No |
| GET | `/metrics` | No |
| GET | `/api/v1/accommodations` | No |
| GET | `/api/v1/accommodations/:id` | No |
| POST | `/api/v1/accommodations` | **Yes** |
| PATCH | `/api/v1/accommodations/:id` | **Yes** |
| DELETE | `/api/v1/accommodations/:id` | **Yes** |

---

## Error Handling

### Unauthorized (401)

Missing or invalid token:

```typescript
const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
  method: 'POST',
  // Missing Authorization header
  headers: {
    'Content-Type': 'application/json'
  }
})

// Response: 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Forbidden (403)

Valid token but insufficient permissions:

```typescript
const token = await getToken()

const response = await fetch('https://api.hospeda.com/api/v1/users/123', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

// Response: 403 Forbidden
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

---

## Troubleshooting

### Token Not Working

**Problem:** API returns 401 Unauthorized

**Solutions:**

1. **Check token format:**

   ```typescript
   // Correct
   headers: {
     'Authorization': `Bearer ${token}`
   }

   // Wrong
   headers: {
     'Authorization': token  // Missing 'Bearer ' prefix
   }
   ```

2. **Verify token is not null:**

   ```typescript
   const token = await getToken()
   if (!token) {
     console.error('No token available')
     return
   }
   ```

3. **Check user is signed in:**

   ```typescript
   const { isSignedIn, getToken } = useAuth()

   if (!isSignedIn) {
     console.error('User not signed in')
     return
   }

   const token = await getToken()
   ```

### Token Expired

Clerk automatically refreshes tokens. If you encounter expired token errors:

1. Ensure you're using `getToken()` (not caching tokens manually)
2. Check network connectivity
3. Verify Clerk configuration

### CORS Errors

If you see CORS errors:

1. **Development:** Ensure `http://localhost:<port>` is in CORS whitelist
2. **Production:** Contact admin to whitelist your domain

---

## Best Practices

### 1. Always Use getToken()

```typescript
// ✅ Good - Always fresh token
const token = await getToken()

// ❌ Bad - Token may be stale
const token = localStorage.getItem('token')
```

### 2. Handle Auth State

```typescript
const { isSignedIn, getToken } = useAuth()

if (!isSignedIn) {
  // Redirect to sign in
  return
}

const token = await getToken()
// Make authenticated request
```

### 3. Centralize API Client

```typescript
// lib/api.ts
import { useAuth } from '@clerk/clerk-react'

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const { getToken } = useAuth()
  const token = await getToken()

  const response = await fetch(`https://api.hospeda.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  return response.json()
}

// Usage
const data = await fetchAPI('/api/v1/accommodations')
```

### 4. Error Handling

```typescript
try {
  const token = await getToken()

  const response = await fetch('https://api.hospeda.com/api/v1/accommodations', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error.message)
  }

  const data = await response.json()
} catch (error) {
  console.error('API Error:', error)
}
```

---

## Next Steps

- [Request/Response Format](request-response.md) - Understanding API responses
- [Endpoints Reference](endpoints-reference.md) - Available endpoints
- [Error Handling](errors.md) - Error codes and handling

---

⬅️ Back to [API Usage Guide](README.md)
