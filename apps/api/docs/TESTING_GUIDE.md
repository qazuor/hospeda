# 🧪 Testing Guide

## Overview

The Hospeda API uses a comprehensive testing strategy with Vitest, ensuring high code quality, reliability, and maintainability. This guide covers unit tests, integration tests, performance tests, and security testing.

## 🎯 Testing Philosophy

- **📊 High Coverage**: Aim for >90% test coverage
- **🚀 Fast Feedback**: Tests run quickly in CI/CD
- **🔍 Comprehensive**: Unit, integration, and E2E testing
- **💡 Clear Intent**: Tests serve as living documentation
- **🛡️ Resilient**: Tests are reliable and don't flake
- **⚡ Performance**: Includes performance and load testing

---

## 🏗️ Testing Architecture

### **Test Types Pyramid**
```
    /\
   /  \
  / E2E \
 /______\
/        \
|  INTEGRATION  |
|              |
\______________/
|    UNIT    |
|   TESTS    |
\____________/
```

### **Testing Stack**
- **Test Runner**: Vitest
- **Assertions**: Vitest's built-in assertions
- **Mocking**: Vitest mocks + custom utilities
- **Coverage**: c8 (built into Vitest)
- **Performance**: Custom performance testing utilities
- **Security**: Custom security testing helpers

---

## 🔧 Test Configuration

### **Vitest Configuration**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    timeout: 10000,
    testTimeout: 5000,
    hookTimeout: 10000
  }
});
```

### **Test Setup**
```typescript
// test/setup.ts
import { beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { resetMetrics } from '../src/middlewares/metrics';

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock external services
  vi.mock('@repo/logger', () => ({
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  }));
});

beforeEach(() => {
  // Reset state before each test
  vi.clearAllMocks();
  resetMetrics();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});
```

---

## 🧩 Unit Testing

### **Testing Utilities and Pure Functions**
```typescript
// test/utils/zod-error-transformer.test.ts
import { describe, expect, it } from 'vitest';
import { transformZodError } from '../../src/utils/zod-error-transformer';
import { ZodError } from 'zod';

describe('Zod Error Transformer', () => {
  it('should transform validation errors with user-friendly messages', () => {
    const zodError = new ZodError([
      {
        code: 'too_small',
        minimum: 8,
        type: 'string',
        inclusive: true,
        exact: false,
        message: 'String must contain at least 8 character(s)',
        path: ['password']
      }
    ]);

    const result = transformZodError(zodError);

    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.details).toHaveLength(1);
    expect(result.details[0].field).toBe('password');
    expect(result.details[0].userFriendlyMessage).toBe('Password must be at least 8 characters long');
    expect(result.details[0].suggestion).toBe('Try adding more characters. Minimum required: 8');
  });

  it('should handle multiple validation errors', () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['email'],
        message: 'Expected string, received number'
      },
      {
        code: 'too_small',
        minimum: 2,
        type: 'string',
        path: ['name'],
        message: 'String must contain at least 2 character(s)'
      }
    ]);

    const result = transformZodError(zodError);

    expect(result.details).toHaveLength(2);
    expect(result.summary.totalErrors).toBe(2);
    expect(result.summary.fieldCount).toBe(2);
  });
});
```

### **Testing Middleware**
```typescript
// test/middlewares/security.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { securityHeadersMiddleware } from '../../src/middlewares/security';

describe('Security Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use(securityHeadersMiddleware);
    app.get('/test', (c) => c.json({ message: 'success' }));
  });

  it('should apply security headers', async () => {
    const response = await app.request('/test');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(['DENY', 'SAMEORIGIN']).toContain(response.headers.get('X-Frame-Options'));
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('should skip headers for documentation routes', async () => {
    const docsResponse = await app.request('/docs');
    const refResponse = await app.request('/reference');
    const uiResponse = await app.request('/ui');

    expect(docsResponse.headers.get('Content-Security-Policy')).toBeNull();
    expect(refResponse.headers.get('Content-Security-Policy')).toBeNull();
    expect(uiResponse.headers.get('Content-Security-Policy')).toBeNull();
  });
});
```

### **Testing Route Factories**
```typescript
// test/utils/route-factory.test.ts
import { describe, expect, it } from 'vitest';
import { createSimpleRoute } from '../../src/utils/route-factory';
import { z } from 'zod';

