# Installation

This guide will walk you through cloning the repository, installing dependencies, configuring the environment, and running the development servers.

---

## Prerequisites

Before starting, make sure you've completed the [Prerequisites](prerequisites.md) guide and have all required tools installed.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/qazuor/hospeda.git
cd hospeda

# 2. Install dependencies
pnpm install

# 3. Copy environment file
cp .env.example .env.local

# 4. Set up database
pnpm db:fresh

# 5. Start development servers
pnpm dev
```

**That's it!** The application should now be running:

- API: <http://localhost:3000>
- Web: <http://localhost:4321>
- Admin: <http://localhost:3001>

---

## Detailed Installation Steps

### 1. Clone the Repository

#### Option A: HTTPS (Recommended for beginners)

```bash
git clone https://github.com/qazuor/hospeda.git
cd hospeda
```

#### Option B: SSH (Recommended for contributors)

```bash
git clone git@github.com:qazuor/hospeda.git
cd hospeda
```

#### Verify Clone

```bash
ls -la
# Should see: apps/ packages/ docs/ .claude/ etc.
```

---

### 2. Install Dependencies

Install all workspace dependencies using pnpm:

```bash
pnpm install
```

**What this does:**

- Installs dependencies for all apps and packages
- Links internal packages (`@repo/*`)
- Sets up git hooks with Husky
- Configures lint-staged

**Expected output:**

```text
Scope: all 15 workspace projects
Lockfile is up to date, resolution step is skipped
...
Done in Xs
```

**Troubleshooting:**

If you see errors:

```bash
# Clean install
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

### 3. Environment Configuration

#### Copy Environment Template

```bash
cp .env.example .env.local
```

#### Required Environment Variables

Edit `.env.local` and configure:

**Database (if using Docker - default):**

```env
# PostgreSQL
DATABASE_URL="postgresql://hospeda_user:hospeda_pass@localhost:5432/hospeda_dev"

# Redis
REDIS_URL="redis://localhost:6379"
```

**Database (if using Neon cloud):**

```env
DATABASE_URL="your-neon-connection-string"
REDIS_URL="your-redis-url"  # Or use Upstash
```

**Authentication (Clerk):**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
CLERK_SECRET_KEY="your-clerk-secret-key"
```

**Payments (Mercado Pago - optional for now):**

```env
MERCADOPAGO_ACCESS_TOKEN="your-mp-access-token"
MERCADOPAGO_PUBLIC_KEY="your-mp-public-key"
```

**API Configuration:**

```env
# API Server
API_PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS="http://localhost:4321,http://localhost:3001"
```

#### Verify Configuration

```bash
# Check if .env.local exists and has content
cat .env.local | grep DATABASE_URL
```

---

### 4. Database Setup

#### Option A: Docker (Recommended)

**Start Database Services:**

```bash
pnpm db:start
```

**Wait for services to be ready** (about 10 seconds), then:

```bash
# Generate schema, run migrations, and seed data
pnpm db:fresh
```

**What `db:fresh` does:**

1. Stops existing containers
2. Removes volumes (clean slate)
3. Starts PostgreSQL and Redis
4. Waits 10 seconds for services to be ready
5. Generates Drizzle migrations
6. Applies migrations to database
7. Seeds with required and example data

**Verify database is running:**

```bash
# Check containers
docker ps

# Should see:
# - hospeda_postgres (port 5432)
# - hospeda_redis (port 6379)
```

**View database logs:**

```bash
pnpm db:logs
```

#### Option B: Local PostgreSQL

If using local PostgreSQL instead of Docker:

1. Create database:

   ```bash
   createdb hospeda_dev
   ```

2. Update `.env.local` with your connection string

3. Run migrations and seeds:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

#### Option C: Neon Cloud

If using Neon cloud database:

1. Copy connection string from Neon dashboard
2. Update `DATABASE_URL` in `.env.local`
3. Run migrations and seeds:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

#### Verify Database Setup

```bash
# Open Drizzle Studio
pnpm db:studio
```

Open browser at: <http://localhost:4983>

You should see tables with data:

- `users` - Super admin user
- `amenities` - WiFi, Parking, etc.
- `accommodations` - Example properties
- And more...

---

### 5. Start Development Servers

#### Start All Services

```bash
pnpm dev
```

This starts:

- **API** (Hono): <http://localhost:3000>
- **Web** (Astro): <http://localhost:4321>
- **Admin** (TanStack Start): <http://localhost:3001>

#### Start Individual Services

Alternatively, you can start services individually:

```bash
# API only
pnpm dev --filter=api

# Web only
pnpm dev --filter=web

# Admin only
pnpm dev --filter=admin
```

#### Verify Services

**Check API:**

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}
```

**Check Web:**

Open browser: <http://localhost:4321>

**Check Admin:**

Open browser: <http://localhost:3001>

---

## Verification Checklist

After installation, verify everything works:

- [ ] Git repository cloned successfully
- [ ] Dependencies installed without errors
- [ ] `.env.local` file exists and configured
- [ ] Database containers running (if using Docker)
- [ ] Database has tables and seed data
- [ ] API responds to health check
- [ ] Web app loads in browser
- [ ] Admin app loads in browser
- [ ] No console errors in browser
- [ ] No errors in terminal

**All checked?** → Continue to [Development Environment](development-environment.md)

**Issues?** → See [Troubleshooting](#troubleshooting) below

---

## Daily Development Workflow

After initial installation, your daily workflow will be:

```bash
# 1. Start database (if using Docker)
pnpm db:start

# 2. Start development servers
pnpm dev

# 3. Work on your code...

# 4. Stop database when done
pnpm db:stop
```

---

## Troubleshooting

### Installation Issues

**Problem**: `pnpm: command not found`

**Solution**: Install pnpm first - see [Prerequisites](prerequisites.md#2-pnpm-9)

---

**Problem**: `pnpm install` fails with permission errors

**Solution**:

```bash
# Don't use sudo with pnpm
# Instead, fix npm permissions:
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

---

**Problem**: Husky hooks failing

**Solution**:

```bash
# Reinstall husky
rm -rf .husky
pnpm install
```

---

### Database Issues

**Problem**: `Connection refused` to PostgreSQL

**Solution**:

```bash
# Check if database is running
docker ps

# If not, start it
pnpm db:start

# Wait 10 seconds, then check logs
pnpm db:logs
```

---

**Problem**: Port 5432 already in use

**Solution**:

```bash
# Check what's using the port
sudo lsof -i :5432

# Stop local PostgreSQL service
sudo systemctl stop postgresql

# Or change port in docker-compose.yml and .env.local
```

---

**Problem**: Seeds fail with foreign key errors

**Solution**:

```bash
# Reset database completely
pnpm db:fresh

# If still failing, check .env.local DATABASE_URL
```

---

**Problem**: Permission denied on Docker

**Solution**:

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login, then:
pnpm db:start
```

---

### Development Server Issues

**Problem**: Port 3000/4321/3001 already in use

**Solution**:

```bash
# Find process using the port
lsof -i :3000
lsof -i :4321
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change port in app config
```

---

**Problem**: `Cannot find module` errors

**Solution**:

```bash
# Clean install
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

---

**Problem**: TypeScript errors after install

**Solution**:

```bash
# Build all packages first
pnpm build

# Or run typecheck
pnpm typecheck
```

---

### Environment Issues

**Problem**: `.env.local` variables not loading

**Solution**:

```bash
# Verify file exists
ls -la .env.local

# Restart dev servers
# Ctrl+C to stop, then:
pnpm dev
```

---

**Problem**: Clerk authentication not working

**Solution**:

1. Verify keys in `.env.local` are correct
2. Check Clerk dashboard for app status
3. Ensure `ALLOWED_ORIGINS` includes your dev URLs

---

### Git Issues

**Problem**: Can't push to repository

**Solution**:

```bash
# Verify remote
git remote -v

# If using HTTPS, switch to SSH:
git remote set-url origin git@github.com:qazuor/hospeda.git
```

---

**Problem**: Pre-commit hooks failing

**Solution**:

```bash
# Run checks manually to see errors
pnpm lint
pnpm typecheck
pnpm test

# Fix errors, then commit again
```

---

### Platform-Specific Issues

#### Windows/WSL

**Problem**: Slow file watching

**Solution**:

- Keep project in WSL filesystem (`~/projects/`)
- Don't work from Windows drives (`/mnt/c/`)

---

**Problem**: Line ending issues (CRLF)

**Solution**:

```bash
git config --global core.autocrlf input
```

---

#### macOS

**Problem**: Docker Desktop not starting

**Solution**:

1. Restart Docker Desktop
2. Check System Preferences → Privacy → Full Disk Access
3. Ensure Docker has permissions

---

#### Linux

**Problem**: Docker permission errors

**Solution**:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## Advanced Setup

### Custom Database Configuration

Edit `docker-compose.yml` to customize:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Change port
    environment:
      POSTGRES_USER: custom_user
      POSTGRES_PASSWORD: custom_pass
      POSTGRES_DB: custom_db
```

Then update `.env.local` accordingly.

---

### Using pgAdmin

```bash
# Start pgAdmin
pnpm pgadmin:start

# Access: http://localhost:8080
# Email: admin@example.com
# Password: admin123
```

Add server connection:

- Host: host.docker.internal (or your IP)
- Port: 5432
- Database: hospeda_dev
- Username: hospeda_user
- Password: hospeda_pass

---

### Using Neon Cloud Database

1. Create account at [neon.tech](https://neon.tech/)
2. Create new project
3. Copy connection string
4. Update `.env.local`:

   ```env
   DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname"
   ```

5. Run migrations:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

---

## Getting Help

If you're still experiencing issues:

1. Check [Prerequisites Troubleshooting](prerequisites.md#troubleshooting)
2. Review [Common Issues](../resources/troubleshooting.md)
3. Search [GitHub Discussions](https://github.com/qazuor/hospeda/discussions)
4. Ask in [Q&A Discussions](https://github.com/qazuor/hospeda/discussions/categories/q-a)
5. [Open an issue](https://github.com/qazuor/hospeda/issues/new) if you found a bug

---

**Installation complete?** → Next: [Development Environment](development-environment.md)

**Ready to code?** → Jump to [First Contribution](first-contribution.md)
