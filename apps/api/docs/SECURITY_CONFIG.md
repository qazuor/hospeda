# 🛡️ Security Configuration

## Overview

The Hospeda API implements comprehensive security measures including security headers, CORS policies, rate limiting, input validation, and authentication. This document covers all security configurations and best practices.

## 🎯 Security Principles

- **🔒 Defense in Depth**: Multiple security layers
- **⚡ Zero Trust**: Verify everything, trust nothing  
- **🛡️ Secure by Default**: Safe configurations out of the box
- **🔍 Transparency**: Clear security policies and logging
- **🚀 Performance**: Security without compromising speed
- **🌍 Compliance Ready**: GDPR, OWASP guidelines

---

## 🛡️ Security Headers

### **Comprehensive Header Protection**

The security headers middleware applies a full suite of security headers:

```typescript
// src/middlewares/security.ts
export const securityHeadersMiddleware = async (c: Context, next: Next) => {
  // Production safety: Always apply headers in production
  const shouldApplyHeaders = env.NODE_ENV === 'production' || 
                            (env.SECURITY_ENABLED && env.SECURITY_HEADERS_ENABLED);

  if (!shouldApplyHeaders) {
    await next();
    return;
  }

  // Skip headers for documentation routes that need different CSP
  if (c.req.path.startsWith('/docs') || 
      c.req.path.startsWith('/reference') || 
      c.req.path.startsWith('/ui')) {
    await next();
    return;
  }

  // Apply comprehensive security headers
  const secureHeadersMiddleware = secureHeaders({
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
    strictTransportSecurity: env.SECURITY_STRICT_TRANSPORT_SECURITY,
    xFrameOptions: env.SECURITY_X_FRAME_OPTIONS,
    xContentTypeOptions: env.SECURITY_X_CONTENT_TYPE_OPTIONS,
    xXssProtection: env.SECURITY_X_XSS_PROTECTION,
    referrerPolicy: env.SECURITY_REFERRER_POLICY,
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

  await secureHeadersMiddleware(c, next);
};
```

### **Applied Security Headers**

#### **Content Security Policy (CSP)**

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https: data:; object-src 'none'; media-src 'self'; frame-src 'self'
```

**Protection Against:**

- Cross-Site Scripting (XSS)
- Data injection attacks
- Clickjacking
- Mixed content vulnerabilities

#### **Strict Transport Security (HSTS)**

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**Features:**

- Forces HTTPS connections
- Prevents protocol downgrade attacks
- 1-year cache duration
- Includes all subdomains

#### **X-Frame-Options**

```http
X-Frame-Options: SAMEORIGIN
```

**Protection:**

- Prevents clickjacking attacks
- Allows framing from same origin only

#### **X-Content-Type-Options**

```http
X-Content-Type-Options: nosniff
```

**Protection:**

- Prevents MIME type sniffing
- Blocks malicious file execution

#### **X-XSS-Protection**

```http
X-XSS-Protection: 1; mode=block
```

**Protection:**

- Enables XSS filtering
- Blocks detected XSS attacks

#### **Referrer Policy**

```http
Referrer-Policy: strict-origin-when-cross-origin
```

**Privacy:**

- Controls referrer information sharing
- Balances functionality and privacy

#### **Permissions Policy**

```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
```

**Protection:**

- Disables unnecessary browser APIs
- Prevents unauthorized feature access

---

## 🌐 CORS Configuration

### **Cross-Origin Resource Sharing Setup**

```typescript
// src/middlewares/cors.ts
export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return true;
    
    // Check against allowed origins
    const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());
    return allowedOrigins.includes(origin);
  },
  credentials: env.CORS_ALLOW_CREDENTIALS,
  maxAge: env.CORS_MAX_AGE,
  allowMethods: env.CORS_ALLOW_METHODS.split(','),
  allowHeaders: env.CORS_ALLOW_HEADERS.split(','),
  exposeHeaders: env.CORS_EXPOSE_HEADERS.split(',')
});
```

### **Environment Configuration**

```env
# Development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4173
CORS_ALLOW_CREDENTIALS=true
CORS_MAX_AGE=86400

