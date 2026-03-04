# Debugging Guide

## Overview

This guide covers general debugging techniques and troubleshooting for development in the Hospeda project. For production incidents and operational debugging, see [Production Bug Investigation Runbook](../runbooks/production-bugs.md).

**When to Use**:

- Development issues (local environment)
- Understanding error messages
- Tracing request flow through layers
- Investigating test failures
- Learning how to debug effectively

**Not Covered Here**:

- Production debugging (see [Production Runbook](../runbooks/production-bugs.md))
- Performance profiling (see [Performance Guide](../performance/README.md))
- Security debugging (see [Security Guide](../security/README.md))

## Quick Start

### Common Debugging Scenarios

| Scenario | Quick Solution | Section |
|----------|----------------|---------|
| "Cannot read property of undefined" | Add null checks, use optional chaining | [Common Issues](#cannot-read-property-of-undefined) |
| API returns 500 error | Check API logs, verify database connection | [API Debugging](#debugging-api-routes) |
| Type error in TypeScript | Check type definitions, verify imports | [Type Errors](#type-errors) |
| Database query fails | Check Drizzle query syntax, verify schema | [Database Debugging](#debugging-database-queries) |
| Test failing | Check test setup, verify mocks | [Test Debugging](#debugging-tests) |
| Authentication not working | Verify Better Auth configuration, check session | [Auth Debugging](#debugging-authentication) |
| React component not rendering | Check props, verify data fetching | [Frontend Debugging](#debugging-react-components) |

## Debugging Tools

### VS Code Debugger

**Setup for API (Hono)**:

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/apps/api",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Service Tests",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/packages/service-core",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test", "--run", "${file}"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug DB Tests",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/packages/db",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test", "--run", "${file}"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

**Using Breakpoints**:

1. Click in gutter next to line number (red dot appears)
2. Start debugger (F5 or Debug → Start Debugging)
3. Code pauses at breakpoint
4. Use debug controls:
   - Continue (F5)
   - Step Over (F10)
   - Step Into (F11)
   - Step Out (Shift+F11)

**Debug Panel**:

- **Variables**: Inspect current scope variables
- **Watch**: Add expressions to watch
- **Call Stack**: See function call hierarchy
- **Breakpoints**: Manage all breakpoints

**Conditional Breakpoints**:

Right-click breakpoint → Edit Breakpoint → Add condition:

```javascript
userId === 'specific-user-id'
```

### Chrome DevTools (React)

**Opening DevTools**:

- Windows/Linux: F12 or Ctrl+Shift+I
- Mac: Cmd+Option+I

**Console Tab**:

```javascript
// Log variables
console.log('User:', user);

// Log objects with structure
console.dir(user);

// Group related logs
console.group('Booking Process');
console.log('Step 1: Validate');
console.log('Step 2: Create');
console.groupEnd();

// Log timing
console.time('fetch-accommodations');
await fetchAccommodations();
console.timeEnd('fetch-accommodations');

// Conditional logging
console.assert(user !== null, 'User should not be null');
```

**Sources Tab** (Breakpoints):

1. Open Sources tab
2. Find file in left panel
3. Click line number to add breakpoint
4. Refresh page or trigger action
5. Debugger pauses at breakpoint

**React DevTools**:

Install: [React DevTools Extension](https://react.dev/learn/react-developer-tools)

Features:

- Inspect component tree
- View props and state
- Profile component renders
- Debug hooks

### Network Tab

**Using Network Tab**:

1. Open DevTools → Network tab
2. Reload page or trigger action
3. Click request to see details

**Key Information**:

- **Status**: HTTP status code (200, 400, 500, etc.)
- **Method**: GET, POST, PUT, DELETE
- **Headers**: Request and response headers
- **Payload**: Request body (for POST/PUT)
- **Response**: Response body
- **Timing**: Request duration

**Common Issues**:

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| 200 | OK | Success |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Wrong endpoint or resource doesn't exist |
| 500 | Server Error | Unhandled exception in API |

**Filter Requests**:

- Click filter icon
- Filter by: All, XHR, JS, CSS, Img, Media, Font, Doc, WS
- Use search box to find specific requests

### PostgreSQL Query Debugging

**Using Drizzle Studio**:

```bash
# Start Drizzle Studio
cd packages/db
pnpm db:studio
```

Opens in browser: <http://localhost:4983>

Features:

- Browse all tables
- View table data
- Run custom queries
- Edit records (development only!)

**Using psql (CLI)**:

```bash
# Connect to local database
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev

# Or directly if not using Docker
psql postgresql://hospeda_user:hospeda_password@localhost:5432/hospeda_dev
```

**Useful psql Commands**:

```sql
-- List all tables
\dt

-- Describe table structure
\d accommodations

-- List all schemas
\dn

-- List all databases
\l

-- Quit psql
\q

-- Enable query timing
\timing on

-- Show query execution time
SELECT * FROM accommodations WHERE city = 'Concepción del Uruguay';
```

**Query Performance Analysis**:

```sql
-- See query execution plan
EXPLAIN SELECT * FROM accommodations WHERE city = 'Concepción del Uruguay';

-- See query execution plan with actual timing
EXPLAIN ANALYZE SELECT * FROM accommodations WHERE city = 'Concepción del Uruguay';
```

**Look for**:

- **Seq Scan**: Sequential scan (slow for large tables)
- **Index Scan**: Using index (fast)
- **Cost**: Estimated cost (lower is better)
- **Rows**: Estimated rows returned

## Debugging by Layer

### Debugging Database Queries

#### Drizzle ORM Queries

**Enable Query Logging**:

```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';

export const db = drizzle(pool, {
  logger: true, // Enable query logging
});
```

Output:

```text
Query: SELECT "id", "name", "city" FROM "accommodations" WHERE "city" = $1
Params: ["Concepción del Uruguay"]
```

**Common Query Issues**:

#### Issue 1: Query Returns Null Unexpectedly

```typescript
// ❌ Problem: findOne returns null
const accommodation = await accommodationModel.findOne({ city: 'Concepción' });
console.log(accommodation); // null
```

#### Debug Null Query Results

1. Check exact value in database (case-sensitive!)
2. Check for extra whitespace
3. Verify column name matches

```sql
-- Check actual values
SELECT city, length(city) FROM accommodations LIMIT 5;
```

#### Issue 2: Type Mismatch Error

```typescript
// ❌ Error: Type 'string' is not assignable to type 'UUID'
const accommodation = await accommodationModel.findById('123');
```

#### Solution: Use Valid UUID Format

```typescript
// ✅ Correct
const accommodation = await accommodationModel.findById('550e8400-e29b-41d4-a716-446655440000');
```

#### Issue 3: Relation Not Loading

```typescript
// ❌ Problem: reviews is undefined
const accommodation = await accommodationModel.findById('acc-123');
console.log(accommodation.reviews); // undefined
```

#### Solution: Use `findWithRelations`

```typescript
// ✅ Correct
const accommodation = await accommodationModel.findWithRelations(
  { id: 'acc-123' },
  { reviews: true }
);
console.log(accommodation.reviews); // Array of reviews
```

#### Slow Query Debugging

#### Step 1: Identify Slow Query

Add timing logs:

```typescript
console.time('query-accommodations');
const accommodations = await accommodationModel.findAll({ city: 'Buenos Aires' });
console.timeEnd('query-accommodations');
// Output: query-accommodations: 1542ms
```

#### Step 2: Analyze Query Plan

```sql
EXPLAIN ANALYZE
SELECT * FROM accommodations WHERE city = 'Buenos Aires';
```

#### Step 3: Check for Missing Index

```sql
-- If you see "Seq Scan" on large table, add index
CREATE INDEX idx_accommodations_city ON accommodations(city);
```

#### Step 4: Verify Improvement

```typescript
console.time('query-accommodations');
const accommodations = await accommodationModel.findAll({ city: 'Buenos Aires' });
console.timeEnd('query-accommodations');
// Output: query-accommodations: 45ms (much better!)
```

#### Connection Issues

#### Error: Connection Terminated Unexpectedly

```typescript
// Check connection
import { getDb } from '@repo/db';

try {
  const db = getDb();
  await db.execute(sql`SELECT 1`);
  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Database connection failed:', error);
}
```

**Common causes**:

1. Database not running (Docker container stopped)
2. Wrong connection string
3. Connection pool exhausted

**Solutions**:

```bash
# Check if database container is running
docker ps | grep postgres

# Restart database
docker compose restart postgres

# Check connection string
echo $HOSPEDA_DATABASE_URL
```

### Debugging Services

Services contain business logic and orchestrate models.

**Common Service Issues**:

#### Issue 1: Validation Error

```typescript
// Error: Validation failed
const result = await accommodationService.create({
  name: 'Hotel Paradise',
  // Missing required fields
});
```

#### Debug Validation Errors

1. Check Zod schema requirements
2. Log input data before validation

```typescript
import { createAccommodationSchema } from '@repo/schemas';

// Validate manually to see specific errors
try {
  createAccommodationSchema.parse(inputData);
} catch (error) {
  console.error('Validation errors:', error.errors);
}
```

#### Issue 2: Service Returns Error Result

```typescript
const result = await accommodationService.create(data);

if (!result.success) {
  console.error('Service error:', result.error);
  // Check result.error for details
}
```

#### Debug Service Error Results

```typescript
// Add detailed logging in service
export class AccommodationService extends BaseCrudService {
  async create(data: CreateAccommodationInput) {
    console.log('Creating accommodation with data:', data);

    try {
      const result = await super.create(data);
      console.log('Created accommodation:', result);
      return result;
    } catch (error) {
      console.error('Error creating accommodation:', error);
      throw error;
    }
  }
}
```

#### Issue 3: Transaction Rollback

```typescript
// Error: Transaction was rolled back
await db.transaction(async (trx) => {
  const accommodation = await trx.insert(accommodationTable).values(data);
  throw new Error('Something went wrong'); // Transaction rolled back
});
```

#### Debug Transaction Rollbacks

```typescript
// Add try-catch to see where error occurs
await db.transaction(async (trx) => {
  try {
    console.log('Step 1: Creating accommodation');
    const accommodation = await trx.insert(accommodationTable).values(data);

    console.log('Step 2: Creating amenities');
    const amenities = await trx.insert(amenityTable).values(amenitiesData);

    console.log('Step 3: Committing transaction');
  } catch (error) {
    console.error('Transaction failed at:', error);
    throw error; // Re-throw to rollback
  }
});
```

### Debugging API Routes

API routes handle HTTP requests and responses.

**Enable API Logging**:

```typescript
// apps/api/src/index.ts
import { logger } from 'hono/logger';

app.use('*', logger());
```

**Common API Issues**:

#### Issue 1: 500 Internal Server Error

#### Debug 500 Errors

```bash
# Check API logs
cd apps/api
pnpm dev

# Look for error stack trace in console
```

**Add error logging**:

```typescript
// apps/api/src/middleware/error-handler.ts
app.onError((err, c) => {
  console.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message,
    },
  }, 500);
});
```

#### Issue 2: 400 Bad Request (Validation Error)

```bash
# Test endpoint with curl
curl -X POST http://localhost:3000/api/accommodations \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

**Response**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "description": "Required field missing"
    }
  }
}
```

#### Debug: Check Request Body Matches Schema

```typescript
import { createAccommodationSchema } from '@repo/schemas';

// Test schema validation
const testData = { name: 'Test' };
const result = createAccommodationSchema.safeParse(testData);

if (!result.success) {
  console.log('Validation errors:', result.error.errors);
}
```

#### Issue 3: 401 Unauthorized

#### Debug Authentication

```typescript
// Check if auth middleware is extracting user
app.get('/api/profile', authMiddleware(), async (c) => {
  const user = c.get('user');
  console.log('User from auth:', user);

  if (!user) {
    return c.json({ error: 'User not found in context' }, 401);
  }

  return c.json({ user });
});
```

**Test with curl**:

```bash
# Get session cookie from browser or login flow
# Test endpoint with session cookie
curl http://localhost:3001/api/v1/protected/profile \
  -b "better-auth.session_token=your-session-token"
```

#### Issue 4: CORS Error

```text
Access to fetch at 'http://localhost:3000/api/accommodations' from origin
'http://localhost:4321' has been blocked by CORS policy
```

#### Solution: Configure CORS Middleware

```typescript
// apps/api/src/index.ts
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: ['http://localhost:4321', 'http://localhost:4322'],
  credentials: true,
}));
```

### Debugging React Components

#### Issue 1: Component Not Rendering

#### Debug Component Rendering

```tsx
export function AccommodationCard({ accommodation }: Props) {
  console.log('AccommodationCard render:', accommodation);

  // Check if data is available
  if (!accommodation) {
    console.warn('No accommodation data');
    return <div>No data</div>;
  }

  return (
    <div>
      <h2>{accommodation.name}</h2>
    </div>
  );
}
```

#### Issue 2: Props Not Passing Correctly

#### Debug Parent Component

```tsx
export function AccommodationList() {
  const accommodations = useAccommodations();

  console.log('AccommodationList data:', accommodations);

  return (
    <div>
      {accommodations.map((acc) => {
        console.log('Rendering card for:', acc.id);
        return <AccommodationCard key={acc.id} accommodation={acc} />;
      })}
    </div>
  );
}
```

#### Issue 3: useEffect Not Triggering

#### Debug useEffect Dependencies

```tsx
useEffect(() => {
  console.log('useEffect triggered');
  console.log('Dependencies:', [userId, accommodationId]);

  fetchData();
}, [userId, accommodationId]);
```

**Common cause**: Missing dependencies

```tsx
// ❌ Missing dependency
useEffect(() => {
  fetchAccommodations(city); // city not in dependency array
}, []);

// ✅ Correct
useEffect(() => {
  fetchAccommodations(city);
}, [city]);
```

#### Issue 4: State Not Updating

#### Debug Async State Updates

```tsx
const [count, setCount] = useState(0);

function increment() {
  console.log('Before:', count);
  setCount(count + 1);
  console.log('After:', count); // Still old value (state updates are async)
}

// ✅ Use callback to see updated value
function increment() {
  setCount((prev) => {
    console.log('Updating from', prev, 'to', prev + 1);
    return prev + 1;
  });
}
```

### Debugging TanStack Query

**Enable Query DevTools**:

```tsx
// apps/web/src/pages/_app.tsx (or layout)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  {children}
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

**Common Issues**:

#### Issue 1: Query Not Fetching

#### Debug Query State

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['accommodations'],
  queryFn: fetchAccommodations,
  enabled: true, // Check if query is enabled
});

console.log('Query state:', { data, isLoading, error });
```

#### Issue 2: Query Not Refetching

#### Debug Stale Time

```typescript
const { data } = useQuery({
  queryKey: ['accommodations'],
  queryFn: fetchAccommodations,
  staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
});

// Force refetch
const { refetch } = useQuery(...);
refetch();
```

#### Issue 3: Mutation Not Updating Cache

#### Debug Cache Invalidation

```typescript
const mutation = useMutation({
  mutationFn: createAccommodation,
  onSuccess: (data) => {
    console.log('Mutation success:', data);

    // Invalidate query to refetch
    queryClient.invalidateQueries({ queryKey: ['accommodations'] });
  },
  onError: (error) => {
    console.error('Mutation error:', error);
  },
});
```

### Debugging Authentication

#### Issue 1: User Not Authenticated

#### Debug Auth State

```tsx
import { useUser } from '@repo/auth-ui';

export function Profile() {
  const { isLoaded, isSignedIn, user } = useUser();

  console.log('Auth state:', { isLoaded, isSignedIn, user });

  if (!isLoaded) {
    return <div>Loading auth...</div>;
  }

  if (!isSignedIn) {
    return <div>Not signed in</div>;
  }

  return <div>Welcome, {user.firstName}</div>;
}
```

#### Issue 2: JWT Token Not Sent

#### Debug API Request

```typescript
// Check if Authorization header is included
fetch('http://localhost:3000/api/bookings', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
  .then((res) => {
    console.log('Response status:', res.status);
    return res.json();
  })
  .then((data) => console.log('Response data:', data));
```

#### Issue 3: Better Auth Environment Mismatch

#### Debug Environment Configuration

```bash
# Check environment variables
echo $HOSPEDA_BETTER_AUTH_SECRET
echo $HOSPEDA_BETTER_AUTH_URL

# Verify they match environment (dev/staging/prod)
```

**Common cause**: Using development config in production or vice versa

### Debugging Tests

**Run Single Test**:

```bash
# Run specific test file
cd packages/service-core
pnpm test accommodation.service.test.ts

# Run specific test by name
pnpm test -t "should create accommodation"
```

**Enable Verbose Output**:

```bash
pnpm test --reporter=verbose
```

**Common Test Issues**:

#### Issue 1: Test Timeout

```typescript
// ❌ Test times out
it('should fetch accommodations', async () => {
  const result = await accommodationService.findAll();
  expect(result).toBeDefined();
});
```

#### Solution: Increase Timeout or Fix Slow Operation

```typescript
// ✅ Increase timeout
it('should fetch accommodations', async () => {
  const result = await accommodationService.findAll();
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

#### Issue 2: Mock Not Working

#### Debug Mock Calls

```typescript
import { vi } from 'vitest';

// Check if mock is called
const mockFn = vi.fn();

it('should call mock function', () => {
  mockFn('test');

  console.log('Mock calls:', mockFn.mock.calls);
  console.log('Mock results:', mockFn.mock.results);

  expect(mockFn).toHaveBeenCalledWith('test');
});
```

#### Issue 3: Database Test Pollution

#### Solution: Reset Database Between Tests

```typescript
import { beforeEach } from 'vitest';

beforeEach(async () => {
  // Clear all tables
  await db.delete(accommodationTable);
  await db.delete(reviewTable);
  // ... other tables
});
```

**Or use transactions (rollback after each test)**:

```typescript
import { beforeEach, afterEach } from 'vitest';

let trx;

beforeEach(async () => {
  trx = await db.transaction();
});

afterEach(async () => {
  await trx.rollback();
});

it('should create accommodation', async () => {
  // Use trx instead of db
  const result = await trx.insert(accommodationTable).values(data);
  expect(result).toBeDefined();
});
```

## Common Issues

### Cannot Read Property of Undefined

**Error**:

```text
TypeError: Cannot read property 'name' of undefined
  at getAccommodationName (accommodation.service.ts:45)
```

**Common Causes**:

1. Variable is actually undefined
2. Async function not awaited
3. Optional chaining not used
4. Null not checked

**Solutions**:

#### Solution 1: Check for Null/Undefined

```typescript
// ❌ Bad
function getAccommodationName(accommodation) {
  return accommodation.name; // Crashes if accommodation is undefined
}

// ✅ Good
function getAccommodationName(accommodation) {
  if (!accommodation) {
    return 'Unknown';
  }
  return accommodation.name;
}
```

#### Solution 2: Use Optional Chaining

```typescript
// ❌ Bad
const city = accommodation.address.city;

// ✅ Good
const city = accommodation?.address?.city ?? 'Unknown';
```

#### Solution 3: Await Async Functions

```typescript
// ❌ Bad
const accommodation = accommodationModel.findById(id); // Returns Promise
console.log(accommodation.name); // undefined

// ✅ Good
const accommodation = await accommodationModel.findById(id);
console.log(accommodation.name);
```

#### Solution 4: Use Nullish Coalescing

```typescript
// ❌ Bad
const name = accommodation.name || 'Default'; // Fails for empty string

// ✅ Good
const name = accommodation.name ?? 'Default';
```

### Type Errors

**Error**:

```text
Type 'string | undefined' is not assignable to type 'string'
```

**Solutions**:

#### Solution 1: Type Guard

```typescript
function processAccommodation(id: string | undefined) {
  if (!id) {
    throw new Error('ID is required');
  }

  // TypeScript knows id is string here
  return accommodationModel.findById(id);
}
```

#### Solution 2: Non-Null Assertion (Use Sparingly!)

```typescript
// Only if you're 100% sure value exists
const id = accommodationId!;
```

#### Solution 3: Type Narrowing

```typescript
type Accommodation = {
  id: string;
  name: string;
  description: string | null;
};

function getDescription(acc: Accommodation): string {
  // Type narrow null case
  if (acc.description === null) {
    return 'No description';
  }

  // TypeScript knows description is string here
  return acc.description.toUpperCase();
}
```

### CORS Issues

**Error (Browser Console)**:

```text
Access to fetch at 'http://localhost:3000/api/accommodations' from origin
'http://localhost:4321' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solution**:

Add CORS middleware in API:

```typescript
// apps/api/src/index.ts
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: [
    'http://localhost:4321',  // Web app
    'http://localhost:4322',  // Admin app
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

**For production**:

```typescript
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://hospeda.com', 'https://admin.hospeda.com']
  : ['http://localhost:4321', 'http://localhost:4322'];

app.use('*', cors({
  origin: allowedOrigins,
  credentials: true,
}));
```

### Database Connection Errors

**Error**:

```text
Error: Connection terminated unexpectedly
Error: Connection refused (postgresql)
Error: role "hospeda_user" does not exist
```

**Solutions**:

#### Solution 1: Check Database Is Running

```bash
# Check Docker containers
docker ps | grep postgres

# Start database if stopped
docker compose up -d postgres
```

#### Solution 2: Verify Connection String

```bash
# Check environment variable
echo $HOSPEDA_DATABASE_URL

# Should be format:
# postgresql://user:password@host:port/database
```

#### Solution 3: Test Connection

```bash
# Test connection with psql
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev

# If successful, you'll see:
# hospeda_dev=#
```

#### Solution 4: Reset Database

```bash
# Stop containers
docker compose down

# Remove volumes (WARNING: deletes data!)
docker compose down -v

# Start fresh
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

### Authentication Errors

**Error**:

```text
401 Unauthorized
403 Forbidden
Error: JWT token invalid
```

**Solutions**:

#### Solution 1: Check Better Auth Configuration

```bash
# Verify environment variables are set
echo $HOSPEDA_BETTER_AUTH_SECRET
echo $HOSPEDA_BETTER_AUTH_URL

# Should not be empty
```

#### Solution 2: Check Database Sessions

1. Open Drizzle Studio: `pnpm db:studio`
2. Check the `sessions` table for the user's session
3. Verify session has not expired
4. Verify CORS origins include your app URL

#### Solution 3: Clear Session and Re-Login

```typescript
// Clear session cookie and redirect to sign-in
document.cookie = 'better-auth.session_token=; Max-Age=0; path=/';
window.location.href = '/auth/signin';
```

#### Solution 4: Check JWT in API

```typescript
// apps/api/src/middleware/auth.ts
export function authMiddleware() {
  return async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    console.log('JWT Token:', token ? 'Present' : 'Missing');

    if (!token) {
      return c.json({ error: 'Token missing' }, 401);
    }

    try {
      // Verify session with Better Auth
      const user = await verifyToken(token);
      console.log('User verified:', user.id);
      c.set('user', user);
      await next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return c.json({ error: 'Invalid token' }, 401);
    }
  };
}
```

## Debugging Patterns

### Strategic Console Logs

**Good logging pattern**:

```typescript
export class AccommodationService {
  async create(data: CreateAccommodationInput) {
    console.log('=== AccommodationService.create ===');
    console.log('Input:', JSON.stringify(data, null, 2));

    try {
      // Step 1: Validate
      console.log('Step 1: Validating input');
      const validated = createAccommodationSchema.parse(data);

      // Step 2: Create in database
      console.log('Step 2: Creating in database');
      const result = await this.model.create(validated);

      console.log('Step 3: Success', result.id);
      return { success: true, data: result };
    } catch (error) {
      console.error('Step failed:', error);
      return { success: false, error };
    }
  }
}
```

**Output**:

```text
=== AccommodationService.create ===
Input: {
  "name": "Hotel Paradise",
  "city": "Concepción del Uruguay"
}
Step 1: Validating input
Step 2: Creating in database
Step 3: Success 550e8400-e29b-41d4-a716-446655440000
```

### Using Debugger Breakpoints

#### Pattern 1: Pause Before Error

```typescript
async function processBooking(data) {
  // Add debugger statement before suspected issue
  debugger;

  const accommodation = await getAccommodation(data.accommodationId);
  const price = accommodation.price; // Error here if accommodation is null

  return calculateTotal(price, data.nights);
}
```

#### Pattern 2: Conditional Debugging

```typescript
async function processBooking(data) {
  if (data.accommodationId === 'problematic-id') {
    debugger; // Only pause for specific ID
  }

  // Continue processing
}
```

### Inspecting Network Requests

**Pattern**: Check request and response in Network tab

**Request**:

```text
POST http://localhost:3000/api/accommodations
Headers:
  Content-Type: application/json
  Authorization: Bearer eyJhbGc...
Payload:
  {"name":"Hotel Paradise","city":"Concepción del Uruguay"}
```

**Response**:

```text
Status: 400 Bad Request
Body:
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Description is required"
    }
  }
```

**Debug**: Add missing field

```typescript
const data = {
  name: 'Hotel Paradise',
  city: 'Concepción del Uruguay',
  description: 'A beautiful hotel', // Add missing field
};
```

### Checking Database Queries

**Pattern**: Log queries to verify correctness

```typescript
// Enable Drizzle logging
const db = drizzle(pool, {
  logger: {
    logQuery(query, params) {
      console.log('Query:', query);
      console.log('Params:', params);
    },
  },
});
```

**Output**:

```text
Query: SELECT * FROM accommodations WHERE city = $1
Params: ["Concepción del Uruguay"]
```

**Verify**:

1. Query syntax correct?
2. Parameters correct?
3. Table name correct?
4. Column names correct?

## Troubleshooting

### Step-by-Step Troubleshooting Workflow

#### Step 1: Reproduce the Issue

- Can you consistently reproduce it?
- What are the exact steps?
- Does it happen in all environments?

#### Step 2: Read the Error Message

- What is the error type?
- What line number?
- What is the stack trace?

#### Step 3: Isolate the Problem

- Remove complexity
- Test in isolation
- Use minimal reproduction

#### Step 4: Form a Hypothesis

- What do you think is causing it?
- Why do you think that?
- How can you test your hypothesis?

#### Step 5: Test Your Hypothesis

- Add logging
- Add breakpoints
- Test edge cases

#### Step 6: Fix and Verify

- Implement fix
- Test fix works
- Verify no regressions

#### Step 7: Document the Solution

- Update this guide if pattern is common
- Add comment in code if non-obvious
- Create test to prevent regression

### When to Ask for Help

**Ask for help if**:

- Stuck for > 30 minutes
- Don't understand error message
- Issue is blocking other work
- Issue affects production
- Security concern

**Before asking, gather**:

- Error message (full text)
- Stack trace
- Steps to reproduce
- What you've tried
- Environment details

**How to ask**:

```text
**Issue**: [Brief description]

**Error**:
```

[Error message and stack trace]

```text

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]
**Actual**: [What actually happens]

**Environment**:
- OS: [macOS/Linux/Windows]
- Node version: [version]
- Package: [which package]

**What I've Tried**:
- [Thing 1]
- [Thing 2]
- [Thing 3]

**Additional Context**: [Any other relevant info]
```

### Creating Minimal Reproduction

**Purpose**: Isolate issue to smallest possible code

**Steps**:

1. Start with failing code
2. Remove unrelated code
3. Remove dependencies not needed
4. Simplify data structures
5. Verify issue still occurs

**Example**:

Original (complex):

```typescript
// Complex code with many dependencies
const result = await accommodationService.create({
  name: 'Hotel Paradise',
  description: 'A beautiful hotel',
  address: {
    street: '123 Main St',
    city: 'Concepción del Uruguay',
    province: 'Entre Ríos',
    country: 'Argentina',
  },
  amenities: ['wifi', 'pool', 'parking'],
  images: ['img1.jpg', 'img2.jpg'],
  pricing: {
    basePrice: 100,
    weekendSurcharge: 1.2,
  },
});
```

Minimal reproduction:

```typescript
// Minimal code to reproduce issue
const result = await accommodationService.create({
  name: 'Test Hotel',
  description: 'Test description',
  city: 'Test City',
});
// Error occurs here too!
```

## Related Documentation

- [Production Bug Investigation](../runbooks/production-bugs.md) - Production debugging
- [Test-Informed Workflow](../testing/tdd-workflow.md) - Test-informed development
- [Testing Strategy](./testing-strategy.md) - Testing guidelines
- [Error Handling](./error-handling.md) - Error handling patterns
- [Architecture Overview](../architecture/README.md) - System architecture

## Checklist

### Before Debugging

- [ ] Read error message completely
- [ ] Identify which layer has the issue (DB/Service/API/Frontend)
- [ ] Check if issue is reproducible
- [ ] Verify environment is set up correctly

### During Debugging

- [ ] Add strategic console.logs
- [ ] Use breakpoints in VS Code or Chrome DevTools
- [ ] Check Network tab for API requests
- [ ] Verify database queries with Drizzle Studio or psql
- [ ] Test with minimal reproduction

### After Fixing

- [ ] Verify fix works
- [ ] Test edge cases
- [ ] Add test to prevent regression
- [ ] Remove debug logs
- [ ] Document if pattern is common

## Tips and Best Practices

1. **Read error messages carefully** - They usually tell you what's wrong
2. **Use TypeScript to catch errors early** - Many bugs are caught at compile time
3. **Test in isolation** - Simpler to debug one thing at a time
4. **Use the debugger** - More powerful than console.log
5. **Check the obvious first** - Is the server running? Is the database connected?
6. **Binary search debugging** - Comment out half the code to find the problem
7. **Read the docs** - Official documentation often has troubleshooting sections
8. **Search for error messages** - Someone has probably had the same issue
9. **Take breaks** - Fresh perspective helps
10. **Ask for help** - Don't waste hours being stuck

---

###### Last Updated: 2025-11-06

**Maintained By**: Tech Writer Agent
