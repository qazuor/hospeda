# Troubleshooting Guide

Systematic diagnosis and solutions for common problems in the Hospeda project.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Database Issues](#database-issues)
- [Build Issues](#build-issues)
- [Runtime Issues](#runtime-issues)
- [Test Issues](#test-issues)
- [Development Issues](#development-issues)

---

## Installation Issues

### PNPM Installation Fails

#### PNPM Installation Symptoms

- `pnpm install` command hangs or fails
- Error messages about network timeouts
- Missing packages after installation

#### PNPM Installation Diagnosis

```bash
# Check PNPM version
pnpm --version  # Should be 8.15.6 or higher

# Check Node version
node --version  # Should be 20.10.0 or higher

# Test network connectivity
pnpm ping registry
```

#### Test network Solution

```bash
# 1. Update PNPM to latest version
npm install -g pnpm@latest

# 2. Clear PNPM cache
pnpm store prune

# 3. Remove node_modules and lock file
rm -rf node_modules pnpm-lock.yaml

# 4. Reinstall
pnpm install

# 5. If still failing, try with verbose logging
pnpm install --verbose
```

#### 5. If Prevention

- Keep PNPM updated
- Use a stable internet connection
- Commit `pnpm-lock.yaml` to ensure consistent installs
- Don't mix npm/yarn/pnpm in the same project

---

### Node Version Mismatch

#### Node Version Symptoms

- Errors about unsupported Node version
- Syntax errors in node_modules
- Build failures with "unexpected token" errors

#### Node Version Diagnosis

```bash
# Check current Node version
node --version

# Check required version
cat .nvmrc  # Or package.json engines field
```

#### Check required Solution

```bash
# Option 1: Use nvm (recommended)
nvm install 20.10.0
nvm use 20.10.0

# Option 2: Download from nodejs.org
# Visit https://nodejs.org and download v20.10.0+

# Verify installation
node --version  # Should show 20.10.0 or higher

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

#### Reinstall dependencies Prevention

- Use nvm or fnm to manage Node versions
- Set up `.nvmrc` file (already present in project)
- Run `nvm use` before starting work
- Add Node version check to git hooks

---

### Dependency Conflicts

#### Dependency Conflicts Symptoms

- PNPM reports dependency conflicts
- Packages fail to install
- Different versions of same package in tree

#### Dependency Conflicts Diagnosis

```bash
# Check for duplicate packages
pnpm list <package-name>

# See why a package is installed
pnpm why <package-name>

# Check for peer dependency issues
pnpm install --verbose
```

#### Check for Solution

```bash
# 1. Update all dependencies to latest compatible versions
pnpm update --latest

# 2. If specific package conflicts, use overrides in package.json
{
  "pnpm": {
    "overrides": {
      "problematic-package": "^1.0.0"
    }
  }
}

# 3. Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm store prune
pnpm install

# 4. If still failing, check for incompatible versions
pnpm audit
```

#### 4. If Prevention

- Keep dependencies up to date regularly
- Use exact versions for critical packages
- Review `pnpm-lock.yaml` changes in PRs
- Run `pnpm audit` before committing

---

### Husky Hooks Not Working

#### Husky Hooks Symptoms

- Pre-commit hooks don't run
- Commits go through without linting
- Git hooks show "permission denied"

#### Husky Hooks Diagnosis

```bash
# Check if Husky is installed
ls -la .husky/

# Check hook permissions
ls -la .husky/pre-commit

# Test hook manually
./.husky/pre-commit
```

#### Test hook Solution

```bash
# 1. Reinstall Husky
pnpm install husky --save-dev

# 2. Initialize Husky
npx husky install

# 3. Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/post-commit

# 4. Verify hooks are working
git add .
git commit -m "test" --no-verify=false

# 5. If still not working, check git config
git config core.hooksPath
```

#### 5. If Prevention

- Run `npx husky install` after cloning repository
- Include hook setup in onboarding documentation
- Add hook installation to `postinstall` script
- Ensure hooks are executable in repository

---

## Database Issues

### Cannot Connect to Database

#### Cannot Connect Symptoms

- Error: "Connection refused"
- Error: "ECONNREFUSED 127.0.0.1:5432"
- Timeouts when accessing database

#### Cannot Connect Diagnosis

```bash
# Check if PostgreSQL is running
# For local installation:
pg_isready

# For Docker:
docker ps | grep postgres

# Test connection with psql
psql $DATABASE_URL

# Check port availability
lsof -i :5432
```

#### Check port Solution

```bash
# If using Docker:
# 1. Start PostgreSQL container
pnpm db:start

# 2. Wait for database to be ready
sleep 5

# 3. Test connection
pnpm db:studio

# If using local PostgreSQL:
# 1. Start PostgreSQL service
# On macOS:
brew services start postgresql@15

# On Linux:
sudo systemctl start postgresql

# 2. Create database if needed
createdb hospeda_dev

# 3. Update DATABASE_URL in .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda_dev

# 4. Test connection
pnpm db:migrate
```

#### 4. Test Prevention

- Use Docker for consistent local environment
- Document database setup steps
- Include health check in docker-compose
- Add database connection test to setup script

---

### Migration Fails

#### Migration Fails Symptoms

- `pnpm db:migrate` fails with SQL errors
- Foreign key constraint violations
- Column already exists errors

#### Migration Fails Diagnosis

```bash
# Check current migration status
pnpm db:studio
# Look at drizzle.__migrations table

# Review migration SQL
cat packages/db/migrations/[latest-migration]/migration.sql

# Check database schema
psql $DATABASE_URL -c "\d accommodations"
```

#### Check database Solution

```bash
# Option 1: Fix the migration
# 1. Review the failing migration SQL
cat packages/db/migrations/[migration-file]/migration.sql

# 2. Fix the schema definition
# Edit packages/db/src/schema/*.ts

# 3. Regenerate migration
pnpm db:generate

# 4. Apply again
pnpm db:migrate

# Option 2: Reset database (development only!)
pnpm db:fresh  # Drops, recreates, migrates, seeds

# Option 3: Manual fix in production
# 1. Connect to database
psql $DATABASE_URL

# 2. Fix manually
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS new_column TEXT;

# 3. Update migration history
INSERT INTO drizzle.__migrations (hash, created_at) VALUES ('hash', NOW());
```

#### 3. Update Prevention

- Test migrations in development first
- Review generated SQL before applying
- Use transactions in migrations
- Never edit applied migrations
- Keep migrations small and focused

---

### Data Not Appearing in Queries

#### Data Not Symptoms

- Queries return empty results
- Data exists in database but not in app
- Inconsistent data between Drizzle Studio and queries

#### Data Not Diagnosis

```bash
# Check data in Drizzle Studio
pnpm db:studio

# Test with raw SQL
psql $DATABASE_URL
SELECT * FROM accommodations;

# Enable query logging
DEBUG=drizzle:* pnpm dev

# Check for soft-deleted records
SELECT * FROM accommodations WHERE deleted_at IS NOT NULL;
```

#### Check for Solution

```typescript
// 1. Check for soft-delete filtering
// Make sure you're not excluding records unintentionally
const results = await db
  .select()
  .from(accommodations)
  .where(isNull(accommodations.deletedAt)); // Explicitly handle soft deletes

// 2. Verify query conditions
const results = await db
  .select()
  .from(accommodations)
  .where(eq(accommodations.city, 'Concepción')); // Check exact match

console.log(results.toSQL()); // Log the actual SQL

// 3. Check for timezone issues
const results = await db
  .select()
  .from(accommodations)
  .where(gte(accommodations.createdAt, new Date('2024-01-01T00:00:00Z')));

// 4. Verify relations are loaded
const results = await db.query.accommodations.findMany({
  with: {
    owner: true,
    reviews: true,
  },
});
```

#### Check for Prevention

- Always log queries during development
- Test queries in Drizzle Studio first
- Use explicit WHERE clauses
- Handle soft deletes consistently
- Use UTC for all timestamps

---

### Foreign Key Constraint Errors

#### Foreign Key Symptoms

- Error: "violates foreign key constraint"
- Cannot insert/update/delete records
- Database rollback errors

#### Foreign Key Diagnosis

```bash
# Check foreign key constraints
psql $DATABASE_URL
\d+ accommodations

# Find orphaned records
SELECT a.* FROM accommodations a
LEFT JOIN users u ON a.owner_id = u.id
WHERE u.id IS NULL;

# Check constraint definition
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND conrelid = 'accommodations'::regclass;
```

#### Check constraint Solution

```typescript
// 1. Ensure referenced record exists
const owner = await db.query.users.findFirst({
  where: eq(users.id, ownerId),
});

if (!owner) {
  throw new Error('Owner not found');
}

// 2. Use transactions to maintain consistency
await db.transaction(async (trx) => {
  const user = await trx.insert(users).values(userData).returning();
  await trx.insert(accommodations).values({
    ...accData,
    ownerId: user[0].id,
  });
});

// 3. Set null on delete if appropriate
// Update schema to use onDelete: 'set null' or 'cascade'
export const accommodations = pgTable('accommodations', {
  ownerId: uuid('owner_id').references(() => users.id, {
    onDelete: 'set null',
  }),
});

// 4. Clean up orphaned records
await db.delete(accommodations)
  .where(sql`owner_id NOT IN (SELECT id FROM users)`);
```

#### Check constraint Prevention

- Always validate foreign keys exist before insert
- Use transactions for related inserts
- Define appropriate `onDelete` behavior
- Add database-level constraints
- Test deletion workflows thoroughly

---

## Build Issues

### TypeScript Errors During Build

#### TypeScript Errors Symptoms

- `pnpm build` fails with type errors
- Errors about missing types or undefined properties
- "Cannot find module" errors

#### TypeScript Errors Diagnosis

```bash
# Run typecheck to see all errors
pnpm typecheck

# Check specific package
cd packages/db && pnpm run typecheck

# Verify tsconfig.json is correct
cat tsconfig.json

# Check for missing type declarations
pnpm list @types/*
```

#### Check for Solution

```bash
# 1. Build dependencies first
pnpm build --filter=@repo/schemas
pnpm build --filter=@repo/db

# 2. Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf .turbo

# 3. Rebuild everything
pnpm clean
pnpm install
pnpm build

# 4. Fix specific type errors
# Add missing type declarations
pnpm add -D @types/node @types/react

# 5. Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

#### Cmd/Ctrl + Prevention

- Run `pnpm typecheck` before committing
- Build packages in dependency order
- Keep type definitions up to date
- Use strict TypeScript settings
- Add typecheck to pre-commit hooks

---

### Biome Linting Errors

#### Biome Linting Symptoms

- `pnpm lint` fails
- Formatting inconsistencies
- Import order violations

#### Biome Linting Diagnosis

```bash
# Check linting errors
pnpm lint

# See what would be fixed
pnpm lint --write

# Check specific file
cd packages/db && pnpm run lint
```

#### Check specific Solution

```bash
# 1. Auto-fix most issues
pnpm lint --write

# 2. Fix manually if needed
# Open the file and fix reported issues

# 3. Update Biome config if rules are too strict
# Edit biome.json

# 4. Ignore specific files if needed
# Add to biome.json "ignore" section

# 5. Ensure consistent line endings
git config core.autocrlf input
```

#### 5. Ensure Prevention

- Set up Biome in VS Code for auto-format on save
- Run lint before committing
- Use pre-commit hooks
- Keep Biome config consistent across team
- Document style decisions

---

### Missing Environment Variables

#### Missing Environment Symptoms

- Build fails with "undefined environment variable"
- Runtime errors about missing config
- Authentication fails

#### Missing Environment Diagnosis

```bash
# Check .env.local exists
ls -la .env.local

# Verify required variables
cat .env.example

# Check if variables are loaded
node -e "console.log(process.env.DATABASE_URL)"

# Compare .env.example and .env.local
diff .env.example .env.local
```

#### Compare .env.example Solution

```bash
# 1. Copy example file
cp .env.example .env.local

# 2. Fill in required values
# Edit .env.local with your values:
# - DATABASE_URL
# - HOSPEDA_BETTER_AUTH_SECRET
# - HOSPEDA_BETTER_AUTH_URL
# - etc.

# 3. Verify variables are loaded
# Add to start of script:
require('dotenv').config({ path: '.env.local' });

# 4. For Vercel deployment
# Add environment variables in Vercel dashboard
# Project → Settings → Environment Variables
```

#### Project → Prevention

- Keep `.env.example` updated with all required variables
- Document where to get each value
- Add environment validation at app startup
- Never commit `.env.local` to git
- Use different .env files for different environments

---

## Runtime Issues

### API Returns 500 Error

#### API Returns Symptoms

- Server responds with 500 Internal Server Error
- Generic error message in response
- No specific error details

#### API Returns Diagnosis

```bash
# Check server logs
# Look at terminal where `pnpm dev` is running

# Enable debug logging
DEBUG=* pnpm dev

# Test API with curl
curl -v http://localhost:3000/api/accommodations

# Check request body is valid JSON
curl -X POST http://localhost:3000/api/accommodations \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

#### Check request Solution

```typescript
// 1. Add proper error handling in routes
app.post('/accommodations', async (c) => {
  try {
    const body = await c.req.json();
    const validated = schema.parse(body);
    const result = await service.create(ctx, validated);
    return c.json(result);
  } catch (error) {
    console.error('Error creating accommodation:', error);

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message },
      }, 400);
    }

    return c.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    }, 500);
  }
});

// 2. Add global error handler
app.onError((error, c) => {
  console.error('Unhandled error:', error);
  return c.json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: error.message },
  }, 500);
});

// 3. Log detailed error information
import { logger } from '@repo/logger';

logger.error('Failed to create accommodation', {
  error: error.message,
  stack: error.stack,
  body,
  user: ctx.actor.id,
});
```

#### Check request Prevention

- Add comprehensive error handling to all routes
- Use global error handlers
- Log errors with context
- Return appropriate HTTP status codes
- Validate input before processing

---

### Frontend Shows Blank Page

#### Frontend Shows Symptoms

- White screen in browser
- No errors in terminal
- React app doesn't render

#### Frontend Shows Diagnosis

```bash
# Check browser console for errors
# Open DevTools → Console

# Check network requests
# Open DevTools → Network

# Verify build completed
pnpm build

# Check server is running
curl http://localhost:4321
```

#### Check server Solution

```tsx
// 1. Add error boundary
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong</div>}
      onError={(error) => console.error(error)}
    >
      <YourApp />
    </ErrorBoundary>
  );
}

// 2. Check for JavaScript errors
// Open browser console and fix reported errors

// 3. Verify component is exported correctly
// Use named exports, not default exports
export function MyComponent() { ... }

// 4. Check for missing client directive (Astro)
// Add client:load or client:visible
<MyComponent client:load />

// 5. Clear browser cache
// Hard refresh: Cmd/Ctrl + Shift + R
```

#### Check server Prevention

- Use error boundaries in React apps
- Test in different browsers
- Add monitoring (Sentry, LogRocket)
- Use TypeScript to catch errors early
- Test builds before deploying

---

### Authentication Not Working

#### Authentication Not Symptoms

- Login fails silently
- User redirected to login repeatedly
- "Unauthorized" errors on protected routes

#### Authentication Not Diagnosis

```bash
# Check Better Auth env vars in .env.local
cat .env.local | grep BETTER_AUTH

# Check browser cookies for session cookie
# DevTools → Application → Cookies

# Check database sessions table
psql $DATABASE_URL -c "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5"
```

#### Better Auth Solution

```typescript
// 1. Verify Better Auth configuration
// Check .env.local has correct keys
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

// 2. Verify Better Auth middleware is configured
// The API uses Better Auth middleware for session validation

// 3. Protect routes properly
// In Astro pages, check Astro.locals.user
const user = Astro.locals.user;
if (!user) {
  return Astro.redirect(`/${locale}/auth/signin`);
}

// 4. Handle authentication errors
try {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error('Not authenticated');
} catch (error) {
  console.error('Auth error:', error);
  return Response.redirect('/login');
}

// 5. Check database sessions table for issues
// SELECT * FROM sessions WHERE user_id = 'xxx';
```

#### Better Auth Prevention

- Test authentication flow regularly
- Monitor session creation in database
- Add authentication tests
- Document authentication setup
- Verify HOSPEDA_BETTER_AUTH_SECRET matches across environments

---

### CORS Errors

#### CORS Errors Symptoms

- Browser console shows "CORS policy" error
- Requests fail from frontend to API
- Preflight OPTIONS requests fail

#### CORS Errors Diagnosis

```bash
# Check browser console
# Error will mention "CORS policy"

# Test with curl (no CORS)
curl -v http://localhost:3000/api/accommodations

# Check CORS headers in response
curl -H "Origin: http://localhost:4321" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://localhost:3000/api/accommodations
```

#### Check CORS Solution

```typescript
// 1. Add CORS middleware to API
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: ['http://localhost:4321', 'http://localhost:4322'],
  credentials: true,
}));

// 2. For production, use environment variable
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// 3. Ensure credentials are sent from client
fetch('http://localhost:3000/api/accommodations', {
  method: 'POST',
  credentials: 'include',  // Important!
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// 4. Handle preflight requests
app.options('*', (c) => c.text('', 204));
```

#### Check CORS Prevention

- Configure CORS in API from the start
- Use environment variables for allowed origins
- Test cross-origin requests early
- Document CORS configuration
- Use same-origin for development when possible

---

## Test Issues

### Tests Fail Locally

#### Tests Fail Symptoms

- `pnpm test` shows failing tests
- Tests that passed before now fail
- Intermittent test failures

#### Tests Fail Diagnosis

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test -- accommodation.test.ts

# Run tests in sequence (not parallel)
pnpm test --sequence

# Check for database state issues
pnpm db:fresh
pnpm test
```

#### Check for Solution

```typescript
// 1. Reset database before each test
import { beforeEach, afterEach } from 'vitest';

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await cleanupDatabase();
});

// 2. Use isolated test data
it('should create accommodation', async () => {
  const uniqueData = {
    title: `Test ${Date.now()}`,  // Unique per test
    city: 'Concepción',
  };

  const result = await service.create(ctx, uniqueData);
  expect(result.success).toBe(true);
});

// 3. Mock external dependencies
vi.mock('@repo/auth', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'test-user' }),
}));

// 4. Fix race conditions
await expect(async () => {
  const result = await service.create(ctx, data);
  expect(result.success).toBe(true);
}).resolves.not.toThrow();

// 5. Add proper cleanup
afterAll(async () => {
  await db.delete(accommodations).where(eq(accommodations.title, 'Test'));
  await db.$client.end();
});
```

#### Check for Prevention

- Write independent, isolated tests
- Use unique test data
- Clean up after tests
- Mock external services
- Run tests before committing

---

### Tests Pass Locally but Fail in CI

#### Tests Pass Symptoms

- Local tests pass
- GitHub Actions shows test failures
- Different behavior in CI environment

#### Tests Pass Diagnosis

```bash
# Check CI logs in GitHub Actions
# Look for differences in:
# - Node version
# - Environment variables
# - Database state
# - Timing issues

# Run tests in CI mode locally
CI=true pnpm test

# Check for race conditions
pnpm test --sequence --no-coverage
```

#### Check for Solution

```bash
# 1. Ensure consistent Node version
# Check .nvmrc matches CI workflow

# 2. Add required environment variables to CI
# In .github/workflows/test.yml:
env:
  DATABASE_URL: postgresql://localhost/test
  NODE_ENV: test

# 3. Set up database in CI
# In workflow:
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_DB: test
      POSTGRES_PASSWORD: test

# 4. Fix timing-dependent tests
// Don't rely on specific timing
it('should debounce input', async () => {
  await vi.waitFor(() => {
    expect(mockFn).toHaveBeenCalled();
  }, { timeout: 5000 });
});

# 5. Disable flaky tests temporarily
it.skip('flaky test', () => { ... });
// Fix and re-enable later
```

#### 5. Disable Prevention

- Test in CI-like environment locally
- Use Docker for consistent environments
- Avoid timing-dependent tests
- Mock time-sensitive operations
- Keep CI and local environments in sync

---

### Coverage Below 90%

#### Coverage Below Symptoms

- `pnpm test:coverage` shows < 90%
- CI fails on coverage check
- Uncovered lines in reports

#### Coverage Below Diagnosis

```bash
# Run coverage report
pnpm test:coverage

# See detailed HTML report
open coverage/index.html

# Check specific file coverage
pnpm test:coverage --reporter=text -- accommodation.service.test.ts
```

#### Check specific Solution

```typescript
// 1. Add tests for uncovered branches
it('should handle error case', async () => {
  const invalidData = { /* intentionally invalid */ };

  await expect(
    service.create(ctx, invalidData)
  ).rejects.toThrow();
});

// 2. Test edge cases
it('should handle empty array', async () => {
  const result = await service.findAll(ctx, {});
  expect(result.data).toEqual([]);
});

it('should handle null value', async () => {
  const result = await service.getById(ctx, null);
  expect(result.success).toBe(false);
});

// 3. Test all code paths
it('should use different logic for admin', async () => {
  const adminCtx = { ...ctx, actor: { ...ctx.actor, role: 'admin' } };
  const userCtx = { ...ctx, actor: { ...ctx.actor, role: 'user' } };

  const adminResult = await service.create(adminCtx, data);
  const userResult = await service.create(userCtx, data);

  expect(adminResult).not.toEqual(userResult);
});

// 4. Mock conditional dependencies
vi.mock('optional-dependency', () => {
  if (process.env.FEATURE_FLAG === 'true') {
    return { feature: vi.fn() };
  }
  return undefined;
});
```

#### Check specific Prevention

- Write tests alongside your code (test-informed development)
- Review coverage reports regularly
- Test all branches and edge cases
- Use coverage tools in CI
- Set coverage threshold in config

---

## Development Issues

### Hot Reload Not Working

#### Hot Reload Symptoms

- Changes not reflected in browser
- Need to restart server for changes to apply
- File watching not working

#### Hot Reload Diagnosis

```bash
# Check if dev server is running
ps aux | grep "pnpm dev"

# Check for file watcher limits (Linux)
cat /proc/sys/fs/inotify/max_user_watches

# Look for errors in terminal
# Check for syntax errors preventing reload
```

#### Check for Solution

```bash
# 1. Restart dev server
# Ctrl+C to stop
pnpm dev

# 2. Increase file watcher limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. Clear caches
rm -rf .astro
rm -rf .next
rm -rf dist

# 4. Check for syntax errors
pnpm typecheck
pnpm lint

# 5. Try hard refresh in browser
# Cmd/Ctrl + Shift + R
```

#### Cmd/Ctrl + Prevention

- Keep file watcher limits high enough
- Close unused files/projects
- Use `.gitignore` to exclude large directories
- Restart dev server periodically
- Keep dependencies updated

---

### Changes Not Reflecting

#### Changes Not Symptoms

- Code changes don't appear
- Old code still running
- Cache issues

#### Changes Not Diagnosis

```bash
# Check if files are saved
# Look for unsaved indicators in editor

# Check build output
ls -la dist/

# Verify correct file is imported
grep -r "import.*MyComponent" apps/
```

#### Verify correct Solution

```bash
# 1. Hard refresh browser
# Cmd/Ctrl + Shift + R

# 2. Clear all caches
rm -rf .astro .next .turbo dist node_modules/.cache

# 3. Rebuild
pnpm clean
pnpm build

# 4. Restart dev server
# Ctrl+C
pnpm dev

# 5. Check correct file is imported
// Verify import path
import { MyComponent } from '@components/MyComponent';

// 6. Clear browser cache
// DevTools → Network → Disable cache
```

#### 5. Check Prevention

- Save files before testing
- Use browser dev mode (disable cache)
- Verify import paths
- Clear caches regularly
- Use proper cache busting in production

---

### Port Already in Use

#### Port Already Symptoms

- Error: "EADDRINUSE: address already in use :3000"
- Cannot start dev server
- Port conflict

#### Port Already Diagnosis

```bash
# Find process using the port
# On macOS/Linux:
lsof -i :3000

# On Windows:
netstat -ano | findstr :3000

# Check all Node processes
ps aux | grep node
```

#### Check all Solution

```bash
# Option 1: Kill the process using the port
# On macOS/Linux:
lsof -i :3000  # Note the PID
kill -9 <PID>

# On Windows:
netstat -ano | findstr :3000  # Note the PID
taskkill /PID <PID> /F

# Option 2: Use a different port
# Edit package.json or .env:
PORT=3001 pnpm dev

# Option 3: Kill all Node processes (careful!)
killall node

# Option 4: Restart your computer
# Sometimes processes don't release ports properly
```

#### Sometimes processes Prevention

- Stop dev servers properly (Ctrl+C)
- Use different ports for different projects
- Add cleanup script to package.json
- Document which ports are used
- Close terminals properly

---

### File Watcher Issues

#### File Watcher Symptoms

- Changes detected but not applied
- Too many open files error
- File system watchers exhausted

#### File Watcher Diagnosis

```bash
# Check current limit (Linux)
cat /proc/sys/fs/inotify/max_user_watches

# Count watched files
find . -type f | wc -l

# Check for inotify errors in logs
dmesg | grep inotify
```

#### Check for Solution

```bash
# Increase watcher limit (Linux)
# Temporary:
sudo sysctl fs.inotify.max_user_watches=524288

# Permanent:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# macOS (no limit, but can be slow):
# Use polling instead of watching
# Add to vite.config.ts:
export default {
  server: {
    watch: {
      usePolling: true,
    },
  },
};

# Exclude large directories from watching
// vite.config.ts
export default {
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
};
```

#### Exclude large Prevention

- Keep projects in separate directories
- Exclude large directories from watching
- Close unused projects
- Use .gitignore to exclude build artifacts
- Increase system limits proactively

---

## Getting More Help

If these solutions don't resolve your issue:

1. **Check Logs**: Server, browser console, build output
2. **Search Documentation**: [FAQ](./faq.md), [Glossary](./glossary.md)
3. **Search Issues**: GitHub repository issues
4. **Ask Team**: Slack, Discord, or team chat
5. **Create Issue**: Document the problem with reproduction steps

## Contributing to This Guide

Found a solution to a problem not listed here? Please add it!

1. Follow the format: Symptoms → Diagnosis → Solution → Prevention
2. Include code examples where helpful
3. Test solutions before documenting
4. Commit with: `docs(troubleshooting): add solution for X`

---

Last updated: 2025-11-06