# Production
CORS_ORIGINS=https://hospeda.com,https://www.hospeda.com,https://admin.hospeda.com
CORS_ALLOW_CREDENTIALS=true
CORS_MAX_AGE=86400
```

### **Dynamic CORS for Development**

```typescript
const isDevelopment = env.NODE_ENV === 'development';

export const corsMiddleware = cors({
  origin: (origin) => {
    if (isDevelopment) {
      // Allow localhost on any port in development
      return !origin || /^http:\/\/localhost:\d+$/.test(origin);
    }
    
    // Strict origin checking in production
    return env.CORS_ORIGINS.split(',').includes(origin || '');
  }
});
```

---

## 🚦 Rate Limiting

### **Advanced Rate Limiting Strategy**

```typescript
// src/middlewares/rate-limit.ts
export const rateLimitMiddleware = async (c: Context, next: Next) => {
  // Skip rate limiting in test environment unless explicitly testing
  if (process.env.NODE_ENV === 'test' && !process.env.TESTING_RATE_LIMIT) {
    await next();
    return;
  }

  if (!env.RATE_LIMIT_ENABLED) {
    await next();
    return;
  }

  // Extract client IP with fallbacks
  const clientIp = getClientIP(c);
  const now = Date.now();
  const windowStart = Math.floor(now / env.RATE_LIMIT_WINDOW_MS) * env.RATE_LIMIT_WINDOW_MS;
  const resetTime = windowStart + env.RATE_LIMIT_WINDOW_MS;

  // Get or create rate limit entry
  const key = `${clientIp}:${windowStart}`;
  let entry = rateLimitStore.get(key);

  if (!entry) {
    entry = { count: 0, windowStart };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  // Check if limit exceeded
  if (entry.count > env.RATE_LIMIT_MAX_REQUESTS) {
    const remaining = Math.ceil((resetTime - now) / 1000);
    
    // Set rate limit headers
    c.res.headers.set('X-RateLimit-Limit', env.RATE_LIMIT_MAX_REQUESTS.toString());
    c.res.headers.set('X-RateLimit-Remaining', '0');
    c.res.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
    c.res.headers.set('Retry-After', remaining.toString());

    return c.json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: env.RATE_LIMIT_MESSAGE,
        userFriendlyMessage: 'You\'re sending requests too quickly',
        suggestion: 'Please wait a moment before trying again',
        retryable: true,
        retryAfter: remaining
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') || 'unknown'
      }
    }, 429);
  }

  // Set success rate limit headers
  const remaining = env.RATE_LIMIT_MAX_REQUESTS - entry.count;
  c.res.headers.set('X-RateLimit-Limit', env.RATE_LIMIT_MAX_REQUESTS.toString());
  c.res.headers.set('X-RateLimit-Remaining', remaining.toString());
  c.res.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

  await next();
};
```

### **IP Address Detection**

```typescript
const getClientIP = (c: Context): string => {
  // Priority order for IP detection
  const forwardedFor = c.req.header('x-forwarded-for');
  const realIp = c.req.header('x-real-ip');
  const cfConnectingIp = c.req.header('cf-connecting-ip');

  if (forwardedFor) {
    // Take first IP from X-Forwarded-For chain
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
};
```

### **Rate Limiting Configuration**

```env
# Standard API
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000        # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100        # 100 requests per window
RATE_LIMIT_MESSAGE="Too many requests, please try again later."

# High-traffic endpoints
RATE_LIMIT_WINDOW_MS=60000         # 1 minute
RATE_LIMIT_MAX_REQUESTS=30         # 30 requests per minute

# Strict endpoints (auth, registration)
RATE_LIMIT_WINDOW_MS=3600000       # 1 hour
RATE_LIMIT_MAX_REQUESTS=5          # 5 attempts per hour
```

---

## 🔐 Authentication & Authorization

### **Clerk Integration**

```typescript
// src/middlewares/auth.ts
export const clerkAuth = () => {
  return clerkMiddleware({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
    
    // Optional: Custom JWT verification
    jwtKey: env.CLERK_JWT_KEY,
    
    // Configure session handling
    signInUrl: '/auth/sign-in',
    signUpUrl: '/auth/sign-up',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/onboarding'
  });
};
```

### **Actor-Based Authorization**

```typescript
// src/middlewares/actor.ts
export const actorMiddleware = () => async (c: Context, next: Next) => {
  const auth = getAuth(c);
  
  if (auth?.sessionId && auth?.userId) {
    // Authenticated user
    try {
      const user = await getUserById(auth.userId);
      c.set('actor', createUserActor(user, auth));
    } catch (error) {
      // Handle invalid user - create guest actor
      logger.warn('Invalid user ID in auth token', { userId: auth.userId });
      c.set('actor', createGuestActor());
    }
  } else {
    // Guest user
    c.set('actor', createGuestActor());
  }

  await next();
};
```

### **Permission-Based Access Control**

```typescript
// Route-level permission checking
export const requirePermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const actor = c.get('actor');
    
    if (actor.type === 'GUEST') {
      return c.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          userFriendlyMessage: 'Please log in to access this resource'
        }
      }, 401);
    }
    
    if (!actor.permissions.includes(permission)) {
      return c.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          userFriendlyMessage: 'You don\'t have permission to perform this action'
        }
      }, 403);
    }

    await next();
  };
};
```

---

## ✅ Input Validation & Sanitization

### **Zod Schema Validation**

```typescript
// Comprehensive input validation
const UserRegistrationSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .transform(email => email.toLowerCase().trim()),
    
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
    
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters')
    .transform(name => name.trim()),
    
  dateOfBirth: z.string()
    .datetime('Invalid date format')
    .transform(date => new Date(date))
    .refine(date => {
      const age = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 13;
    }, 'Must be at least 13 years old'),
    
  terms: z.boolean()
    .refine(val => val === true, 'Must accept terms and conditions')
});
```

### **SQL Injection Prevention**

```typescript
// Safe database queries with parameterized statements
export const getUserByEmail = async (email: string): Promise<User | null> => {
  // ✅ Safe: Using parameterized query
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );
  
  return result.rows[0] || null;
};