describe('Route Factory', () => {
  it('should create simple route with validation', async () => {
    const TestSchema = z.object({
      name: z.string().min(2)
    });

    const route = createSimpleRoute({
      method: 'post',
      path: '/test',
      summary: 'Test endpoint',
      requestBody: TestSchema,
      handler: async (ctx, body) => {
        return { processed: body.name };
      }
    });

    const app = new Hono().route('/', route);

    // Valid request
    const validResponse = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name' })
    });

    const validData = await validResponse.json();
    expect(validResponse.status).toBe(200);
    expect(validData.success).toBe(true);
    expect(validData.data.processed).toBe('Valid Name');

    // Invalid request
    const invalidResponse = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A' })
    });

    const invalidData = await invalidResponse.json();
    expect(invalidResponse.status).toBe(400);
    expect(invalidData.success).toBe(false);
    expect(invalidData.error.code).toBe('VALIDATION_ERROR');
  });
});
```

---

## 🔗 Integration Testing

### **API Endpoint Testing**
```typescript
// test/integration/user/list.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { initApp } from '../../../src/app';
import { createMockUserActor } from '../../utils/test-actors';

describe('User List Endpoint', () => {
  let app: ReturnType<typeof initApp>;

  beforeEach(() => {
    app = initApp();
  });

  describe('GET /api/v1/public/users', () => {
    it('should return paginated user list', async () => {
      const response = await app.request('/api/v1/public/users?page=1&limit=10', {
        headers: {
          'user-agent': 'test-agent/1.0',
          'accept': 'application/json'
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.users).toBeDefined();
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(10);
    });

    it('should validate pagination parameters', async () => {
      const response = await app.request('/api/v1/public/users?page=invalid&limit=999');

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include security headers', async () => {
      const response = await app.request('/api/v1/public/users');

      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-request-id')).toBeTruthy();
    });
  });
});
```

### **Middleware Integration Testing**
```typescript
// test/integration/middleware-interactions.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { initApp } from '../../src/app';

describe('Middleware Interactions', () => {
  let app: ReturnType<typeof initApp>;

  beforeEach(() => {
    app = initApp();
  });

  it('should apply middleware stack in correct order', async () => {
    const response = await app.request('/health', {
      headers: {
        'user-agent': 'test-agent/1.0',
        'x-request-id': 'test-request-123'
      }
    });

    const data = await response.json();

    // Check that all middleware applied correctly
    expect(response.status).toBe(200);
    
    // Request ID middleware
    expect(response.headers.get('x-request-id')).toBe('test-request-123');
    
    // Security headers middleware  
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    
    // Response formatting middleware
    expect(data.success).toBe(true);
    expect(data.metadata.requestId).toBe('test-request-123');
    
    // Metrics middleware (should track the request)
    expect(data.metadata.responseTime).toBeDefined();
  });

  it('should handle rate limiting correctly', async () => {
    // Set rate limiting for this test
    process.env.TESTING_RATE_LIMIT = 'true';

    // Make requests up to the limit
    const requests = Array.from({ length: 5 }, () =>
      app.request('/health', {
        headers: {
          'X-Forwarded-For': '192.168.1.200',
          'user-agent': 'test-agent/1.0'
        }
      })
    );

    const responses = await Promise.all(requests);
    
    // First 3 should succeed, rest should be rate limited
    const successfulResponses = responses.filter(r => r.status === 200);
    const rateLimitedResponses = responses.filter(r => r.status === 429);

    expect(successfulResponses.length).toBe(3);
    expect(rateLimitedResponses.length).toBe(2);

    // Check rate limit headers
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.headers.get('x-ratelimit-limit')).toBe('3');
    expect(lastResponse.headers.get('x-ratelimit-remaining')).toBe('0');
  });
});
```

---

## ⚡ Performance Testing

### **Response Time Testing**
```typescript
// test/integration/performance-stack.test.ts
import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';

describe('Performance Tests', () => {
  describe('Response Time Requirements', () => {
    it('should respond to health checks quickly', async () => {
      const app = initApp();
      const startTime = Date.now();

      const response = await app.request('/health');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // < 100ms
    });

    it('should handle concurrent requests efficiently', async () => {
      const app = initApp();
      const concurrentRequests = 50;

      const startTime = Date.now();
      const requests = Array.from({ length: concurrentRequests }, () =>
        app.request('/health')
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);
      
      // Should handle 50 requests in reasonable time
      expect(totalTime).toBeLessThan(2000); // < 2 seconds
      
      // Calculate throughput
      const throughput = concurrentRequests / (totalTime / 1000);
      expect(throughput).toBeGreaterThan(25); // > 25 requests/second
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during high request volume', async () => {
      const app = initApp();
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate high request volume
      for (let i = 0; i < 1000; i++) {
        await app.request('/health');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
```

### **Load Testing Utilities**
```typescript
// test/utils/load-testing.ts
export interface LoadTestConfig {
  concurrency: number;
  duration: number; // seconds
  endpoint: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface LoadTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

export const runLoadTest = async (
  app: any,
  config: LoadTestConfig
): Promise<LoadTestResults> => {
  const results: LoadTestResults = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    requestsPerSecond: 0,
    errorRate: 0
  };

  const responseTimes: number[] = [];
  const startTime = Date.now();
  const endTime = startTime + (config.duration * 1000);

  // Run concurrent requests for specified duration
  const workers = Array.from({ length: config.concurrency }, async () => {
    while (Date.now() < endTime) {
      const requestStart = Date.now();
      
      try {
        const response = await app.request(config.endpoint, {
          method: config.method || 'GET',
          headers: config.headers,
          body: config.body ? JSON.stringify(config.body) : undefined
        });

        const responseTime = Date.now() - requestStart;
        responseTimes.push(responseTime);
        results.totalRequests++;

        if (response.status >= 200 && response.status < 400) {
          results.successfulRequests++;
        } else {
          results.failedRequests++;
        }
      } catch (error) {
        results.totalRequests++;
        results.failedRequests++;
      }
    }
  });

  await Promise.all(workers);

  // Calculate results
  const totalDuration = (Date.now() - startTime) / 1000;
  results.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  results.minResponseTime = Math.min(...responseTimes);
  results.maxResponseTime = Math.max(...responseTimes);
  results.requestsPerSecond = results.totalRequests / totalDuration;
  results.errorRate = (results.failedRequests / results.totalRequests) * 100;

  return results;
};
```

---

## 🛡️ Security Testing

### **Authentication Testing**
```typescript
// test/security/auth.test.ts
import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';

describe('Authentication Security', () => {
  it('should reject requests without authentication', async () => {
    const app = initApp();
    
    const response = await app.request('/api/v1/protected-endpoint');
    
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeTruthy();
  });

  it('should reject invalid tokens', async () => {
    const app = initApp();
    
    const response = await app.request('/api/v1/protected-endpoint', {
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      }
    });
    
    expect(response.status).toBe(401);
  });

  it('should prevent token brute force attacks', async () => {
    const app = initApp();
    
    // Attempt multiple invalid tokens rapidly
    const invalidTokens = Array.from({ length: 20 }, (_, i) => 
      `invalid-token-${i}`
    );

    const responses = await Promise.all(
      invalidTokens.map(token =>
        app.request('/api/v1/protected-endpoint', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      )
    );

    // Should rate limit after multiple failures
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

### **Input Validation Security Testing**
```typescript
// test/security/validation.test.ts
import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';

describe('Input Validation Security', () => {
  const maliciousPayloads = [
    // XSS attempts
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(1)">',
    
    // SQL injection attempts
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "UNION SELECT * FROM users",
    
    // Path traversal attempts
    '../../../etc/passwd',
    '..\\..\\windows\\system32',
    
    // Command injection attempts
    '; cat /etc/passwd',
    '`whoami`',
    '$(ls -la)',
    
    // NoSQL injection attempts
    '{"$ne": null}',
    '{"$gt": ""}',
    
    // LDAP injection attempts
    '*)(&(objectClass=*)',
    '*)(uid=*))(&(uid=*'
  ];

  it('should reject all malicious payloads', async () => {
    const app = initApp();

    for (const payload of maliciousPayloads) {
      const response = await app.request('/api/v1/test-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });

      // Should reject with 400 (validation error) or 403 (security error)
      expect([400, 403]).toContain(response.status);
    }
  });

  it('should sanitize output data', async () => {
    const app = initApp();
    
    const response = await app.request('/api/v1/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: '<script>alert("xss")</script>' 
      })
    });

    const data = await response.json();
    
    // Response should not contain raw script tags
    expect(JSON.stringify(data)).not.toMatch(/<script[^>]*>/i);
  });
});
```

### **Rate Limiting Security Testing**
```typescript
// test/security/rate-limiting.test.ts
import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';

describe('Rate Limiting Security', () => {
  it('should prevent API abuse', async () => {
    const app = initApp();
    process.env.TESTING_RATE_LIMIT = 'true';

    // Simulate rapid requests from same IP
    const requests = Array.from({ length: 50 }, () =>
      app.request('/api/v1/public/users', {
        headers: { 'X-Forwarded-For': '192.168.1.250' }
      })
    );

    const responses = await Promise.all(requests);
    
    // Should have rate limited responses
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
    
    // Rate limited responses should have proper headers
    const limitedResponse = rateLimited[0];
    expect(limitedResponse.headers.get('retry-after')).toBeTruthy();
    expect(limitedResponse.headers.get('x-ratelimit-limit')).toBeTruthy();
  });

  it('should handle distributed requests correctly', async () => {
    const app = initApp();
    process.env.TESTING_RATE_LIMIT = 'true';

    // Simulate requests from different IPs
    const requests = Array.from({ length: 10 }, (_, i) =>
      app.request('/api/v1/public/users', {
        headers: { 'X-Forwarded-For': `192.168.1.${i + 1}` }
      })
    );

    const responses = await Promise.all(requests);
    
    // Different IPs should not be rate limited
    const successful = responses.filter(r => r.status === 200);
    expect(successful.length).toBe(10);
  });
});
```

---

## 🎯 Test Utilities

### **Mock Factories**
```typescript
// test/utils/test-actors.ts
export const createMockUserActor = (overrides?: Partial<User>): UserActor => {
  return {
    type: 'USER',
    isAuthenticated: true,
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      createdAt: new Date().toISOString(),
      ...overrides
    },
    permissions: ['read', 'write'],
    metadata: {
      sessionId: 'test-session-123',
      loginTime: new Date().toISOString()
    }
  };
};

export const createMockGuestActor = (): GuestActor => {
  return {
    type: 'GUEST',
    isAuthenticated: false,
    user: null,
    permissions: ['read'],
    metadata: {
      sessionId: null,
      requestId: 'test-request-123'
    }
  };
};
```

### **Test Data Generators**
```typescript
// test/utils/test-data.ts
export const generateTestUser = (overrides?: Partial<User>): User => {
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
};

export const generateTestRequest = (overrides?: any) => {
  return {
    method: 'GET',
    headers: {
      'user-agent': 'test-agent/1.0',
      'accept': 'application/json',
      'x-request-id': `test-${Date.now()}`
    },
    ...overrides
  };
};
```

### **Database Testing Utilities**
```typescript
// test/utils/db-testing.ts
export const setupTestDatabase = async () => {
  // Create test database
  await createTestDb();
  
  // Run migrations
  await runMigrations();
  
  // Seed test data
  await seedTestData();
};

export const cleanupTestDatabase = async () => {
  // Clean up test data
  await truncateAllTables();
  
  // Drop test database
  await dropTestDb();
};

export const createTestTransaction = async () => {
  const transaction = await db.transaction();
  
  return {
    db: transaction,
    rollback: () => transaction.rollback(),
    commit: () => transaction.commit()
  };
};
```

---

## 📊 Test Coverage & Reporting

### **Coverage Configuration**
```typescript
// vitest.config.ts - coverage section
coverage: {
  provider: 'c8',
  reporter: ['text', 'json', 'html', 'lcov'],
  exclude: [
    'node_modules/**',
    'test/**',
    '**/*.d.ts',
    '**/*.config.*',
    'src/types/**',
    'dist/**'
  ],
  thresholds: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Per-file thresholds for critical files
    'src/middlewares/security.ts': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95
    },
    'src/utils/zod-error-transformer.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  }
}
```

### **Test Scripts**
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:file": "vitest run",
    "test:integration": "vitest run test/integration",
    "test:unit": "vitest run test/unit test/utils test/middlewares",
    "test:security": "vitest run test/security",
    "test:performance": "vitest run test/performance"
  }
}
```

---

## 🚀 CI/CD Integration

### **GitHub Actions Workflow**
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run linter
        run: pnpm lint
      
      - name: Run type check
        run: pnpm typecheck
      
      - name: Run unit tests
        run: pnpm test:unit --coverage
      
      - name: Run integration tests
        run: pnpm test:integration
      
      - name: Run security tests
        run: pnpm test:security
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
      
      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: codecov/codecov-action@v3
```

---

## 🔍 Debugging Tests

### **Debug Configuration**
```typescript
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--threads", "false"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

### **Test Debugging Utilities**
```typescript
// test/utils/debug.ts
export const debugTest = (testName: string, data: any) => {
  if (process.env.DEBUG_TESTS) {
    console.log(`[DEBUG] ${testName}:`, JSON.stringify(data, null, 2));
  }
};

export const logTestRequest = (request: any, response: any) => {
  if (process.env.DEBUG_TESTS) {
    console.log('Request:', {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body
    });
    console.log('Response:', {
      status: response.status,
      headers: response.headers,
      body: response.body
    });
  }
};
```

---

## 📚 Related Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Test environment configuration
- [Route Factory System](./ROUTE_FACTORY_SYSTEM.md) - Testing route factories
- [Security Configuration](./SECURITY_CONFIG.md) - Security testing
- [Metrics System](./METRICS_SYSTEM.md) - Performance testing
- [Error Handling](./ERROR_HANDLING.md) - Error testing strategies

---

*This testing guide ensures comprehensive coverage and high code quality across the entire API. Last updated: 2024-12-19*
