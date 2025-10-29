# 🎭 Actor System Documentation

## Overview

The Hospeda API implements a universal actor system that automatically handles both authenticated users and guest users. Every route has access to an actor through the context, ensuring consistent service layer integration and eliminating authentication complexity.

## 🎯 Core Concept

**Every request = One Actor**

- **Authenticated User**: Full user data and permissions
- **Guest User**: Limited access with consistent interface

## 🏗️ How It Works

### 1. Universal Actor Middleware

The `actorMiddleware` runs on all routes and automatically:

- Detects if a user is authenticated via Clerk
- If authenticated: Fetches user data from database and creates authenticated actor
- If not authenticated: Creates a GUEST actor with safe defaults

```typescript
// src/middlewares/actor.ts
export const actorMiddleware = () => async (c: Context, next: Next) => {
  const auth = getAuth(c);
  
  if (auth?.sessionId && auth?.userId) {
    // Authenticated user
    const user = await getUserById(auth.userId);
    c.set('actor', createUserActor(user));
  } else {
    // Guest user
    c.set('actor', createGuestActor());
  }
  
  await next();
};
```

### 2. Actor Types

#### **User Actor** (Authenticated)

```typescript
{
  type: 'USER',
  isAuthenticated: true,
  user: {
    id: 'user_12345',
    email: 'user@example.com',
    name: 'John Doe',
    // ... complete user data
  },
  permissions: ['read', 'write', 'delete'],
  metadata: {
    sessionId: 'sess_12345',
    loginTime: '2024-01-01T00:00:00.000Z'
  }
}
```

#### **Guest Actor** (Unauthenticated)

```typescript
{
  type: 'GUEST',
  isAuthenticated: false,
  user: null,
  permissions: ['read'],
  metadata: {
    sessionId: null,
    requestId: 'req_12345'
  }
}
```

## 🛠️ Usage in Routes

### **Accessing the Actor**

```typescript
// In any route handler
export const getUserProfile = async (c: Context) => {
  const actor = c.get('actor');
  
  if (actor.type === 'USER') {
    // Authenticated user - full access
    return c.json({
      success: true,
      data: {
        profile: actor.user,
        permissions: actor.permissions
      }
    });
  } else {
    // Guest user - limited access
    return c.json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Please log in to access this resource'
      }
    }, 401);
  }
};
```

### **Type-Safe Actor Checks**

```typescript
// Type guards for safe access
const isAuthenticatedUser = (actor: Actor): actor is UserActor => {
  return actor.type === 'USER';
};

// Usage
if (isAuthenticatedUser(actor)) {
  // TypeScript knows actor.user is available
  console.log(actor.user.email);
}
```

## 🔧 Actor Factory Functions

### **createUserActor**

```typescript
export const createUserActor = (user: User): UserActor => ({
  type: 'USER',
  isAuthenticated: true,
  user,
  permissions: determineUserPermissions(user),
  metadata: {
    sessionId: user.currentSessionId,
    loginTime: new Date().toISOString()
  }
});
```

### **createGuestActor**

```typescript
export const createGuestActor = (): GuestActor => ({
  type: 'GUEST',
  isAuthenticated: false,
  user: null,
  permissions: ['read'], // Basic read permissions
  metadata: {
    sessionId: null,
    requestId: generateRequestId()
  }
});
```

## 🎨 Advanced Usage Patterns

### **Permission-Based Access Control**

```typescript
const requirePermission = (permission: Permission) => {
  return (actor: Actor): boolean => {
    return actor.permissions.includes(permission);
  };
};

// Usage in route
const actor = c.get('actor');
if (!requirePermission('write')(actor)) {
  return c.json({
    success: false,
    error: { code: 'INSUFFICIENT_PERMISSIONS' }
  }, 403);
}
```

### **Service Layer Integration**

```typescript
// Services always receive an actor
class UserService {
  async getProfile(actor: Actor, userId: string) {
    if (actor.type === 'GUEST') {
      throw new Error('Authentication required');
    }
    
    if (actor.user.id !== userId && !actor.permissions.includes('admin')) {
      throw new Error('Access denied');
    }
    
    return await this.userRepository.findById(userId);
  }
}
```

## 📊 Benefits

### **1. Consistency**

- Every route has the same actor interface
- No need to check authentication state manually
- Consistent error handling

### **2. Type Safety**

- Full TypeScript support
- Compile-time guarantees
- IDE autocomplete and refactoring

### **3. Flexibility**

- Easy to extend with new actor types
- Permission system can grow with requirements
- Backward compatible changes

### **4. Security**

- Centralized authentication logic
- No forgotten auth checks
- Audit trail built-in

## 🧪 Testing

### **Mock Actors for Testing**

```typescript
// Test utilities
export const createMockUserActor = (overrides?: Partial<User>): UserActor => {
  return createUserActor({
    id: 'test_user',
    email: 'test@example.com',
    name: 'Test User',
    ...overrides
  });
};

export const createMockGuestActor = (): GuestActor => {
  return createGuestActor();
};

// Usage in tests
describe('User Profile Route', () => {
  it('should return profile for authenticated user', async () => {
    const mockActor = createMockUserActor();
    const context = createMockContext({ actor: mockActor });
    
    const response = await getUserProfile(context);
    expect(response.status).toBe(200);
  });
});
```

## 📈 Performance Considerations

### **Caching Strategy**

- User data is fetched once per request
- Session validation is cached
- Database queries are optimized

### **Memory Management**

- Actors are created per request
- No persistent state between requests
- Automatic cleanup

## 🔮 Future Enhancements

### **Planned Features**

- Role-based permissions
- Organization-level actors
- Service-to-service actors
- Actor audit logging

### **Extension Points**

- Custom actor types
- Dynamic permission calculation
- Actor middleware chaining

---

## 📚 Related Documentation

- [Authentication Setup](./AUTH_SETUP.md) - Clerk integration
- [Route Factory System](./ROUTE_FACTORY_SYSTEM.md) - Using actors in routes
- [Security Configuration](./SECURITY_CONFIG.md) - Security policies
- [Testing Guide](./TESTING_GUIDE.md) - Testing with actors

---

*This actor system provides a robust foundation for authentication and authorization throughout the Hospeda API. Last updated: 2024-12-19*