// ❌ Dangerous: Never do this
const unsafeQuery = `SELECT * FROM users WHERE email = '${email}'`;
```

### **XSS Prevention**

```typescript
// HTML sanitization for user content
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
};

// JSON response sanitization
export const sanitizeResponse = (data: any): any => {
  if (typeof data === 'string') {
    // Escape HTML characters in strings
    return data
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeResponse);
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeResponse(value);
    }
    return sanitized;
  }
  
  return data;
};
```

---

## 🔍 Security Monitoring

### **Security Event Logging**

```typescript
// src/utils/security-logging.ts
export const logSecurityEvent = (event: SecurityEvent) => {
  const logData = {
    timestamp: new Date().toISOString(),
    event: event.type,
    severity: event.severity,
    actor: event.actor,
    ip: event.ip,
    userAgent: event.userAgent,
    details: event.details,
    requestId: event.requestId
  };

  // Log to security-specific logger
  securityLogger.warn('Security event', logData);
  
  // Send to SIEM if configured
  if (siemConfig.enabled) {
    siemConfig.client.send(logData);
  }
  
  // Trigger alerts for critical events
  if (event.severity === 'critical') {
    alertingService.sendSecurityAlert(logData);
  }
};

// Example usage
logSecurityEvent({
  type: 'RATE_LIMIT_EXCEEDED',
  severity: 'medium',
  actor: c.get('actor'),
  ip: getClientIP(c),
  userAgent: c.req.header('user-agent'),
  details: { limit: 100, window: '15min' },
  requestId: c.get('requestId')
});
```

### **Vulnerability Scanning**

```typescript
// Regular security health checks
export const runSecurityChecks = async (): Promise<SecurityReport> => {
  const report: SecurityReport = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  // Check for weak configurations
  report.checks.push(await checkSecurityHeaders());
  report.checks.push(await checkRateLimiting());
  report.checks.push(await checkCORSConfig());
  report.checks.push(await checkAuthenticationConfig());
  
  // Check for suspicious patterns
  report.checks.push(await checkForAnomalousTraffic());
  report.checks.push(await checkForBruteForceAttempts());
  
  return report;
};

