# Setup Guide

Complete guide to setting up the Admin Dashboard for local development.

---

## 📖 Overview

This guide will help you set up the **Hospeda Admin Dashboard** on your local machine for development.

**Time required**: 5-10 minutes

**Prerequisites**:

- Node.js 18+ installed
- pnpm package manager
- Git
- Basic terminal knowledge

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd hospeda

# Install dependencies (from project root)
pnpm install
```

### 2. Database Setup

```bash
# Create fresh database with seed data
pnpm db:fresh

# Or manually:
pnpm db:push        # Apply schema
pnpm db:seed        # Seed data
```

### 3. Environment Variables

Create `.env` file in `apps/admin/`:

```bash
# Copy template
cp apps/admin/.env.example apps/admin/.env
```

Edit `apps/admin/.env`:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# API Configuration
VITE_API_URL=http://localhost:3001

# App Configuration
VITE_APP_NAME=Hospeda Admin
VITE_APP_URL=http://localhost:3000
```

### 4. Start Development Server

```bash
# Start admin dashboard
cd apps/admin
pnpm dev
```

Visit: **<http://localhost:3000>**

---

## 📋 Detailed Setup

### Prerequisites

#### 1. Install Node.js

**Required version**: 18.x or higher

**Check version**:

```bash
node -v   # Should be v18.x.x or higher
```

**Install Node.js**:

