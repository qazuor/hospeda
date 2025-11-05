# Setup Guide

Local development setup for the Hospeda Web App.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18.x or later
- **pnpm** 8.x or later
- **PostgreSQL** 14.x or later (or access to Neon database)
- **Git** for version control

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/hospeda.git
cd hospeda
```

### 2. Install Dependencies

```bash
# From project root
pnpm install
```

This installs dependencies for all packages and apps in the monorepo.

---

## Environment Variables

### Create .env File

```bash
# From apps/web/ directory
cp .env.example .env
```

### Required Variables

```env
# Public Variables (exposed to client)
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_API_URL=http://localhost:3001

# Clerk Authentication (public keys are safe to expose)
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Server-only Variables
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda
CLERK_SECRET_KEY=sk_test_...
```

### Get Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **API Keys**
4. Copy **Publishable Key** and **Secret Key**

---

## Database Setup

The web app connects to the same database as the API.

### Option 1: Local PostgreSQL

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database
createdb hospeda

# Run migrations (from project root)
pnpm db:migrate

# Seed database (optional)
pnpm db:seed
```

### Option 2: Neon Database

```bash
# Use Neon connection string
DATABASE_URL=postgresql://user:password@region.neon.tech/hospeda?sslmode=require

# Run migrations
pnpm db:migrate
```

---

## Start Development Server

### Start Web App Only

```bash
cd apps/web
pnpm dev
```

Visits: <http://localhost:4321>

### Start All Apps (Web + API + Admin)

```bash
# From project root
pnpm dev
```

This starts:

- **Web**: <http://localhost:4321>
- **API**: <http://localhost:3001>
- **Admin**: <http://localhost:3000>

---

## Verify Installation

### 1. Check Web App

Visit: <http://localhost:4321>

You should see the Hospeda home page.

### 2. Check Hot Reload

Edit a file in `src/pages/` and save. The browser should automatically reload.

### 3. Check TypeScript

```bash
cd apps/web
pnpm typecheck
```

Should complete without errors.

### 4. Run Tests

```bash
cd apps/web
pnpm test
```

All tests should pass.

---

## Common Setup Issues

### Port Already in Use

**Error**: `Port 4321 is already in use`

**Solution**:

```bash
# Find process using port
lsof -i :4321

# Kill process
kill -9 <PID>

# Or change port in astro.config.mjs
```

### Cannot Connect to Database

**Error**: `Connection refused` or `Authentication failed`

**Solution**:

1. Verify PostgreSQL is running
2. Check DATABASE_URL format
3. Verify database exists
4. Check credentials

```bash
# Test connection
psql postgresql://user:password@localhost:5432/hospeda
```

### Missing Environment Variables

**Error**: `CLERK_SECRET_KEY is not defined`

**Solution**:

1. Verify `.env` file exists in `apps/web/`
2. Check all required variables are set
3. Restart dev server after changes

### Clerk Authentication Not Working

**Error**: Authentication redirects fail

**Solution**:

1. Verify Clerk keys are correct
2. Check application URL in Clerk dashboard
3. Add `http://localhost:4321` to allowed origins
4. Clear browser cookies

---

## Project Structure

After setup, your directory should look like:

```text
hospeda/
├── apps/
│   ├── web/                # This app
│   │   ├── src/
│   │   ├── public/
│   │   ├── .env           # Your local config
│   │   └── package.json
│   ├── api/
│   └── admin/
├── packages/
│   ├── db/
│   ├── service-core/
│   └── ...
└── pnpm-workspace.yaml
```

---

## Development Tools

### TypeScript

```bash
# Check types
pnpm typecheck

# Watch mode
pnpm typecheck --watch
```

### Linting

```bash
# Check code
pnpm lint

# Fix issues
pnpm lint --fix
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Interactive UI
pnpm test:ui
```

### Build

```bash
# Production build
pnpm build

# Preview build
pnpm preview
```

### Bundle Analysis

```bash
# Analyze bundle size
pnpm analyze
```

---

## IDE Setup

### VS Code (Recommended)

#### Extensions

Install these extensions:

- **Astro** - Astro language support
- **Prettier** - Code formatting
- **ESLint** - Linting
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **i18n Ally** - i18n support

#### Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[astro]": {
    "editor.defaultFormatter": "astro-build.astro-vscode"
  }
}
```

---

## Next Steps

After setup is complete:

1. **Learn the architecture** → [Architecture Guide](architecture.md)
2. **Explore features** → [Usage Guide](usage/README.md)
3. **Start building** → [Development Guide](development/README.md)
4. **View examples** → [Examples](examples/)

---

## Additional Resources

- **[Astro Documentation](https://docs.astro.build)** - Official Astro docs
- **[React Documentation](https://react.dev)** - Official React docs
- **[Tailwind Documentation](https://tailwindcss.com)** - Tailwind CSS docs
- **[Clerk Documentation](https://clerk.com/docs)** - Clerk authentication
- **[Project CLAUDE.md](../CLAUDE.md)** - Web app guidelines

---

⬅️ Back to [Documentation Portal](README.md)