// Automated daily security report
if (env.NODE_ENV === 'production') {
  setInterval(async () => {
    const report = await runSecurityChecks();
    securityLogger.info('Daily security report', report);
    
    // Alert on any failed checks
    const failedChecks = report.checks.filter(c => !c.passed);
    if (failedChecks.length > 0) {
      alertingService.sendSecurityAlert({
        type: 'SECURITY_CHECK_FAILED',
        failedChecks
      });
    }
  }, 24 * 60 * 60 * 1000); // Daily
}
```

---

## 🧪 Security Testing

### **Penetration Testing Helpers**

```typescript
describe('Security Tests', () => {
  describe('Rate Limiting', () => {
    it('should block excessive requests', async () => {
      const requests = Array.from({ length: 110 }, () =>
        app.request('/api/test', {
          headers: { 'X-Forwarded-For': '192.168.1.100' }
        })
      );
      
      const responses = await Promise.all(requests);
      const blockedRequests = responses.filter(r => r.status === 429);
      
      expect(blockedRequests.length).toBeGreaterThan(0);
    });
  });
  
  describe('Input Validation', () => {
    it('should prevent XSS attacks', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await app.request('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: xssPayload })
      });
      
      expect(response.status).toBe(400);
    });
    
    it('should prevent SQL injection', async () => {
      const sqlInjection = "1'; DROP TABLE users; --";
      
      const response = await app.request(`/api/users/${sqlInjection}`);
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('Authentication', () => {
    it('should require valid tokens', async () => {
      const response = await app.request('/api/protected', {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      
      expect(response.status).toBe(401);
    });
  });
});
```

---

## 🚀 Production Security Checklist

### **Pre-Deployment Checklist**

- [ ] **Security Headers**: All headers properly configured
- [ ] **HTTPS**: SSL certificates valid and HSTS enabled
- [ ] **Rate Limiting**: Appropriate limits for all endpoints
- [ ] **CORS**: Restrictive origins for production
- [ ] **Input Validation**: All inputs validated and sanitized
- [ ] **Authentication**: Secure token handling
- [ ] **Error Handling**: No sensitive information in errors
- [ ] **Logging**: Security events properly logged
- [ ] **Dependencies**: No known vulnerabilities
- [ ] **Secrets**: No secrets in code or environment files

### **Security Monitoring**

```typescript
// Production security monitoring
const securityMetrics = {
  rateLimitViolations: 0,
  authenticationFailures: 0,
  validationErrors: 0,
  suspiciousRequests: 0
};

// Alert thresholds
const ALERT_THRESHOLDS = {
  rateLimitViolations: 100,      // per hour
  authenticationFailures: 50,     // per hour  
  validationErrors: 200,          // per hour
  suspiciousRequests: 10          // per hour
};

// Monitor and alert
setInterval(() => {
  for (const [metric, value] of Object.entries(securityMetrics)) {
    if (value > ALERT_THRESHOLDS[metric]) {
      alertingService.sendSecurityAlert({
        type: 'THRESHOLD_EXCEEDED',
        metric,
        value,
        threshold: ALERT_THRESHOLDS[metric]
      });
    }
  }
  
  // Reset counters
  Object.keys(securityMetrics).forEach(key => {
    securityMetrics[key] = 0;
  });
}, 60 * 60 * 1000); // Hourly
```

---

## 📚 Related Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Security configuration options
- [Error Handling](./ERROR_HANDLING.md) - Secure error responses
- [Actor System](./ACTOR_SYSTEM.md) - Authentication and authorization
- [Rate Limiting](./METRICS_SYSTEM.md) - Rate limiting metrics
- [Testing Guide](./TESTING_GUIDE.md) - Security testing strategies

---

*Security is implemented as a layered defense system ensuring the API is protected against common vulnerabilities and attacks. Last updated: 2024-12-19*