- **macOS**: `brew install node@18`
- **Linux**: Use [nvm](https://github.com/nvm-sh/nvm)
- **Windows**: Download from [nodejs.org](https://nodejs.org/)

#### 2. Install pnpm

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm -v   # Should be 8.x.x or higher
```

#### 3. Install Git

**Check if installed**:

```bash
git --version
```

**Install if needed**:

- **macOS**: `brew install git`
- **Linux**: `sudo apt install git` or `sudo yum install git`
- **Windows**: Download from [git-scm.com](https://git-scm.com/)

---

### Repository Setup

#### Clone Repository

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project
cd hospeda

# Verify structure
ls -la
```

**Expected structure**:

```text
hospeda/
├── apps/
│   ├── admin/      # Admin dashboard (TanStack Start)
│   ├── api/        # Backend API (Hono)
│   └── web/        # Public website (Astro)
├── packages/
│   ├── db/         # Database layer
│   ├── service-core/
│   └── ...
└── package.json
```

#### Install Dependencies

```bash
# Install all dependencies (from project root)
pnpm install

# This installs:
# - Admin dependencies
# - API dependencies
# - Web dependencies
# - All shared packages
```

**Verify installation**:

```bash
# Check that node_modules exists
ls -la node_modules/

# Verify workspace packages
pnpm list --depth 0
```

---

### Database Setup

The Admin Dashboard requires a PostgreSQL database.

#### Option 1: Local PostgreSQL

**Install PostgreSQL**:

- **macOS**: `brew install postgresql@15`
- **Linux**: `sudo apt install postgresql`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/)

**Start PostgreSQL**:

```bash
# macOS (Homebrew)
brew services start postgresql@15

# Linux (systemd)
sudo systemctl start postgresql

# Verify it's running
psql --version
```

**Create database**:

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE hospeda;

# Create user (optional)
CREATE USER hospeda_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE hospeda TO hospeda_user;

# Exit
\q
```

**Set DATABASE_URL** in root `.env`:

```env
DATABASE_URL=postgresql://hospeda_user:your_password@localhost:5432/hospeda
```

#### Option 2: Neon (Cloud PostgreSQL)

**Create Neon database**:

1. Go to [Neon Console](https://console.neon.tech/)
2. Create new project
3. Copy connection string
4. Paste in root `.env`:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb
```

#### Apply Database Schema

```bash
# From project root
pnpm db:push

# Verify schema
pnpm db:studio   # Opens Drizzle Studio
```

#### Seed Database

```bash
# Seed with sample data
pnpm db:seed

# This creates:
# - Sample accommodations
# - Destinations
# - Events
# - Users
# - Admin user (admin@hospeda.com / password)
```

---

### Authentication Setup (Clerk)

The Admin Dashboard uses **Clerk** for authentication.

#### 1. Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Sign up/Sign in
3. Click "Add application"
4. Name it "Hospeda Admin (Dev)"
5. Enable Email + Password authentication

#### 2. Get API Keys

From Clerk Dashboard:

1. Go to **API Keys** section
2. Copy **Publishable Key**
3. Paste in `apps/admin/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Important**: Use `pk_test_` for development, `pk_live_` for production.

#### 3. Configure Allowed Domains

In Clerk Dashboard:

1. Go to **Domains** section
2. Add `http://localhost:3000` as allowed origin
3. Save changes

#### 4. Test Authentication

```bash
# Start admin dev server
cd apps/admin
pnpm dev
```

Visit <http://localhost:3000>, click "Sign In", and create a test user.

---

### API Server Setup

The Admin Dashboard needs the API server running.

#### Start API Server

```bash
# In a separate terminal, from project root
cd apps/api
pnpm dev
```

**Verify API**:

Visit: <http://localhost:3001/api/v1/health>

**Expected response**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Configure API URL

In `apps/admin/.env`:

```env
VITE_API_URL=http://localhost:3001
```

---

### Environment Variables Reference

#### Admin App (.env)

Create `apps/admin/.env`:

```env
# ============================================================================
# CLERK AUTHENTICATION
# ============================================================================
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# ============================================================================
# API CONFIGURATION
# ============================================================================
VITE_API_URL=http://localhost:3001

# ============================================================================
# APP CONFIGURATION
# ============================================================================
VITE_APP_NAME=Hospeda Admin
VITE_APP_URL=http://localhost:3000

# ============================================================================
# OPTIONAL: ANALYTICS
# ============================================================================
VITE_GA_TRACKING_ID=G-...
```

#### Root Project (.env)

Create `.env` in project root:

```env
# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL=postgresql://localhost:5432/hospeda

# ============================================================================
# CLERK (Server-side keys)
# ============================================================================
CLERK_SECRET_KEY=sk_test_...

# ============================================================================
# OPTIONAL: THIRD-PARTY INTEGRATIONS
# ============================================================================
MERCADO_PAGO_ACCESS_TOKEN=...
SENDGRID_API_KEY=...
```

---

## 🎯 First Run

### Start Development Servers

You'll need **3 terminal windows**:

#### Terminal 1: Admin Dashboard

```bash
cd apps/admin
pnpm dev
```

**URL**: <http://localhost:3000>

#### Terminal 2: API Server

```bash
cd apps/api
pnpm dev
```

**URL**: <http://localhost:3001>

#### Terminal 3: Database Studio (Optional)

```bash
pnpm db:studio
```

**URL**: <http://localhost:4983>

### Verify Everything Works

1. **Visit Admin Dashboard**: <http://localhost:3000>
2. **Sign in** with test user or create new account
3. **Check dashboard** loads
4. **Navigate** to Accommodations section
5. **Verify data** from seed appears

---

## 🔧 Common Tasks

### Update Dependencies

```bash
# Update all dependencies
pnpm update

# Update specific package
pnpm update @tanstack/react-start
```

### Reset Database

```bash
# Complete reset (drops all data)
pnpm db:fresh

# Or step by step:
pnpm db:drop     # Drop all tables
pnpm db:push     # Recreate schema
pnpm db:seed     # Seed data
```

### Clear Build Cache

```bash
cd apps/admin

# Clear Vite cache
rm -rf .vinxi dist node_modules/.vite

# Rebuild
pnpm dev
```

### Run Type Checking

```bash
# Check types
pnpm typecheck

# Watch mode
pnpm typecheck --watch
```

### Run Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

---

## 🐛 Troubleshooting

### Port Already in Use

**Problem**: `Port 3000 is already in use`

**Solution**:

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm dev
```

### Database Connection Failed

**Problem**: `Error: connect ECONNREFUSED`

**Solutions**:

1. **Verify PostgreSQL is running**:

   ```bash
   # macOS
   brew services list | grep postgresql

   # Linux
   sudo systemctl status postgresql
   ```

2. **Check DATABASE_URL**:

   ```bash
   cat .env | grep DATABASE_URL
   ```

3. **Test connection**:

   ```bash
   psql $DATABASE_URL
   ```

### Clerk Auth Not Working

**Problem**: "Invalid publishable key"

**Solutions**:

1. **Verify key format**:

   - Development: `pk_test_...`
   - Production: `pk_live_...`

2. **Check environment variable**:

   ```bash
   cat apps/admin/.env | grep CLERK
   ```

3. **Verify in Clerk Dashboard**:

   - Go to API Keys section
   - Copy **Publishable Key** (not Secret Key)

### Type Errors

**Problem**: TypeScript errors about missing types

**Solutions**:

```bash
# Rebuild TypeScript project references
pnpm typecheck

# Clear TypeScript cache
rm -rf apps/admin/.tsbuildinfo

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

### Module Not Found

**Problem**: `Cannot find module '@repo/...'`

**Solutions**:

```bash
# Build workspace packages
pnpm build --filter=@repo/*

# Or rebuild everything
pnpm build
```

---

## 🚦 Verify Setup

Run this checklist to ensure everything is working:

- [ ] Node.js 18+ installed (`node -v`)
- [ ] pnpm installed (`pnpm -v`)
- [ ] Repository cloned
- [ ] Dependencies installed (`pnpm install`)
- [ ] Database running (PostgreSQL or Neon)
- [ ] Database schema applied (`pnpm db:push`)
- [ ] Database seeded (`pnpm db:seed`)
- [ ] Environment variables set (`.env` files)
- [ ] Clerk application created
- [ ] API server runs (`cd apps/api && pnpm dev`)
- [ ] Admin dashboard runs (`cd apps/admin && pnpm dev`)
- [ ] Can sign in to admin dashboard
- [ ] Dashboard loads data from API

---

## 📖 Next Steps

Now that setup is complete:

1. **Explore the Dashboard** - Navigate through different sections
2. **Read [Architecture Guide](./architecture.md)** - Understand TanStack Start
3. **Check [Usage Guides](./usage/)** - Learn admin features
4. **Review [Development Guides](./development/)** - Start building

---

## 🆘 Still Having Issues?

If you're stuck:

1. **Check [Troubleshooting Guide](./development/troubleshooting.md)**
2. **Search [GitHub Issues](https://github.com/hospeda/issues)**
3. **Ask in team Slack** #dev-admin channel
4. **Create GitHub issue** with:
   - Clear description
   - Steps to reproduce
   - Error messages
   - System info (`node -v`, `pnpm -v`, OS)

---

⬅️ Back to [Admin Documentation](./README.md)
