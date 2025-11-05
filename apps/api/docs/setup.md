# Setup Guide

Complete guide to setting up the Hospeda API locally for development.

---

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** - v20.x or higher ([Download](https://nodejs.org/))
- **pnpm** - v8.x or higher (`npm install -g pnpm`)
- **PostgreSQL** - v14 or higher ([Download](https://www.postgresql.org/download/))
- **Git** - For cloning the repository

**Optional:**

- **Drizzle Studio** - Installed via pnpm (for database management)
- **Docker** - If using Docker for PostgreSQL

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/hospeda/hospeda.git
cd hospeda
```

### 2. Install Dependencies

From the project root:

```bash
pnpm install
```

This will install dependencies for all apps and packages in the monorepo.

---

## Database Setup

### Option A: Local PostgreSQL

#### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hospeda_dev;

# Create user (optional)
CREATE USER hospeda_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE hospeda_dev TO hospeda_user;
```

#### 2. Set DATABASE_URL

Create `.env` file in project root:

```env
DATABASE_URL=postgresql://hospeda_user:your_password@localhost:5432/hospeda_dev
```

### Option B: Docker PostgreSQL

```bash
# Start PostgreSQL container
docker run -d \
  --name hospeda-postgres \
  -e POSTGRES_DB=hospeda_dev \
  -e POSTGRES_USER=hospeda_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:14

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://hospeda_user:your_password@localhost:5432/hospeda_dev
```

### Option C: Neon (Cloud PostgreSQL)

1. Create account at [Neon](https://neon.tech)
2. Create new project
3. Copy connection string to `.env`:

```env
DATABASE_URL=postgresql://user:password@your-project.neon.tech/neondb?sslmode=require
```

### 3. Run Migrations

From project root:

```bash
# Fresh database setup (migrate + seed)
pnpm db:fresh

# Or migrate only
pnpm db:migrate
```

---

## Environment Variables

Create `.env` file in the **project root** (not in `apps/api/`):

```env
# Server Configuration
API_PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda_dev

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# CORS (comma-separated origins)
CORS_ORIGIN=http://localhost:4321,http://localhost:3000

# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging (optional)
LOG_LEVEL=debug
```

### Getting Clerk Keys

1. Create account at [Clerk](https://clerk.com)
2. Create new application
3. Go to **API Keys** section
4. Copy:
   - **Publishable Key** → `CLERK_PUBLISHABLE_KEY`
   - **Secret Key** → `CLERK_SECRET_KEY`
5. For webhooks (optional):
   - Go to **Webhooks** section
   - Create endpoint (e.g., `http://localhost:3001/webhooks/clerk`)
   - Copy signing secret → `CLERK_WEBHOOK_SECRET`

---

## Running the API

### Development Mode

From project root:

```bash
# Start API only
pnpm dev --filter=api

# Or from apps/api directory
cd apps/api
pnpm dev
```

The API will start at `http://localhost:3001`

### Development with Hot Reload

The dev server automatically restarts when code changes:

- **Routes** - Automatic reload
- **Middleware** - Automatic reload
- **Services** - Automatic reload
- **Schemas** - Requires restart (package dependency)

### Running All Apps

To start all apps simultaneously:

```bash
pnpm dev
```

This starts:

- API at `http://localhost:3001`
- Web at `http://localhost:4321`
- Admin at `http://localhost:3000`

---

## Verifying Setup

### 1. Health Check

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-11-04T12:00:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0"
}
```

### 2. OpenAPI Documentation

Visit: <http://localhost:3001/docs>

You should see:

- API Documentation index
- Links to Swagger UI and Scalar reference

### 3. Test Endpoint

```bash
# List accommodations (public endpoint)
curl http://localhost:3001/api/v1/accommodations
```

Expected response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

---

## Database Management

### Drizzle Studio

Visual database management tool:

```bash
# Open Drizzle Studio
pnpm db:studio
```

Visit: <http://localhost:4983>

### Common Database Commands

From project root:

```bash
# Reset database (drop all tables)
pnpm db:drop

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Fresh setup (drop + migrate + seed)
pnpm db:fresh

# Generate migration from schema changes
pnpm db:generate
```

---

## Development Tools

### TypeScript Type Checking

```bash
cd apps/api && pnpm typecheck
```

### Linting

```bash
cd apps/api && pnpm lint
```

### Code Formatting

```bash
cd apps/api && pnpm format
```

### Testing

```bash
# Run all tests
cd apps/api && pnpm test

# Watch mode
cd apps/api && pnpm test:watch

# Coverage report
cd apps/api && pnpm test:coverage
```

---

## Troubleshooting

### Port Already in Use

If port 3001 is already in use:

1. Find process using the port:

   ```bash
   # Linux/Mac
   lsof -i :3001

   # Windows
   netstat -ano | findstr :3001
   ```

2. Kill the process or change `API_PORT` in `.env`

### Database Connection Errors

**Error:** `Connection refused`

- Check PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `.env`
- Check PostgreSQL logs

**Error:** `Password authentication failed`

- Verify username and password in `DATABASE_URL`
- Check `pg_hba.conf` for connection permissions

### Clerk Authentication Errors

**Error:** `Invalid publishable key`

- Verify `CLERK_PUBLISHABLE_KEY` is correct
- Ensure key starts with `pk_test_` (dev) or `pk_live_` (production)

**Error:** `Clerk session not found`

- Make sure Clerk middleware is configured
- Check frontend is sending auth token

### Migration Errors

**Error:** `Database schema out of sync`

```bash
# Reset and re-migrate
pnpm db:fresh
```

**Error:** `Migration already applied`

- Check `drizzle/__meta__` folder
- Remove duplicate migration files

---

## Next Steps

Now that your API is running:

1. **Read Architecture** - [architecture.md](architecture.md)
2. **Create First Endpoint** - [Creating Endpoints](development/creating-endpoints.md)
3. **Understand Middleware** - [Middleware System](development/middleware.md)
4. **Learn Testing** - [Testing Guide](development/testing.md)

---

## Need Help?

- 📖 [Troubleshooting Guide](development/debugging.md)
- 💬 [GitHub Discussions](https://github.com/hospeda/discussions)
- 🐛 [Report Bug](https://github.com/hospeda/issues)

---

⬅️ Back to [API Documentation](README.md)
