# 📘 Hospeda API - Complete Technical Guide

> **Comprehensive guide for developers**: Build and maintain the Hospeda API following current best practices and project standards.

## 📋 Table of Contents

- [📘 Hospeda API - Complete Technical Guide](#-hospeda-api---complete-technical-guide)
  - [📋 Table of Contents](#-table-of-contents)
  - [🎯 Architecture Overview](#-architecture-overview)
    - [**Tech Stack**](#tech-stack)
    - [**Core Principles**](#core-principles)
  - 🏗️ Project Structure
  - ⚙️ Setup \& Configuration
    - [**Environment Variables**](#environment-variables)
    - [**Key Configuration**](#key-configuration)
  - [🔧 Middleware System](#-middleware-system)
    - [**Middleware Stack Order**](#middleware-stack-order)
    - [**Key Middleware Features**](#key-middleware-features)
      - [**Security Headers**](#security-headers)
      - [**Rate Limiting**](#rate-limiting)
      - [**Metrics Collection**](#metrics-collection)
  - 🛣️ Route Factories
    - [**Modern Route Creation System**](#modern-route-creation-system)
  - 🔐 Authentication \& Authorization
    - [**Actor System**](#actor-system)
  - [📊 Response Format](#-response-format)
    - [**Standardized API Responses**](#standardized-api-responses)
  - [✅ Validation System](#-validation-system)
    - [**Zod-Powered Validation**](#zod-powered-validation)
  - [🔄 Error Handling](#-error-handling)
    - [**Comprehensive Error Management**](#comprehensive-error-management)
  - 📊 Metrics \& Monitoring
    - [**Advanced Metrics System**](#advanced-metrics-system)
  - [🧪 Testing Strategy](#-testing-strategy)
    - [**Comprehensive Test Coverage**](#comprehensive-test-coverage)
  - [📖 API Documentation](#-api-documentation)
    - [**OpenAPI/Swagger Integration**](#openapiswagger-integration)
  - [📚 Additional Documentation](#-additional-documentation)
  - [🚀 Quick Start](#-quick-start)

---

## 🎯 Architecture Overview

### **Tech Stack**

- **Framework**: Hono (High-performance web framework)
- **Runtime**: Node.js 18+ with TypeScript 5.0+
- **Validation**: Zod schemas with custom error transformation
- **Authentication**: Clerk Auth with JWT tokens
- **Documentation**: OpenAPI/Swagger auto-generation
- **Testing**: Vitest with comprehensive test suites
- **Metrics**: Built-in performance monitoring
- **Security**: Advanced security headers and rate limiting

### **Core Principles**

1. **Type Safety First**: Everything is strongly typed
2. **Middleware Composition**: Modular, reusable middleware
3. **Consistent Response Format**: Standardized API responses
4. **Performance Focused**: Optimized for speed and scalability
5. **Developer Experience**: Easy to use and maintain

---

## 🏗️ Project Structure

```
apps/api/
├── src/
│   ├── app.ts                 # Main application entry
│   ├── middlewares/           # All middleware implementations
│   │   ├── auth.ts           # Clerk authentication
│   │   ├── actor.ts          # Actor system (user/guest)
│   │   ├── security.ts       # Comprehensive security headers
│   │   ├── rate-limit.ts     # Advanced rate limiting with IP tracking
│   │   ├── metrics.ts        # Performance metrics & monitoring
│   │   ├── validation.ts     # Input validation with Zod
│   │   └── response.ts       # Response formatting & error handling
│   ├── routes/               # Route definitions
│   │   ├── health/          # Health check endpoints
│   │   └── examples/        # Example CRUD implementations
│   ├── utils/               # Utility functions
│   │   ├── env.ts          # Environment configuration & validation
│   │   ├── route-factory.ts # Advanced route creation system
│   │   └── zod-error-transformer.ts # User-friendly error messages
│   └── types/              # TypeScript type definitions
├── test/                   # Comprehensive test suite
│   ├── integration/       # API integration tests
│   ├── middlewares/       # Middleware unit tests
│   ├── security/          # Security & penetration tests
│   ├── utils/            # Utility function tests
│   └── performance/      # Load & performance tests
├── docs/                   # Complete documentation suite
│   ├── COMPLETE_API_GUIDE.md     # This comprehensive guide
│   ├── ROUTE_FACTORY_SYSTEM.md   # Route factory documentation
│   ├── ACTOR_SYSTEM.md          # Authentication & authorization
│   ├── SECURITY_CONFIG.md       # Security configuration
│   ├── METRICS_SYSTEM.md        # Monitoring & metrics
│   ├── ERROR_HANDLING.md        # Error management
│   ├── TESTING_GUIDE.md         # Testing strategies
│   └── ENVIRONMENT_VARIABLES.md # Configuration reference
└── package.json
```

---

## ⚙️ Setup & Configuration

### **Environment Variables**

The API uses a comprehensive environment configuration system. See [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md) for complete reference.

### **Key Configuration**

```typescript
// src/utils/env.ts
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: Number(process.env.API_PORT) || 3001,
  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED === 'true',
  SECURITY_ENABLED: process.env.SECURITY_ENABLED === 'true',
  // ... comprehensive configuration
};
```

---

## 🔧 Middleware System

### **Middleware Stack Order**

```typescript
// src/utils/create-app.ts
app.use(requestId())                    // Request tracking
   .use(loggerMiddleware)               // Request logging
   .use(corsMiddleware)                 // CORS configuration
   .use(rateLimitMiddleware)            // Rate limiting
   .use(securityHeadersMiddleware)      // Security headers
   .use(compressionMiddleware)          // Response compression
   .use(cacheMiddleware)               // Response caching
   .use(metricsMiddleware)             // Performance metrics
   .use(validationMiddleware)          // Request validation
   .use(responseFormattingMiddleware)  // Response formatting
   .use(clerkAuth())                   // Authentication
   .use(actorMiddleware())             // Actor system
```

### **Key Middleware Features**

#### **Security Headers**

- Comprehensive CSP policies
- XSS protection
- Frame options
- Content type protection
- Environment-aware configuration

#### **Rate Limiting**

- IP-based rate limiting
- Configurable windows and limits
- Test environment aware
- Detailed headers and error responses

#### **Metrics Collection**

- Request/response time tracking
- Success/error rate monitoring
- Memory usage optimization
- Prometheus-compatible export

---

## 🛣️ Route Factories

### **Modern Route Creation System**

Our route factory system eliminates boilerplate and ensures consistency:

```typescript
// Simple routes
export const healthRoute = createSimpleRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check endpoint',
  handler: async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
});

// List routes with pagination
export const userListRoute = createListRoute({
  path: '/users',
  summary: 'List users with pagination',
  requestQuery: PaginationSchema,
  responseSchema: UserListResponseSchema,
  handler: async (ctx, params, query) => {
    // Implementation with automatic pagination
  }
});

// Full CRUD routes
export const userCrudRoute = createCRUDRoute({
  path: '/users/{id}',
  entityName: 'User',
  requestParams: UserParamsSchema,
  requestBody: CreateUserSchema,
  responseSchema: UserResponseSchema,
  handlers: {
    get: getUserHandler,
    post: createUserHandler,
    put: updateUserHandler,
    delete: deleteUserHandler
  }
});
```

See [Route Factory Documentation](./ROUTE_FACTORY_SYSTEM.md) for complete details.

---

## 🔐 Authentication & Authorization

### **Actor System**

Every request has an actor (authenticated user or guest):

```typescript
// Automatic in all routes
const actor = c.get('actor');

if (actor.type === 'USER') {
  // Authenticated user with full data
  console.log(`User: ${actor.user.email}`);
} else {
  // Guest user with limited access
  console.log('Guest user');
}
```

See [Actor System Documentation](./ACTOR_SYSTEM.md) for complete guide.

---

## 📊 Response Format

### **Standardized API Responses**

All endpoints return consistent response format:

```typescript
// Success response
{
  success: true,
  data: { /* response data */ },
  metadata: {
    timestamp: "2024-01-01T00:00:00.000Z",
    requestId: "req_12345"
  }
}

// Error response
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details: [/* detailed error info */]
  },
  metadata: {
    timestamp: "2024-01-01T00:00:00.000Z",
    requestId: "req_12345"
  }
}
```

---

## ✅ Validation System

### **Zod-Powered Validation**

- Comprehensive input validation
- Type-safe schema definitions
- User-friendly error messages
- Automatic error transformation

```typescript
// Schema definition
export const CreateUserSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.number().min(18, "Must be 18 or older")
});

// Automatic validation in routes
// Invalid input produces detailed, user-friendly errors
```

See [Zod Error Transformer Documentation](./ZOD_ERROR_SYSTEM.md) for details.

---

## 🔄 Error Handling

### **Comprehensive Error Management**

- Global error handler
- Consistent error formatting
- Environment-aware error details
- Request tracking integration

---

## 📊 Metrics & Monitoring

### **Advanced Metrics System**

- Request/response time tracking
- Success/error rate monitoring
- Memory usage optimization
- P95/P99 percentile calculations
- Prometheus-compatible export
- Automatic cleanup and memory management

---

## 🧪 Testing Strategy

### **Comprehensive Test Coverage**

- Unit tests for all utilities
- Middleware integration tests
- End-to-end API tests
- Performance and stress tests
- Security vulnerability tests

---

## 📖 API Documentation

### **OpenAPI/Swagger Integration**

- Automatic API documentation generation
- Interactive API explorer
- Type-safe schema definitions
- Real-time documentation updates

---

## 📚 Additional Documentation

For detailed information on specific topics, see:

- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Complete env configuration
- [Actor System](./ACTOR_SYSTEM.md) - Authentication & user management
- [Route Factory System](./ROUTE_FACTORY_SYSTEM.md) - Modern route creation
- [Security Configuration](./SECURITY_CONFIG.md) - Security policies
- [Performance Monitoring](./METRICS_SYSTEM.md) - Metrics & monitoring
- [Error Handling](./ERROR_HANDLING.md) - Error management system
- [Testing Guide](./TESTING_GUIDE.md) - Testing strategies & examples
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment

---

## 🚀 Quick Start

1. **Install dependencies**: `pnpm install`
2. **Setup environment**: Copy `.env.example` to `.env`
3. **Start development**: `pnpm dev`
4. **Run tests**: `pnpm test`
5. **Build for production**: `pnpm build`

---

*This documentation is kept up-to-date with the latest codebase changes. Last updated: 2024-12-19*
