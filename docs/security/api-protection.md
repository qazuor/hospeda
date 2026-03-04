# API Protection

Complete guide to API security strategies and implementation in Hospeda.

## Table of Contents

- [API Protection](#api-protection)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [API Security Philosophy](#api-security-philosophy)
    - [Attack Vectors](#attack-vectors)
    - [Defense Layers](#defense-layers)
    - [Security Architecture](#security-architecture)
  - [Rate Limiting](#rate-limiting)
    - [hono-rate-limiter Configuration](#hono-rate-limiter-configuration)
      - [Basic Setup](#basic-setup)
    - [Global Rate Limits](#global-rate-limits)
      - [Environment Configuration](#environment-configuration)
      - [Middleware Implementation](#middleware-implementation)
    - [Endpoint-Specific Limits](#endpoint-specific-limits)
      - [Rate Limit by Endpoint Type](#rate-limit-by-endpoint-type)
      - [Custom Rate Limits per Route](#custom-rate-limits-per-route)
    - [User-Based vs IP-Based](#user-based-vs-ip-based)
      - [IP-Based Rate Limiting (Default)](#ip-based-rate-limiting-default)
      - [User-Based Rate Limiting](#user-based-rate-limiting)
      - [Combined Approach](#combined-approach)
    - [Rate Limit Headers](#rate-limit-headers)
      - [Standard Headers](#standard-headers)
      - [Response Example](#response-example)
    - [Configuration Examples](#configuration-examples)
      - [Development Environment](#development-environment)
      - [Production Environment](#production-environment)
      - [Testing Environment](#testing-environment)
    - [Bypass for Authenticated Users](#bypass-for-authenticated-users)
  - [CORS Configuration](#cors-configuration)
    - [CORS Principles](#cors-principles)
      - [What is CORS?](#what-is-cors)
      - [Why CORS Matters](#why-cors-matters)
    - [Allowed Origins](#allowed-origins)
      - [Environment-Based Origins](#environment-based-origins)
      - [Dynamic Origin Validation](#dynamic-origin-validation)
    - [Credentials Handling](#credentials-handling)
      - [Enable Credentials](#enable-credentials)
      - [Wildcard Restriction](#wildcard-restriction)
    - [Preflight Requests](#preflight-requests)
      - [OPTIONS Request Handling](#options-request-handling)
      - [Preflight Cache](#preflight-cache)
    - [Configuration by Environment](#configuration-by-environment)
      - [Development CORS](#development-cors)
      - [Production CORS](#production-cors)
    - [Common Pitfalls](#common-pitfalls)
      - [1. Wildcard with Credentials](#1-wildcard-with-credentials)
      - [2. Missing Origin](#2-missing-origin)
      - [3. Protocol Mismatch](#3-protocol-mismatch)
      - [4. Port Mismatch](#4-port-mismatch)
  - [Security Headers](#security-headers)
    - [Content Security Policy (CSP)](#content-security-policy-csp)
      - [CSP Configuration](#csp-configuration)
      - [CSP Directives](#csp-directives)
    - [HTTP Strict Transport Security (HSTS)](#http-strict-transport-security-hsts)
      - [HSTS Configuration](#hsts-configuration)
    - [X-Frame-Options](#x-frame-options)
      - Configuration
    - [X-Content-Type-Options](#x-content-type-options)
      - Configuration
    - [X-XSS-Protection](#x-xss-protection)
      - Configuration
    - [Referrer-Policy](#referrer-policy)
      - Configuration
    - [Permissions-Policy](#permissions-policy)
      - Configuration
    - [Implementation Examples](#implementation-examples)
      - [Full Security Headers Middleware](#full-security-headers-middleware)
      - [Environment-Specific Headers](#environment-specific-headers)
  - [Request Validation](#request-validation)
    - [Zod Schema Validation](#zod-schema-validation)
      - [Schema Definition](#schema-definition)
      - [Validation Middleware](#validation-middleware)
    - [Request Body Validation](#request-body-validation)
      - [POST/PUT Routes](#postput-routes)
      - [Validation Errors](#validation-errors)
    - [Query Parameter Validation](#query-parameter-validation)
      - [GET Routes with Query Params](#get-routes-with-query-params)
      - [Optional vs Required Parameters](#optional-vs-required-parameters)
    - [Path Parameter Validation](#path-parameter-validation)
      - [UUID Path Parameters](#uuid-path-parameters)
      - [Enum Path Parameters](#enum-path-parameters)
    - [File Upload Validation](#file-upload-validation)
      - [File Type Validation](#file-type-validation)
      - [File Size Validation](#file-size-validation)
    - [Error Handling](#error-handling)
      - [Validation Error Response](#validation-error-response)
      - [Custom Error Messages](#custom-error-messages)
  - [Response Security](#response-security)
    - [Error Message Sanitization](#error-message-sanitization)
      - [Safe Error Responses](#safe-error-responses)
      - [Error Transformation](#error-transformation)
    - [Prevent Information Disclosure](#prevent-information-disclosure)
      - [What NOT to Expose](#what-not-to-expose)
      - [Safe Error Handling](#safe-error-handling)
    - Safe Error Responses
      - [Production Error Handling](#production-error-handling)
      - [Development Error Handling](#development-error-handling)
    - [Logging Without Exposing Data](#logging-without-exposing-data)
      - [Safe Logging](#safe-logging)
      - [Sensitive Data Redaction](#sensitive-data-redaction)
  - [Testing](#testing)
    - [Rate Limit Testing](#rate-limit-testing)
      - [Test Rate Limit Enforcement](#test-rate-limit-enforcement)
      - [Test Different Endpoint Types](#test-different-endpoint-types)
    - [CORS Testing](#cors-testing)
      - [Test Allowed Origins](#test-allowed-origins)
      - [Test Preflight Requests](#test-preflight-requests)
    - [Security Headers Testing](#security-headers-testing)
      - [Test Security Headers Presence](#test-security-headers-presence)
    - [Validation Testing](#validation-testing)
      - [Test Request Validation](#test-request-validation)
  - Monitoring \& Alerting
    - [Metrics Collection](#metrics-collection)
      - [Rate Limit Metrics](#rate-limit-metrics)
      - [Security Event Metrics](#security-event-metrics)
    - [Log Aggregation](#log-aggregation)
      - [Structured Logging](#structured-logging)
    - [Alert Configuration](#alert-configuration)
      - [Alert Rules](#alert-rules)
  - [Performance Considerations](#performance-considerations)
    - [Rate Limit Store](#rate-limit-store)
      - [In-Memory Store (Current)](#in-memory-store-current)
      - [Redis Store (Production)](#redis-store-production)
    - [Caching](#caching)
      - [Response Caching](#response-caching)
    - [Compression](#compression)
      - [Gzip Compression](#gzip-compression)
  - [Best Practices](#best-practices)
    - [Defense in Depth](#defense-in-depth)
    - [Least Privilege](#least-privilege)
    - [Fail Securely](#fail-securely)
    - [Regular Updates](#regular-updates)
    - [Security Testing](#security-testing)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues](#common-issues)
      - [1. Rate Limit Too Strict](#1-rate-limit-too-strict)
      - [2. CORS Errors](#2-cors-errors)
      - [3. CSP Blocking Resources](#3-csp-blocking-resources)
      - [4. Validation Failures](#4-validation-failures)
  - [References](#references)

## Overview

### API Security Philosophy

Hospeda's API security follows a **defense in depth** approach:

**Core Principles:**

1. **Never trust user input** - Validate and sanitize everything
2. **Fail securely** - Reject by default, allow explicitly
3. **Layer security** - Multiple independent security controls
4. **Monitor actively** - Log and alert on suspicious activity
5. **Minimize exposure** - Expose only what's necessary

**Security Goals:**

- Prevent unauthorized access
- Protect against common attacks (XSS, CSRF, injection)
- Rate limit abusive behavior
- Maintain data confidentiality
- Ensure service availability

### Attack Vectors

**Common API Attacks:**

| Attack | Description | Mitigation |
|--------|-------------|------------|
| **Brute Force** | Repeated login attempts | Rate limiting |
| **DDoS** | Overwhelming requests | Rate limiting + CDN |
| **SQL Injection** | Malicious SQL queries | Parameterized queries |
| **XSS** | Cross-site scripting | Input sanitization + CSP |
| **CSRF** | Cross-site request forgery | SameSite cookies + Origin validation |
| **Information Disclosure** | Exposing sensitive data | Error sanitization |
| **Broken Authentication** | Weak auth mechanisms | Better Auth + session tokens |
| **Injection** | Code/command injection | Input validation |

### Defense Layers

```mermaid
graph TB
    Request[Incoming Request]
    CDN[CDN/Edge Protection]
    RateLimit[Rate Limiting]
    CORS[CORS Validation]
    Auth[Authentication]
    Validation[Input Validation]
    Sanitization[Input Sanitization]
    Business[Business Logic]
    Response[Response]

    Request --> CDN
    CDN --> RateLimit
    RateLimit --> CORS
    CORS --> Auth
    Auth --> Validation
    Validation --> Sanitization
    Sanitization --> Business
    Business --> Response

    style CDN fill:#e1f5ff
    style RateLimit fill:#ffe1e1
    style CORS fill:#ffe1e1
    style Auth fill:#ffe1e1
    style Validation fill:#ffe1e1
    style Sanitization fill:#ffe1e1
    style Business fill:#e1ffe1
```

**Layer Responsibilities:**

1. **CDN/Edge**: DDoS protection, caching
2. **Rate Limiting**: Prevent abuse, throttle requests
3. **CORS**: Validate request origin
4. **Authentication**: Verify user identity
5. **Input Validation**: Validate request structure
6. **Input Sanitization**: Remove dangerous content
7. **Business Logic**: Execute operations
8. **Response**: Return sanitized data

### Security Architecture

```mermaid
graph LR
    Client[Client]
    Vercel[Vercel Edge]
    API[API Server]
    Middleware[Security Middleware]
    Routes[Protected Routes]

    Client -->|HTTPS Only| Vercel
    Vercel -->|Rate Limited| API
    API -->|Security Headers| Middleware
    Middleware -->|CORS Check| Middleware
    Middleware -->|Auth Check| Middleware
    Middleware -->|Validation| Routes
    Routes -->|Sanitized Response| Client
```

## Rate Limiting

Protection against brute force attacks and API abuse through request throttling.

### hono-rate-limiter Configuration

#### Basic Setup

```typescript
// apps/api/src/middlewares/rate-limit.ts

import type { Context, Next } from 'hono';

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = async (c: Context, next: Next) => {
  // Skip in test environment (unless explicitly testing)
  if (process.env.NODE_ENV === 'test' && !process.env.TESTING_RATE_LIMIT) {
    await next();
    return;
  }

  const path = c.req.path;
  const endpointType = getEndpointType(path);
  const config = getRateLimitConfig(endpointType);

  if (!config.enabled) {
    await next();
    return;
  }

  // Get client IP
  const clientIp = getClientIp(c);
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;

  // Check rate limit
  const currentData = rateLimitStore.get(clientIp);
  let count = 0;

  if (currentData && currentData.windowStart === windowStart) {
    count = currentData.count;
  }

  // Exceeded limit
  if (count >= config.maxRequests) {
    return c.json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: config.message
      }
    }, 429);
  }

  // Update rate limit data
  rateLimitStore.set(clientIp, { count: count + 1, windowStart });

  // Set rate limit headers
  c.header('X-RateLimit-Limit', config.maxRequests.toString());
  c.header('X-RateLimit-Remaining', (config.maxRequests - count - 1).toString());
  c.header('X-RateLimit-Reset', Math.floor((windowStart + config.windowMs) / 1000).toString());

  await next();
};
```

### Global Rate Limits

#### Environment Configuration

```env
# .env - Global rate limiting

# General endpoints (100 requests per minute)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Standard headers
RATE_LIMIT_STANDARD_HEADERS=true
RATE_LIMIT_LEGACY_HEADERS=false

# Message
RATE_LIMIT_MESSAGE=Too many requests, please try again later
```

#### Middleware Implementation

```typescript
// apps/api/src/utils/env.ts

import { z } from 'zod';

const RateLimitConfigSchema = z.object({
  enabled: z.coerce.boolean().default(true),
  windowMs: z.coerce.number().default(60000),
  maxRequests: z.coerce.number().default(100),
  message: z.string().default('Too many requests'),
  standardHeaders: z.coerce.boolean().default(true),
  legacyHeaders: z.coerce.boolean().default(false)
});

export function getRateLimitConfig() {
  return RateLimitConfigSchema.parse({
    enabled: process.env.RATE_LIMIT_ENABLED,
    windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    message: process.env.RATE_LIMIT_MESSAGE,
    standardHeaders: process.env.RATE_LIMIT_STANDARD_HEADERS,
    legacyHeaders: process.env.RATE_LIMIT_LEGACY_HEADERS
  });
}
```

### Endpoint-Specific Limits

#### Rate Limit by Endpoint Type

```typescript
// apps/api/src/middlewares/rate-limit.ts

/**
 * Determines endpoint type from path
 */
function getEndpointType(path: string): 'auth' | 'public' | 'admin' | 'general' {
  if (path.includes('/auth/')) return 'auth';
  if (path.includes('/admin/')) return 'admin';
  if (path.includes('/public/')) return 'public';
  return 'general';
}

/**
 * Gets rate limit config for endpoint type
 */
function getRateLimitConfig(type: 'auth' | 'public' | 'admin' | 'general') {
  const baseConfig = getBaseRateLimitConfig();

  switch (type) {
    case 'auth':
      return {
        enabled: baseConfig.authEnabled,
        windowMs: baseConfig.authWindowMs,
        maxRequests: baseConfig.authMaxRequests,
        message: baseConfig.authMessage
      };

    case 'public':
      return {
        enabled: baseConfig.publicEnabled,
        windowMs: baseConfig.publicWindowMs,
        maxRequests: baseConfig.publicMaxRequests,
        message: baseConfig.publicMessage
      };

    case 'admin':
      return {
        enabled: baseConfig.adminEnabled,
        windowMs: baseConfig.adminWindowMs,
        maxRequests: baseConfig.adminMaxRequests,
        message: baseConfig.adminMessage
      };

    default:
      return {
        enabled: baseConfig.enabled,
        windowMs: baseConfig.windowMs,
        maxRequests: baseConfig.maxRequests,
        message: baseConfig.message
      };
  }
}
```

**Environment Configuration:**

```env
# .env - Endpoint-specific rate limits

# Auth endpoints (stricter - 5 requests per minute)
RATE_LIMIT_AUTH_ENABLED=true
RATE_LIMIT_AUTH_MAX_REQUESTS=5
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MESSAGE=Too many authentication attempts

# Public endpoints (relaxed - 60 requests per minute)
RATE_LIMIT_PUBLIC_ENABLED=true
RATE_LIMIT_PUBLIC_MAX_REQUESTS=60
RATE_LIMIT_PUBLIC_WINDOW_MS=60000
RATE_LIMIT_PUBLIC_MESSAGE=Rate limit exceeded

# Admin endpoints (moderate - 30 requests per minute)
RATE_LIMIT_ADMIN_ENABLED=true
RATE_LIMIT_ADMIN_MAX_REQUESTS=30
RATE_LIMIT_ADMIN_WINDOW_MS=60000
RATE_LIMIT_ADMIN_MESSAGE=Admin rate limit exceeded

# General endpoints (100 requests per minute)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MESSAGE=Too many requests
```

#### Custom Rate Limits per Route

```typescript
// apps/api/src/routes/accommodation/list.ts

import { createListRoute } from '../../utils/route-factory';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations',
  summary: 'List accommodations',
  handler: async (c, params, body, query) => {
    const service = new AccommodationService(c);
    return await service.findAll(query);
  },
  options: {
    skipAuth: true,
    customRateLimit: {
      requests: 120,  // Higher limit for public listing
      windowMs: 60000 // 120 requests per minute
    }
  }
});

// Search endpoint - even higher limit
export const searchAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations/search',
  summary: 'Search accommodations',
  handler: async (c, params, body, query) => {
    const service = new AccommodationService(c);
    return await service.search(query);
  },
  options: {
    skipAuth: true,
    customRateLimit: {
      requests: 180,  // Higher for search
      windowMs: 60000
    }
  }
});
```

### User-Based vs IP-Based

#### IP-Based Rate Limiting (Default)

```typescript
// apps/api/src/middlewares/rate-limit.ts

/**
 * Extract client IP from request headers
 */
function getClientIp(c: Context): string {
  // Check common IP headers
  const forwardedFor = c.req.header('x-forwarded-for');
  const realIp = c.req.header('x-real-ip');
  const cfConnectingIp = c.req.header('cf-connecting-ip'); // Cloudflare

  let clientIp = 'unknown';

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs
    clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown';
  } else if (realIp) {
    clientIp = realIp;
  } else if (cfConnectingIp) {
    clientIp = cfConnectingIp;
  }

  return clientIp;
}
```

**Pros:**

- Works for unauthenticated users
- Simple implementation
- No database lookups

**Cons:**

- Shared IPs (NAT, VPN) affect multiple users
- Can be bypassed with proxy rotation

#### User-Based Rate Limiting

```typescript
// apps/api/src/middlewares/rate-limit.ts

import { getAuth } from '../lib/auth';

/**
 * Get rate limit key (user ID or IP)
 */
function getRateLimitKey(c: Context): string {
  const auth = getAuth(c);

  // Use user ID if authenticated
  if (auth?.userId) {
    return `user:${auth.userId}`;
  }

  // Fall back to IP for unauthenticated
  return `ip:${getClientIp(c)}`;
}

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  const key = getRateLimitKey(c);
  const config = getRateLimitConfig(getEndpointType(c.req.path));

  // Check rate limit using user ID or IP
  const currentData = rateLimitStore.get(key);
  // ... rest of implementation
};
```

**Pros:**

- Accurate per-user tracking
- Can't be bypassed with IP changes
- Fair for shared IPs

**Cons:**

- Requires authentication
- Slightly more complex

#### Combined Approach

```typescript
// apps/api/src/middlewares/rate-limit.ts

/**
 * Dual rate limiting: per-user AND per-IP
 */
export const dualRateLimitMiddleware = async (c: Context, next: Next) => {
  const userKey = getRateLimitKey(c); // user:123 or ip:1.2.3.4
  const ipKey = `ip:${getClientIp(c)}`;

  const config = getRateLimitConfig(getEndpointType(c.req.path));

  // Check both user and IP limits
  const userLimit = checkRateLimit(userKey, config);
  const ipLimit = checkRateLimit(ipKey, config);

  // Reject if either limit exceeded
  if (!userLimit.allowed || !ipLimit.allowed) {
    return c.json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: config.message
      }
    }, 429);
  }

  await next();
};
```

### Rate Limit Headers

#### Standard Headers

```text
X-RateLimit-Limit: Maximum requests per window
X-RateLimit-Remaining: Requests remaining in window
X-RateLimit-Reset: Unix timestamp when window resets
X-RateLimit-Type: Endpoint type (auth, public, admin, general)
```

#### Response Example

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1735689600
X-RateLimit-Type: general

{
  "success": true,
  "data": [...]
}
```

**When limit exceeded:**

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1735689600
X-RateLimit-Type: general
Retry-After: 45

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

### Configuration Examples

#### Development Environment

```env
# .env.local (Development)

# Relaxed limits for development
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000

RATE_LIMIT_AUTH_MAX_REQUESTS=50
RATE_LIMIT_PUBLIC_MAX_REQUESTS=500
RATE_LIMIT_ADMIN_MAX_REQUESTS=200
```

#### Production Environment

```env
# .env (Production)

# Strict limits for production
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

RATE_LIMIT_AUTH_MAX_REQUESTS=5
RATE_LIMIT_PUBLIC_MAX_REQUESTS=60
RATE_LIMIT_ADMIN_MAX_REQUESTS=30

# Enable headers
RATE_LIMIT_STANDARD_HEADERS=true
```

#### Testing Environment

```env
# .env.test (Testing)

# Disable rate limiting for tests
NODE_ENV=test
TESTING_RATE_LIMIT=false
```

### Bypass for Authenticated Users

```typescript
// apps/api/src/middlewares/rate-limit.ts

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  const auth = getAuth(c);

  // Higher limits for authenticated users
  if (auth?.userId) {
    const user = await auth.api.getSession({ headers: c.req.raw.headers });
    const role = user.publicMetadata?.role as UserRole;

    // Admin bypass
    if (role === 'admin') {
      await next();
      return;
    }

    // Premium users get higher limits
    if (user.publicMetadata?.premium) {
      config.maxRequests *= 2; // Double the limit
    }
  }

  // Apply normal rate limiting
  // ... rest of implementation
};
```

## CORS Configuration

Cross-Origin Resource Sharing (CORS) configuration for secure API access.

### CORS Principles

#### What is CORS?

CORS is a security feature that controls which origins can access your API.

**Same-Origin Policy:**

```text
✅ ALLOWED:
https://hospeda.com → https://hospeda.com/api

❌ BLOCKED (without CORS):
https://hospeda.com → https://api.hospeda.com
http://localhost:4321 → http://localhost:3001
```

**CORS Headers:**

```http
Access-Control-Allow-Origin: https://hospeda.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

#### Why CORS Matters

**Without CORS:**

- Browsers block cross-origin requests
- Frontend can't communicate with API
- No data exchange between domains

**With CORS:**

- Controlled cross-origin access
- Prevent unauthorized domains
- Enable legitimate requests

### Allowed Origins

#### Environment-Based Origins

```env
# .env - CORS Configuration

# Development
API_CORS_ORIGINS=http://localhost:3000,http://localhost:4321,http://localhost:3001

# Production
API_CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com,https://api.hospeda.com
```

#### Dynamic Origin Validation

```typescript
// apps/api/src/middlewares/cors.ts

import { cors } from 'hono/cors';
import { getCorsConfig } from '../utils/env';

export const createCorsMiddleware = () => {
  const corsConfig = getCorsConfig();

  // Handle wildcard origin
  let credentials = corsConfig.allowCredentials;
  if (corsConfig.origins.includes('*')) {
    credentials = false; // Can't use credentials with wildcard
  }

  return cors({
    origin: corsConfig.origins,
    allowMethods: corsConfig.allowMethods,
    allowHeaders: corsConfig.allowHeaders,
    exposeHeaders: corsConfig.exposeHeaders,
    credentials,
    maxAge: corsConfig.maxAge
  });
};
```

### Credentials Handling

#### Enable Credentials

```typescript
// apps/api/src/utils/env.ts

export function getCorsConfig() {
  return {
    origins: process.env.API_CORS_ORIGINS?.split(',') || ['http://localhost:4321'],
    allowCredentials: true, // Enable cookies/auth headers
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-actor-id',
      'x-user-id'
    ],
    exposeHeaders: ['Content-Length', 'X-Request-ID'],
    maxAge: 86400 // 24 hours
  };
}
```

**With Credentials:**

```typescript
// Frontend request with credentials

fetch('https://api.hospeda.com/accommodations', {
  method: 'GET',
  credentials: 'include', // Send cookies
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});
```

#### Wildcard Restriction

```typescript
// ❌ INVALID - Can't use wildcard with credentials

cors({
  origin: '*',
  credentials: true // ERROR!
});

// ✅ VALID - Specific origins with credentials

cors({
  origin: ['https://hospeda.com', 'https://admin.hospeda.com'],
  credentials: true
});
```

### Preflight Requests

#### OPTIONS Request Handling

```typescript
// apps/api/src/app.ts

import { Hono } from 'hono';
import { corsMiddleware } from './middlewares/cors';

const app = new Hono();

// CORS middleware handles OPTIONS automatically
app.use('*', corsMiddleware());

// OPTIONS requests are automatically handled
// Client sends:
// OPTIONS /accommodations
// Access-Control-Request-Method: POST
// Access-Control-Request-Headers: content-type,authorization

// Server responds:
// HTTP/1.1 204 No Content
// Access-Control-Allow-Origin: https://hospeda.com
// Access-Control-Allow-Methods: GET, POST, PUT, DELETE
// Access-Control-Allow-Headers: content-type, authorization
// Access-Control-Max-Age: 86400
```

#### Preflight Cache

```typescript
// Set preflight cache duration

cors({
  maxAge: 86400 // Cache preflight for 24 hours
});

// Browser won't send OPTIONS for 24 hours
// Reduces overhead for frequent requests
```

### Configuration by Environment

#### Development CORS

```env
# .env.local (Development)

# Allow all local origins
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4321

# Enable credentials
API_CORS_ALLOW_CREDENTIALS=true

# Relaxed max age
API_CORS_MAX_AGE=3600
```

#### Production CORS

```env
# .env (Production)

# Strict origin list
API_CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com

# Enable credentials
API_CORS_ALLOW_CREDENTIALS=true

# Longer max age
API_CORS_MAX_AGE=86400

# Strict methods
API_CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,PATCH
```

### Common Pitfalls

#### 1. Wildcard with Credentials

```typescript
// ❌ WRONG

cors({
  origin: '*',
  credentials: true
});

// Error: Cannot use wildcard with credentials

// ✅ CORRECT

cors({
  origin: ['https://hospeda.com'],
  credentials: true
});
```

#### 2. Missing Origin

```typescript
// ❌ WRONG - Origin not in allowed list

// .env
API_CORS_ORIGINS=https://hospeda.com

// Request from:
https://admin.hospeda.com

// Result: CORS error

// ✅ CORRECT - Add all required origins

API_CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com
```

#### 3. Protocol Mismatch

```typescript
// ❌ WRONG

// .env
API_CORS_ORIGINS=http://hospeda.com

// Request from:
https://hospeda.com

// Result: CORS error (http ≠ https)

// ✅ CORRECT

API_CORS_ORIGINS=https://hospeda.com
```

#### 4. Port Mismatch

```typescript
// ❌ WRONG

// .env
API_CORS_ORIGINS=http://localhost

// Request from:
http://localhost:4321

// Result: CORS error (no port ≠ :4321)

// ✅ CORRECT

API_CORS_ORIGINS=http://localhost:4321,http://localhost:3000
```

## Security Headers

HTTP security headers protect against common attacks.

### Content Security Policy (CSP)

#### CSP Configuration

```typescript
// apps/api/src/middlewares/security.ts

import { secureHeaders } from 'hono/secure-headers';

export const securityHeadersMiddleware = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts (careful!)
    styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles
    imgSrc: ["'self'", 'data:', 'https:'],    // Allow images from HTTPS
    connectSrc: ["'self'"],                    // API calls to same origin
    fontSrc: ["'self'", 'https:', 'data:'],   // Allow fonts
    objectSrc: ["'none'"],                     // Block <object>, <embed>
    mediaSrc: ["'self'"],                      // Media from same origin
    frameSrc: ["'self'"]                       // iframes from same origin
  }
});
```

**Generated Header:**

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https: data:; object-src 'none'; media-src 'self'; frame-src 'self'
```

#### CSP Directives

| Directive | Purpose | Example |
|-----------|---------|---------|
| `default-src` | Fallback for other directives | `'self'` |
| `script-src` | JavaScript sources | `'self' 'unsafe-inline'` |
| `style-src` | CSS sources | `'self' 'unsafe-inline'` |
| `img-src` | Image sources | `'self' data: https:` |
| `connect-src` | AJAX/WebSocket sources | `'self'` |
| `font-src` | Font sources | `'self' https: data:` |
| `object-src` | `<object>`, `<embed>` sources | `'none'` |
| `media-src` | `<audio>`, `<video>` sources | `'self'` |
| `frame-src` | iframe sources | `'self'` |

### HTTP Strict Transport Security (HSTS)

#### HSTS Configuration

```typescript
// apps/api/src/middlewares/security.ts

secureHeaders({
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload'
});
```

**Generated Header:**

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**What it does:**

- Forces HTTPS for 1 year (`max-age=31536000`)
- Applies to subdomains (`includeSubDomains`)
- Eligible for browser preload list (`preload`)

### X-Frame-Options

#### X-Frame-Options Configuration

```typescript
// apps/api/src/middlewares/security.ts

secureHeaders({
  xFrameOptions: 'DENY'
});
```

**Options:**

- `DENY`: Never allow framing
- `SAMEORIGIN`: Allow framing from same origin
- `ALLOW-FROM https://example.com`: Allow from specific origin (deprecated)

**Generated Header:**

```http
X-Frame-Options: DENY
```

**Prevents:**

- Clickjacking attacks
- Embedding in iframes

### X-Content-Type-Options

#### X-Content-Type-Options Configuration

```typescript
secureHeaders({
  xContentTypeOptions: 'nosniff'
});
```

**Generated Header:**

```http
X-Content-Type-Options: nosniff
```

**Prevents:**

- MIME type sniffing
- Executing scripts from non-script MIME types

### X-XSS-Protection

#### X-XSS-Protection Configuration

```typescript
secureHeaders({
  xXssProtection: '1; mode=block'
});
```

**Generated Header:**

```http
X-XSS-Protection: 1; mode=block
```

**What it does:**

- Enables XSS filter (`1`)
- Blocks page rendering if attack detected (`mode=block`)

**Note:** Deprecated in modern browsers (use CSP instead), but still useful for older browsers.

### Referrer-Policy

#### Referrer-Policy Configuration

```typescript
secureHeaders({
  referrerPolicy: 'strict-origin-when-cross-origin'
});
```

**Options:**

- `no-referrer`: Never send referrer
- `same-origin`: Send only for same-origin
- `strict-origin`: Send origin only (HTTPS → HTTPS)
- `strict-origin-when-cross-origin`: Full URL for same-origin, origin only for cross-origin

**Generated Header:**

```http
Referrer-Policy: strict-origin-when-cross-origin
```

### Permissions-Policy

#### Permissions-Policy Configuration

```typescript
secureHeaders({
  permissionsPolicy: {
    camera: false,
    microphone: false,
    geolocation: false,
    payment: false,
    usb: false,
    magnetometer: false,
    gyroscope: false,
    accelerometer: false
  }
});
```

**Generated Header:**

```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
```

**What it does:**

- Disables browser features
- Prevents feature abuse
- Improves privacy

### Implementation Examples

#### Full Security Headers Middleware

```typescript
// apps/api/src/middlewares/security.ts

import type { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { getSecurityConfig } from '../utils/env';

export const securityHeadersMiddleware = async (c: Context, next: Next) => {
  const securityConfig = getSecurityConfig();

  // Skip in non-production if disabled
  const shouldApply =
    process.env.NODE_ENV === 'production' ||
    securityConfig.headersEnabled;

  if (!shouldApply) {
    await next();
    return;
  }

  // Skip for documentation routes
  if (c.req.path.startsWith('/docs')) {
    await next();
    return;
  }

  // Apply security headers
  const middleware = secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    },
    strictTransportSecurity: securityConfig.strictTransportSecurity,
    xFrameOptions: securityConfig.xFrameOptions,
    xContentTypeOptions: securityConfig.xContentTypeOptions,
    xXssProtection: securityConfig.xXssProtection,
    referrerPolicy: securityConfig.referrerPolicy,
    permissionsPolicy: {
      camera: false,
      microphone: false,
      geolocation: false,
      payment: false,
      usb: false,
      magnetometer: false,
      gyroscope: false,
      accelerometer: false
    }
  });

  await middleware(c, next);
};
```

#### Environment-Specific Headers

```typescript
// apps/api/src/utils/env.ts

export function getSecurityConfig() {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    enabled: true,
    headersEnabled: isProd, // Only in production by default

    strictTransportSecurity: isProd
      ? 'max-age=31536000; includeSubDomains; preload'
      : 'max-age=0', // Disabled in dev

    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xXssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin'
  };
}
```

## Request Validation

### Zod Schema Validation

#### Schema Definition

```typescript
// packages/schemas/src/entities/accommodation/accommodation.crud.schema.ts

import { z } from 'zod';

export const createAccommodationSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters'),

  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters'),

  pricePerNight: z.number()
    .positive('Price must be positive')
    .max(999999, 'Price too high'),

  maxGuests: z.number()
    .int('Max guests must be an integer')
    .positive('Max guests must be positive')
    .max(50, 'Max guests cannot exceed 50'),

  address: z.string().min(5).max(500),

  city: z.string().min(2).max(100),

  images: z.array(z.string().url())
    .min(1, 'At least one image required')
    .max(20, 'Maximum 20 images allowed')
});

export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;
```

#### Validation Middleware

```typescript
// apps/api/src/middlewares/validation.ts

import type { Context, Next } from 'hono';
import type { ZodSchema } from 'zod';

export const validateRequest = (schema: ZodSchema) => {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);

      // Store validated data
      c.set('validatedData', validated);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        }, 400);
      }

      throw error;
    }
  };
};
```

### Request Body Validation

#### POST/PUT Routes

```typescript
// apps/api/src/routes/accommodation/create.ts

import { createOpenApiRoute } from '../../utils/route-factory';
import { createAccommodationSchema } from '@repo/schemas';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  requestBody: createAccommodationSchema, // Automatic validation
  responseSchema: accommodationSchema,
  handler: async (c, params, body) => {
    // body is already validated and typed
    const service = new AccommodationService(c);
    const result = await service.create(body);

    return result.data;
  }
});
```

#### Validation Errors

```json
// Invalid request
POST /accommodations
{
  "title": "AB",
  "pricePerNight": -100
}

// Response (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "path": ["title"],
        "message": "Title must be at least 3 characters"
      },
      {
        "path": ["pricePerNight"],
        "message": "Price must be positive"
      },
      {
        "path": ["description"],
        "message": "Required"
      }
    ]
  }
}
```

### Query Parameter Validation

#### GET Routes with Query Params

```typescript
// apps/api/src/routes/accommodation/list.ts

import { createListRoute } from '../../utils/route-factory';
import { searchAccommodationSchema } from '@repo/schemas';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations',
  summary: 'List accommodations',
  querySchema: searchAccommodationSchema.optional(),
  responseSchema: z.array(accommodationSchema),
  handler: async (c, params, body, query) => {
    // query is validated
    const service = new AccommodationService(c);
    return await service.findAll(query);
  }
});
```

**Query Schema:**

```typescript
// packages/schemas/src/entities/accommodation/accommodation.crud.schema.ts

export const searchAccommodationSchema = z.object({
  city: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  maxGuests: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});
```

#### Optional vs Required Parameters

```typescript
// All optional parameters
const querySchema = z.object({
  city: z.string().optional(),
  minPrice: z.number().optional()
});

// Required + optional
const querySchema = z.object({
  city: z.string(), // Required
  minPrice: z.number().optional()
});

// With defaults
const querySchema = z.object({
  page: z.coerce.number().default(1),
  pageSize: z.coerce.number().default(20)
});
```

### Path Parameter Validation

#### UUID Path Parameters

```typescript
// apps/api/src/routes/accommodation/getById.ts

import { createOpenApiRoute } from '../../utils/route-factory';

export const getAccommodationByIdRoute = createOpenApiRoute({
  method: 'get',
  path: '/accommodations/:id',
  summary: 'Get accommodation by ID',
  requestParams: {
    id: z.string().uuid('Invalid accommodation ID')
  },
  responseSchema: accommodationSchema,
  handler: async (c, params) => {
    // params.id is validated as UUID
    const service = new AccommodationService(c);
    const result = await service.findById({ id: params.id });

    return result.data;
  }
});
```

#### Enum Path Parameters

```typescript
// apps/api/src/routes/accommodation/getByStatus.ts

export const getAccommodationByStatusRoute = createOpenApiRoute({
  method: 'get',
  path: '/accommodations/status/:status',
  summary: 'Get accommodations by status',
  requestParams: {
    status: z.enum(['active', 'inactive', 'pending'])
  },
  responseSchema: z.array(accommodationSchema),
  handler: async (c, params) => {
    // params.status is 'active' | 'inactive' | 'pending'
    const service = new AccommodationService(c);
    return await service.findAll({ status: params.status });
  }
});
```

### File Upload Validation

#### File Type Validation

```typescript
// apps/api/src/routes/accommodation/uploadImage.ts

import { createOpenApiRoute } from '../../utils/route-factory';

const uploadImageSchema = z.object({
  file: z.custom<File>((file) => {
    if (!(file instanceof File)) return false;

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Allowed: JPEG, PNG, WebP');
    }

    return true;
  })
});

export const uploadImageRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations/:id/images',
  summary: 'Upload accommodation image',
  requestBody: uploadImageSchema,
  handler: async (c, params, body) => {
    const file = body.file;

    // Upload to Cloudinary
    const url = await uploadToCloudinary(file);

    return { url };
  }
});
```

#### File Size Validation

```typescript
// File size validation

const uploadImageSchema = z.object({
  file: z.custom<File>((file) => {
    if (!(file instanceof File)) return false;

    // Max 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File too large. Maximum size: 5MB');
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type');
    }

    return true;
  })
});
```

### Error Handling

#### Validation Error Response

```typescript
// Standardized validation error format

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "path": ["title"],
        "message": "Title must be at least 3 characters",
        "received": "AB"
      }
    ]
  }
}
```

#### Custom Error Messages

```typescript
// Custom validation messages

const schema = z.object({
  email: z.string()
    .email('Please provide a valid email address'),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  age: z.coerce.number()
    .int('Age must be a whole number')
    .positive('Age must be positive')
    .max(120, 'Please enter a valid age')
});
```

## Response Security

### Error Message Sanitization

#### Error Message Safe Error Responses

```typescript
// apps/api/src/utils/response-helpers.ts

export function handleRouteError(c: Context, error: unknown) {
  // Log full error internally
  apiLogger.error({
    message: 'Route error',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    path: c.req.path,
    method: c.req.method
  });

  // Return sanitized error to client
  if (error instanceof ServiceError) {
    const statusCode = getStatusCodeForError(error.code);

    return c.json({
      success: false,
      error: {
        code: error.code,
        message: error.message // Safe, user-facing message
        // Do NOT include stack trace
      }
    }, statusCode);
  }

  // Generic error (hide details)
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred' // Generic message
    }
  }, 500);
}
```

#### Error Transformation

```typescript
// Transform database errors to safe errors

function transformDatabaseError(error: unknown): ServiceError {
  if (error instanceof Error) {
    // PostgreSQL unique constraint violation
    if (error.message.includes('unique constraint')) {
      return new ServiceError(
        'Resource already exists',
        ServiceErrorCode.CONFLICT
      );
    }

    // PostgreSQL foreign key violation
    if (error.message.includes('foreign key constraint')) {
      return new ServiceError(
        'Referenced resource not found',
        ServiceErrorCode.NOT_FOUND
      );
    }

    // Don't expose raw database errors
    return new ServiceError(
      'Database operation failed',
      ServiceErrorCode.INTERNAL_ERROR
    );
  }

  return new ServiceError(
    'Unknown error',
    ServiceErrorCode.INTERNAL_ERROR
  );
}
```

### Prevent Information Disclosure

#### What NOT to Expose

```typescript
// ❌ WRONG - Exposing sensitive information

{
  "error": {
    "message": "Database error: column 'password_hash' does not exist",
    "stack": "Error: ...\n  at Database.query (/app/db.ts:42:10)",
    "query": "SELECT * FROM users WHERE email = 'user@example.com'",
    "env": {
      "DATABASE_URL": "postgresql://user:pass@localhost/db"
    }
  }
}

// ✅ CORRECT - Generic, safe error

{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An error occurred while processing your request"
  }
}
```

#### Safe Error Handling

```typescript
// apps/api/src/utils/error-handler.ts

export class SafeErrorHandler {
  /**
   * Convert any error to safe client error
   */
  static toClientError(error: unknown): ClientError {
    // Known service errors - safe to expose
    if (error instanceof ServiceError) {
      return {
        code: error.code,
        message: error.message
      };
    }

    // Validation errors - safe to expose
    if (error instanceof z.ZodError) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors.map(err => ({
          path: err.path,
          message: err.message
        }))
      };
    }

    // Unknown errors - hide details
    return {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An error occurred'
        : error instanceof Error ? error.message : 'Unknown error'
    };
  }

  /**
   * Log error with full details (server-side only)
   */
  static logError(error: unknown, context: Record<string, unknown>) {
    apiLogger.error({
      message: 'Error occurred',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context
    });
  }
}
```

### Safe Error Responses

#### Production Error Handling

```typescript
// apps/api/src/app.ts

app.onError((error, c) => {
  // Log full error
  SafeErrorHandler.logError(error, {
    path: c.req.path,
    method: c.req.method,
    headers: c.req.headers
  });

  // Return safe error
  const clientError = SafeErrorHandler.toClientError(error);

  return c.json({
    success: false,
    error: clientError
  }, getStatusCode(clientError.code));
});
```

#### Development Error Handling

```typescript
// Development: more verbose errors for debugging

app.onError((error, c) => {
  if (process.env.NODE_ENV === 'development') {
    return c.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        // Include more details in dev
      }
    }, 500);
  }

  // Production: safe errors
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred'
    }
  }, 500);
});
```

### Logging Without Exposing Data

#### Safe Logging

```typescript
// apps/api/src/utils/logger.ts

import { createLogger } from '@repo/logger';

export const apiLogger = createLogger({
  service: 'api',
  level: process.env.API_LOG_LEVEL || 'info'
});

/**
 * Log request with sanitized data
 */
export function logRequest(c: Context) {
  apiLogger.info({
    method: c.req.method,
    path: c.req.path,
    ip: getClientIp(c),
    userAgent: c.req.header('user-agent'),
    // Do NOT log:
    // - Authorization headers
    // - Cookies
    // - Request body (may contain passwords)
  });
}
```

#### Sensitive Data Redaction

```typescript
// Redact sensitive fields before logging

function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'apiKey',
    'secret',
    'creditCard',
    'ssn'
  ];

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// Usage
apiLogger.info({
  message: 'User created',
  data: redactSensitiveData(userData)
});
```

## Testing

### Rate Limit Testing

#### Test Rate Limit Enforcement

```typescript
// apps/api/test/middlewares/rate-limit.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../src/app';
import { clearRateLimitStore } from '../../src/middlewares/rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearRateLimitStore();
    process.env.TESTING_RATE_LIMIT = 'true';
    process.env.RATE_LIMIT_MAX_REQUESTS = '5';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
  });

  it('should allow requests under limit', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await app.request('/api/v1/accommodations');
      expect(response.status).toBe(200);
    }
  });

  it('should reject requests over limit', async () => {
    // Make 5 requests (at limit)
    for (let i = 0; i < 5; i++) {
      await app.request('/api/v1/accommodations');
    }

    // 6th request should be rejected
    const response = await app.request('/api/v1/accommodations');
    expect(response.status).toBe(429);

    const data = await response.json();
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should include rate limit headers', async () => {
    const response = await app.request('/api/v1/accommodations');

    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('4');
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});
```

#### Test Different Endpoint Types

```typescript
describe('Endpoint-Specific Rate Limits', () => {
  it('should apply stricter limits to auth endpoints', async () => {
    process.env.RATE_LIMIT_AUTH_MAX_REQUESTS = '3';

    // Make 3 requests to auth endpoint
    for (let i = 0; i < 3; i++) {
      await app.request('/api/v1/auth/signin');
    }

    // 4th request should be rejected
    const response = await app.request('/api/v1/auth/signin');
    expect(response.status).toBe(429);
  });

  it('should apply relaxed limits to public endpoints', async () => {
    process.env.RATE_LIMIT_PUBLIC_MAX_REQUESTS = '100';

    // Make 100 requests
    for (let i = 0; i < 100; i++) {
      const response = await app.request('/api/v1/public/accommodations');
      expect(response.status).toBe(200);
    }

    // 101st request should be rejected
    const response = await app.request('/api/v1/public/accommodations');
    expect(response.status).toBe(429);
  });
});
```

### CORS Testing

#### Test Allowed Origins

```typescript
// apps/api/test/middlewares/cors.test.ts

describe('CORS Configuration', () => {
  it('should allow requests from allowed origin', async () => {
    const response = await app.request('/api/v1/accommodations', {
      headers: {
        'Origin': 'http://localhost:4321'
      }
    });

    expect(response.headers.get('Access-Control-Allow-Origin'))
      .toBe('http://localhost:4321');
  });

  it('should reject requests from disallowed origin', async () => {
    const response = await app.request('/api/v1/accommodations', {
      headers: {
        'Origin': 'https://evil.com'
      }
    });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should allow credentials for allowed origins', async () => {
    const response = await app.request('/api/v1/accommodations', {
      headers: {
        'Origin': 'http://localhost:4321'
      }
    });

    expect(response.headers.get('Access-Control-Allow-Credentials'))
      .toBe('true');
  });
});
```

#### Test Preflight Requests

```typescript
describe('CORS Preflight', () => {
  it('should handle OPTIONS preflight request', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:4321',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods'))
      .toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers'))
      .toContain('content-type');
  });
});
```

### Security Headers Testing

#### Test Security Headers Presence

```typescript
// apps/api/test/middlewares/security.test.ts

describe('Security Headers', () => {
  it('should set Content-Security-Policy header', async () => {
    const response = await app.request('/api/v1/accommodations');

    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
  });

  it('should set X-Frame-Options header', async () => {
    const response = await app.request('/api/v1/accommodations');

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('should set X-Content-Type-Options header', async () => {
    const response = await app.request('/api/v1/accommodations');

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should set Strict-Transport-Security in production', async () => {
    process.env.NODE_ENV = 'production';

    const response = await app.request('/api/v1/accommodations');

    const hsts = response.headers.get('Strict-Transport-Security');
    expect(hsts).toContain('max-age=31536000');
  });
});
```

### Validation Testing

#### Test Request Validation

```typescript
// apps/api/test/routes/accommodation/create.test.ts

describe('POST /accommodations - Validation', () => {
  it('should reject invalid request body', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token'
      },
      body: JSON.stringify({
        title: 'AB', // Too short
        pricePerNight: -100 // Negative
      })
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details).toHaveLength(2);
  });

  it('should accept valid request body', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token'
      },
      body: JSON.stringify({
        title: 'Beach House',
        description: 'Beautiful beach house with ocean view',
        pricePerNight: 150,
        maxGuests: 6,
        address: '123 Beach Road',
        city: 'Concepción del Uruguay',
        images: ['https://example.com/image.jpg']
      })
    });

    expect(response.status).toBe(201);
  });
});
```

## Monitoring & Alerting

### Metrics Collection

#### Rate Limit Metrics

```typescript
// apps/api/src/middlewares/rate-limit.ts

import { apiLogger } from '../utils/logger';

export const rateLimitMiddleware = async (c: Context, next: Next) => {
  // ... rate limit logic

  // Log when approaching limit
  if (count > config.maxRequests * 0.8) {
    apiLogger.warn({
      message: 'Rate limit approaching',
      clientIp,
      path,
      endpointType,
      count: count + 1,
      limit: config.maxRequests,
      remaining: config.maxRequests - count - 1
    });
  }

  // Log when limit exceeded
  if (count >= config.maxRequests) {
    apiLogger.warn({
      message: 'Rate limit exceeded',
      clientIp,
      path,
      endpointType,
      count,
      limit: config.maxRequests
    });
  }

  await next();
};
```

#### Security Event Metrics

```typescript
// apps/api/src/utils/security-metrics.ts

export class SecurityMetrics {
  static recordSecurityEvent(event: SecurityEvent) {
    apiLogger.security({
      event: event.type,
      severity: event.severity,
      ip: event.ip,
      path: event.path,
      details: event.details,
      timestamp: new Date()
    });
  }
}

// Usage
SecurityMetrics.recordSecurityEvent({
  type: 'rate_limit_exceeded',
  severity: 'medium',
  ip: clientIp,
  path: c.req.path,
  details: { limit: 100, attempted: 150 }
});
```

### Log Aggregation

#### Structured Logging

```typescript
// apps/api/src/middlewares/logger.ts

import { apiLogger } from '../utils/logger';

export const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;

  apiLogger.info({
    type: 'request',
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    ip: getClientIp(c),
    userAgent: c.req.header('user-agent'),
    userId: getAuth(c)?.userId
  });
};
```

### Alert Configuration

#### Alert Rules

```typescript
// Example alert rules (configured in monitoring system)

const alertRules = [
  {
    name: 'High Rate Limit Violations',
    condition: 'rate_limit_exceeded > 100 in 5 minutes',
    severity: 'warning',
    action: 'notify-team'
  },
  {
    name: 'Potential DDoS Attack',
    condition: 'rate_limit_exceeded > 1000 in 1 minute',
    severity: 'critical',
    action: 'page-oncall'
  },
  {
    name: 'Authentication Failures',
    condition: 'auth_failed > 50 in 5 minutes from same IP',
    severity: 'warning',
    action: 'notify-security'
  },
  {
    name: 'CORS Violations',
    condition: 'cors_violation > 20 in 1 minute',
    severity: 'medium',
    action: 'log'
  }
];
```

## Performance Considerations

### Rate Limit Store

#### In-Memory Store (Current)

```typescript
// Simple in-memory store (single server)

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
```

**Pros:**

- Fast (no network calls)
- Simple implementation
- No dependencies

**Cons:**

- Not shared across servers
- Lost on server restart
- Memory usage grows

#### Redis Store (Production)

```typescript
// Redis store for production (multi-server)

import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(key: string, config: RateLimitConfig) {
  const current = await redis.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= config.maxRequests) {
    return { allowed: false, count };
  }

  const newCount = await redis.incr(key);

  if (newCount === 1) {
    await redis.expire(key, config.windowMs / 1000);
  }

  return { allowed: true, count: newCount };
}
```

### Caching

#### Response Caching

```typescript
// apps/api/src/middlewares/cache.ts

import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, Response>({
  max: 500, // Maximum 500 items
  ttl: 1000 * 60 * 5 // 5 minutes
});

export const cacheMiddleware = async (c: Context, next: Next) => {
  // Only cache GET requests
  if (c.req.method !== 'GET') {
    await next();
    return;
  }

  const key = c.req.url;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  await next();

  // Cache response
  if (c.res.status === 200) {
    cache.set(key, c.res.clone());
  }
};
```

### Compression

#### Gzip Compression

```typescript
// apps/api/src/middlewares/compression.ts

import { compress } from 'hono/compress';

export const compressionMiddleware = compress({
  encoding: 'gzip',
  threshold: 1024 // Only compress responses > 1KB
});
```

**Environment Configuration:**

```env
# .env

API_COMPRESSION_ENABLED=true
API_COMPRESSION_LEVEL=6
API_COMPRESSION_THRESHOLD=1024
```

## Best Practices

### Defense in Depth

**Multiple Security Layers:**

1. **Network Level**: CDN, firewall
2. **Application Level**: Rate limiting, CORS
3. **Authentication Level**: Better Auth, session tokens
4. **Validation Level**: Zod schemas
5. **Data Level**: Sanitization, encryption

### Least Privilege

**Grant minimum necessary permissions:**

```typescript
// ❌ WRONG - Admin access for everyone

const permissions = ['admin:all'];

// ✅ CORRECT - Minimal permissions

const permissions = getUserPermissions(user.role);
```

### Fail Securely

**Reject by default, allow explicitly:**

```typescript
// ❌ WRONG - Default allow

if (!isBlacklisted(origin)) {
  allowCORS();
}

// ✅ CORRECT - Default deny

if (isWhitelisted(origin)) {
  allowCORS();
}
```

### Regular Updates

**Keep dependencies updated:**

```bash
# Check for security updates weekly
pnpm audit

# Update dependencies
pnpm update

# Check for outdated packages
pnpm outdated
```

### Security Testing

**Regular security testing:**

1. **Automated Testing**: Run security tests in CI/CD
2. **Penetration Testing**: Periodic manual testing
3. **Dependency Scanning**: Automated vulnerability scanning
4. **Code Review**: Security-focused code reviews

## Troubleshooting

### Common Issues

#### 1. Rate Limit Too Strict

**Symptom:**

```text
Legitimate users getting rate limited
```

**Solution:**

```env
# Increase limits for specific endpoints

RATE_LIMIT_PUBLIC_MAX_REQUESTS=200
```

#### 2. CORS Errors

**Symptom:**

```text
Access to fetch blocked by CORS policy
```

**Solution:**

```env
# Add origin to allowed list

API_CORS_ORIGINS=http://localhost:4321,https://hospeda.com
```

#### 3. CSP Blocking Resources

**Symptom:**

```text
Refused to load script from 'https://cdn.example.com' because it violates CSP
```

**Solution:**

```typescript
// Add CDN to script-src

contentSecurityPolicy: {
  scriptSrc: ["'self'", 'https://cdn.example.com']
}
```

#### 4. Validation Failures

**Symptom:**

```text
Valid requests being rejected
```

**Solution:**

```typescript
// Check schema definition

const schema = z.object({
  email: z.string().email(), // Ensure email format is correct
  age: z.coerce.number() // Use coerce for query params
});
```

## References

**Official Documentation:**

- [Hono Documentation](https://hono.dev)
- [hono-rate-limiter](https://github.com/rhinobase/hono-rate-limiter)
- [Zod Documentation](https://zod.dev)
- [CORS Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

**Security Resources:**

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

**Related Hospeda Documentation:**

- [Security Overview](./overview.md)
- [Authentication](./authentication.md)
- [Input Sanitization](./input-sanitization.md)
- [OWASP Top 10](./owasp-top-10.md)
