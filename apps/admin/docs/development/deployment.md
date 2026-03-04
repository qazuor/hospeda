# Admin Dashboard Deployment Guide

**Target Platform**: Vercel
**Framework**: TanStack Start + React 19

## Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Prerequisites](#prerequisites)
4. [Initial Setup](#initial-setup)
5. [Build Configuration](#build-configuration)
6. [Environment Variables](#environment-variables)
7. [Deployment Process](#deployment-process)
8. [Authentication and Security](#authentication-and-security)
9. [Performance and Optimization](#performance-and-optimization)
10. [Monitoring and Logs](#monitoring-and-logs)
11. [Troubleshooting](#troubleshooting)
12. [Rollback Procedures](#rollback-procedures)

---

## Quick Start

### Deploy to Vercel (First Time)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from admin directory
cd apps/admin
vercel

# Follow prompts:
# - Link to existing project or create new
# - Select scope (personal or team)
# - Confirm settings
```

### Deploy Updates

```bash
# Production deployment
vercel --prod

# Or push to main branch (auto-deploys if configured)
git push origin main
```

---

## Overview

### Architecture

The Hospeda admin dashboard is built with:

- **Framework**: TanStack Start (full-stack React framework with SSR)
- **UI**: React 19 + TailwindCSS + Shadcn UI
- **Routing**: TanStack Router (file-based routing)
- **State Management**: TanStack Query (server state)
- **Forms**: TanStack Form (type-safe forms)
- **Data Tables**: TanStack Table
- **Authentication**: Better Auth (role-based access control)
- **API Client**: Hono RPC client

### Deployment Target

The admin dashboard is deployed to **Vercel** with:

- **SSR Support**: Full server-side rendering
- **Edge Functions**: API routes run on edge network
- **Automatic HTTPS**: SSL certificates managed by Vercel
- **CDN**: Global content delivery
- **Preview Deployments**: Automatic preview URLs for pull requests

### TanStack Start Specifics

TanStack Start is a full-stack React framework that provides:

**Server-Side Rendering (SSR)**:

- Initial page load rendered on server
- Fast Time to First Byte (TTFB)
- SEO-friendly (though admin is private)

**File-Based Routing**:

- Routes defined in `src/routes/` directory
- Automatic code splitting per route
- Type-safe navigation

**Server Functions**:

- Server-side data fetching
- API integration
- Server-side validation

**Build Output**:

- Generates `.output/` directory
- Server entry: `.output/server/index.mjs`
- Static assets: `.output/public/`

### Prerequisites Summary

Before deployment, ensure you have:

1. **Vercel Account**: Free or paid tier
2. **GitHub Repository**: Admin code pushed to GitHub
3. **Vercel CLI**: Installed globally for manual deployments
4. **Node.js**: 20.10.0 or higher
5. **Environment Variables**: All required values ready
6. **Better Auth Account**: Admin authentication configured
7. **API Endpoint**: Backend API deployed and accessible

---

## Prerequisites

### 1. Vercel Account Setup

#### Create Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended) or email
3. Verify your email address
4. Complete profile setup

#### Install Vercel CLI

**Using npm**:

```bash
npm install -g vercel
```

**Using pnpm**:

```bash
pnpm add -g vercel
```

**Verify Installation**:

```bash
vercel --version
# Output: Vercel CLI 32.0.0
```

#### Login to Vercel CLI

```bash
vercel login
```

Follow the prompts to authenticate with your account.

### 2. GitHub Integration

#### Connect GitHub to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New" then "Project"
3. Click "Continue with GitHub"
4. Authorize Vercel to access your GitHub repositories
5. Select organization/account with Hospeda repository

#### Repository Access

Ensure Vercel has access to the Hospeda repository:

1. Go to GitHub Settings then Applications then Vercel
2. Grant access to `hospeda/hospeda` repository
3. Verify repository appears in Vercel project import

### 3. Admin-Specific Requirements

#### Node.js Version

The admin app requires Node.js **20.10.0 or higher**.

**Verify Local Version**:

```bash
node --version
# v20.10.0 or higher
```

**Set in Vercel** (automatic via `.nvmrc` or package.json engines):

```json
{
  "engines": {
    "node": ">=20.10.0"
  }
}
```

#### Monorepo Configuration

The admin app is part of a TurboRepo monorepo:

- **Root**: `/` (monorepo root)
- **Admin App**: `/apps/admin`
- **Package Manager**: PNPM with workspaces

Vercel must be configured to:

- Use PNPM as package manager
- Set root directory to `apps/admin`
- Include workspace dependencies

#### Build Requirements

**Build Command**:

```bash
pnpm build
```

**Output Directory**:

```
apps/admin/.output/
```

**Build Time**: ~2-3 minutes (including dependencies)

### 4. Required Services

#### Better Auth Authentication

**Setup**:

1. Create Better Auth application for admin
2. Configure domains (production + preview)
3. Enable admin role management
4. Get publishable key

**Required for Deployment**:

- `VITE_BETTER_AUTH_URL`

#### Backend API

**Requirements**:

1. API must be deployed and accessible
2. CORS configured for admin domain
3. Health check endpoint available
4. Admin endpoints protected with Better Auth

**Required for Deployment**:

- `VITE_API_URL` (e.g., `https://api.hospeda.com`)

---

## Initial Setup

### Import Project to Vercel

#### Using Vercel Dashboard (Recommended)

1. **Navigate to Import**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Or click "Add New" then "Project" from dashboard

2. **Select Repository**:
   - Find `hospeda/hospeda` repository
   - Click "Import"

3. **Configure Project**:
   - **Project Name**: `hospeda-admin`
   - **Framework Preset**: Select "Other" (TanStack Start not in presets)
   - **Root Directory**: `apps/admin`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `.output`
   - **Install Command**: `pnpm install`

4. **Environment Variables**:
   - Add all required variables (see [Environment Variables](#environment-variables))
   - Use "Production" environment for now

5. **Deploy**:
   - Click "Deploy"
   - Wait for first deployment (~3-5 minutes)
   - Verify deployment success

#### Using Vercel CLI

**Navigate to Admin Directory**:

```bash
cd apps/admin
```

**Initialize Vercel Project**:

```bash
vercel
```

**Follow Prompts**:

```text
? Set up and deploy "~/projects/hospeda/apps/admin"? Y
? Which scope do you want to deploy to? Your Name
? Link to existing project? N
? What's your project's name? hospeda-admin
? In which directory is your code located? ./
? Want to override the settings? Y
? Which settings? (select all needed)
  - Build Command
  - Output Directory
  - Install Command
  - Development Command
  - Root Directory
```

**Configure Settings**:

```text
? Build Command: pnpm build
? Output Directory: .output
? Install Command: pnpm install
? Development Command: pnpm dev
? Root Directory: apps/admin
```

### Configure Build Settings

#### Framework Detection

Vercel will detect the framework, but TanStack Start requires custom configuration.

**In Vercel Dashboard**:

1. Go to Project Settings then General
2. **Framework Preset**: "Other" (custom)
3. **Node.js Version**: 20.x (automatic from package.json)

#### Root Directory

**Critical**: Set root directory to monorepo app location.

1. Go to Project Settings then General
2. **Root Directory**: `apps/admin`
3. Include source files outside root directory: **Enabled** (for workspace deps)

This allows Vercel to access workspace packages like `@repo/db`, `@repo/schemas`.

#### Build and Output Settings

**Build Command**:

```bash
pnpm build
```

This runs the build script defined in `apps/admin/package.json`:

```json
{
  "scripts": {
    "build": "vinxi build"
  }
}
```

**Output Directory**:

```
.output
```

TanStack Start (via Vinxi) generates:

- `.output/server/` - Server-side code
- `.output/public/` - Static assets

### Domain Configuration

#### Default Domain

Vercel assigns a default domain:

```
https://hospeda-admin.vercel.app
```

#### Custom Domain (Production)

**Add Custom Domain**:

1. Go to Project Settings then Domains
2. Click "Add"
3. Enter domain: `admin.hospeda.com`
4. Choose "Production" branch

**DNS Configuration**:

1. Go to your DNS provider (e.g., Cloudflare)
2. Add CNAME record:

```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
TTL: Auto
```

3. Wait for DNS propagation (~5-60 minutes)
4. Verify in Vercel dashboard (should show "Valid Configuration")

#### SSL Certificate

Vercel automatically provisions SSL certificates:

1. Free Let's Encrypt certificate
2. Auto-renewal
3. Enforced HTTPS (HTTP redirects to HTTPS)

---

## Build Configuration

### Build Process Overview

The TanStack Start build process consists of:

1. **Install Dependencies**: `pnpm install`
2. **Type Checking**: Automatic during build
3. **Compile TypeScript**: TSX/TSC compilation
4. **Bundle Client Code**: Vite bundling
5. **Generate Server Code**: Vinxi server generation
6. **Optimize Assets**: Minification, tree-shaking
7. **Create Output**: `.output/` directory

### Output Directory Structure

After build completes, `.output/` contains:

```
apps/admin/.output/
├── server/
│   ├── index.mjs           # Server entry point
│   ├── chunks/             # Server code chunks
│   └── assets/             # Server assets
├── public/
│   ├── assets/             # Client JS/CSS bundles
│   │   ├── index-[hash].js
│   │   └── index-[hash].css
│   ├── _vercel/            # Vercel-specific files
│   └── favicon.ico
└── routes.json             # Routing manifest
```

### Node.js Version

TanStack Start requires Node.js 18+, but we use **20.10.0** for best compatibility.

**Set in package.json** (recommended):

```json
{
  "engines": {
    "node": ">=20.10.0",
    "pnpm": ">=8.15.0"
  }
}
```

### TanStack Start Build Process

#### 1. TypeScript Compilation

All `.ts` and `.tsx` files compiled to JavaScript. Type errors will fail the build.

#### 2. Client Bundling (Vite)

Client-side code bundled with Vite:

- **Entry**: `src/routes/` components
- **Output**: `.output/public/assets/`
- **Optimizations**:
  - Code splitting per route
  - Tree shaking (remove unused code)
  - Minification (terser)
  - CSS extraction and minification

#### 3. Server Generation (Vinxi)

Server-side code generated:

- **Entry**: `.output/server/index.mjs`
- **Routing**: File-based routes to route manifest
- **SSR**: React server-side rendering setup
- **API Routes**: Server function compilation

### SSR Configuration

TanStack Start enables SSR by default.

**SSR Process**:

1. User requests `/admin/dashboard`
2. Vercel Function executes `.output/server/index.mjs`
3. Server renders React components to HTML
4. HTML sent to client with hydration data
5. Client-side React hydrates (makes interactive)

### Build Caching

Vercel caches build artifacts to speed up deployments:

- **Dependencies**: Until package.json changes
- **Build cache**: 7 days

**Clear Cache**:

```bash
vercel --force
```

Or in dashboard: Deployments then [deployment] then "Redeploy" then "Clear cache and redeploy"

---

## Environment Variables

### Overview

TanStack Start uses Vite for bundling, so environment variables must be prefixed with `VITE_`:

- **`VITE_*`**: Exposed to client-side code
- **No prefix**: Server-side only (not accessible in browser)

### Setting Variables in Vercel

#### Via Dashboard

1. Go to Project Settings then Environment Variables
2. Click "Add New"
3. Enter:
   - **Name**: Variable name (e.g., `VITE_API_URL`)
   - **Value**: Variable value
   - **Environments**: Select Production, Preview, or Development
4. Click "Save"

#### Via CLI

```bash
vercel env add VITE_API_URL
```

Follow prompts to set value and environments.

### Required Environment Variables

#### 1. VITE_BETTER_AUTH_URL

**Purpose**: Better Auth authentication public key

**Get From**:

1. Go to Better Auth dashboard
2. Select admin application
3. Go to API Keys
4. Copy "Publishable Key"

**Set in Vercel**:

```bash
# Production
vercel env add VITE_BETTER_AUTH_URL production
# Paste: pk_live_...

# Preview
vercel env add VITE_BETTER_AUTH_URL preview
# Paste: pk_test_...
```

#### 2. VITE_API_URL

**Purpose**: Backend API base URL

**Format**:

```
https://api.hospeda.com          # Production
https://api-preview.hospeda.com  # Preview
http://localhost:3001             # Development
```

**Set in Vercel**:

```bash
# Production
vercel env add VITE_API_URL production
# Enter: https://api.hospeda.com

# Preview
vercel env add VITE_API_URL preview
# Enter: https://api-preview.hospeda.com
```

### Production vs Preview vs Development

#### Production

- Deployments from `main` branch
- Custom domain deployments
- Use production API URL and Better Auth keys

#### Preview

- Pull request deployments
- Branch deployments (non-main)
- Use preview/staging API URL and test Better Auth keys

#### Development

- Local development with `vercel dev`
- Use localhost API and test Better Auth keys

### Optional Variables

```bash
VITE_ENABLE_ANALYTICS=true     # Production only
VITE_LOG_LEVEL=error           # error (prod), warn (preview), debug (dev)
VITE_FEATURE_FLAGS=new-dashboard,advanced-filters
```

### Using Environment Variables

**Client-side:**

```tsx
// Only VITE_ prefixed variables
const authUrl = import.meta.env.VITE_BETTER_AUTH_URL;
const apiUrl = import.meta.env.VITE_API_URL;

// This is undefined in client code
const secret = import.meta.env.HOSPEDA_BETTER_AUTH_SECRET; // undefined
```

**Server-side:**

```tsx
// Server functions have access to all variables
import { createServerFn } from '@tanstack/react-start';

export const checkAuth = createServerFn({ method: 'GET' })
  .handler(async () => {
    const secret = process.env.HOSPEDA_BETTER_AUTH_SECRET;
    // Server-side logic
  });
```

### Validating Environment Variables

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_BETTER_AUTH_URL: z.string().startsWith('pk_'),
  VITE_ENABLE_ANALYTICS: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),
});

export const env = envSchema.parse(import.meta.env);
```

### Security Best Practices

**DO**:

- Use `VITE_` prefix for client-exposed variables
- Use Vercel Secrets for sensitive values
- Set different values for Production/Preview
- Validate environment variables at startup
- Document required variables in README

**DO NOT**:

- Commit `.env` files with secrets
- Expose server-side secrets to client (no `VITE_` prefix for secrets)
- Use production keys in preview deployments
- Hardcode sensitive values in code

---

## Deployment Process

### Git-Based Deployments (Recommended)

Vercel automatically deploys when code is pushed to GitHub.

#### Production Deployment

Triggered when code is pushed to `main` branch:

```bash
git add apps/admin/src/routes/dashboard.tsx
git commit -m "feat(admin): update dashboard layout"
git push origin main
```

Vercel will:

1. Detect push to `main`
2. Clone repository
3. Install dependencies
4. Run build
5. Deploy to production URL
6. Send deployment status notification

**Duration**: ~3-5 minutes

#### Preview Deployments

Triggered when:

- Pull request is opened
- Code pushed to feature branch

```bash
git checkout -b feature/new-dashboard
git push origin feature/new-dashboard
```

Vercel creates a unique preview URL:

```
https://hospeda-admin-git-feature-new-dashboard-username.vercel.app
```

Benefits:

- Test changes before merging
- Share with team for review
- QA testing in production-like environment
- Automatic SSL certificate

### Manual Deployments

#### Using CLI

```bash
cd apps/admin

# Preview deployment
vercel

# Production deployment
vercel --prod
```

#### Using Dashboard

1. Go to Deployments tab
2. Click "Deploy"
3. Select branch and environment
4. Click "Deploy"

### Deployment Configuration

#### vercel.json

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".output",
  "installCommand": "pnpm install",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

#### Deploy Hooks (Webhooks)

Create URLs that trigger deployments when called:

1. Go to Project Settings then Git
2. Scroll to "Deploy Hooks"
3. Click "Create Hook"
4. Enter name and branch
5. Copy generated URL

**Trigger Deployment**:

```bash
curl -X POST https://api.vercel.com/v1/integrations/deploy/...
```

---

## Authentication and Security

### Better Auth Integration

Better Auth provides authentication for the admin dashboard:

- **User Management**: Admins, editors, viewers
- **Role-Based Access**: Different permissions per role
- **Session Management**: Secure JWT tokens
- **SSO**: Single sign-on support

#### Configuration

**Wrap App with AuthProvider**:

```typescript
// src/main.tsx
import { AuthProvider } from '@repo/auth-ui';

const authUrl = import.meta.env.VITE_BETTER_AUTH_URL;

function App() {
  return (
    <AuthProvider publishableKey={authUrl}>
      {/* App routes */}
    </AuthProvider>
  );
}
```

**Configure Allowed Domains**:

In Better Auth Dashboard:

1. Go to Domains
2. Add production domain: `admin.hospeda.com`
3. Add preview domain pattern: `*.vercel.app`

### Protected Routes

Use Better Auth route guards in the `_authed` layout:

```typescript
// src/routes/_authed.tsx
// beforeLoad guard checks authentication
// Redirects to /auth/signin if not authenticated
// Verifies admin-eligible role
```

### Security Headers

#### Configure in vercel.json

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### CORS Configuration

Admin dashboard needs CORS configured on the API:

```typescript
// apps/api/src/index.ts
import { cors } from 'hono/cors';

app.use(
  cors({
    origin: [
      'https://admin.hospeda.com', // Production
      'https://hospeda-admin.vercel.app', // Vercel preview
      /^https:\/\/hospeda-admin-.*\.vercel\.app$/, // PR previews
    ],
    credentials: true,
  })
);
```

### Environment Variable Security

1. **Never commit secrets**: Use `.gitignore` for `.env` files
2. **Use Vercel Secrets**: For team sharing
3. **Rotate keys regularly**: Update Better Auth keys quarterly
4. **Separate by environment**: Different keys for prod/preview
5. **Validate at startup**: Fail fast if required vars missing

---

## Performance and Optimization

### Code Splitting

TanStack Router provides automatic code splitting per route:

```
src/routes/
├── index.tsx           -> index-[hash].js
├── dashboard.tsx       -> dashboard-[hash].js
├── users.tsx           -> users-[hash].js
└── settings.tsx        -> settings-[hash].js
```

#### Component Splitting

Manually split heavy components:

```typescript
import { lazy } from 'react';

const HeavyChart = lazy(() => import('@/components/HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}
```

### Route Prefetching

```typescript
// src/main.tsx
import { Router } from '@tanstack/react-router';

const router = new Router({
  routeTree,
  defaultPreload: 'intent', // Prefetch on hover/focus
  defaultPreloadDelay: 100, // Wait 100ms before prefetch
});
```

Options:

- `false`: No prefetching
- `'intent'`: Prefetch on hover/focus
- `'render'`: Prefetch when link renders

### TanStack Query Caching

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Bundle Optimization

**Analyze Bundle Size**:

```bash
pnpm add -D rollup-plugin-visualizer
pnpm build
# Opens stats.html in browser
```

**Tree Shaking**:

```typescript
// Bad: Imports entire library
import _ from 'lodash';

// Good: Imports only needed function
import { chunk } from 'lodash-es';
```

**Remove Unused Dependencies**:

```bash
pnpm exec depcheck
pnpm remove unused-package
```

### Build Optimization

**Enable caching in vercel.json:**

```json
{
  "github": {
    "enabled": true,
    "autoJobCancelation": true
  }
}
```

**Optimize dependencies:**

```bash
pnpm prune
pnpm update
```

### Runtime Optimization

**Function regions:**

```json
{
  "regions": ["iad1"],
  "functions": {
    "apps/admin/src/routes/**/*.tsx": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

**Headers for caching:**

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## Monitoring and Logs

### Deployment Logs

**Dashboard**:

1. Go to Deployments tab
2. Click on deployment
3. View "Building" logs in real-time

**CLI**:

```bash
vercel logs [deployment-url]
```

### Function Logs

View runtime logs from server functions:

**Dashboard**:

1. Go to Deployments then [active deployment]
2. Click "Functions" tab
3. Select function
4. View logs

**CLI**:

```bash
vercel logs --follow
```

### Error Tracking

#### Sentry Integration

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.MODE === 'production',
  tracesSampleRate: 1.0,
});
```

### Analytics

**Vercel Analytics (optional addon)**:

```tsx
// src/routes/__root.tsx
import { Analytics } from '@vercel/analytics/react';

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Analytics />
    </>
  ),
});
```

---

## Troubleshooting

### Build Failures

#### Error: "Module not found"

**Symptom**:

```
Error: Cannot find module '@repo/db'
```

**Cause**: Workspace dependency not resolved

**Solution**:

1. Verify `pnpm-workspace.yaml` includes packages
2. Enable "Include source files outside root directory" in Vercel Project Settings
3. Rebuild: `vercel --force`

#### Error: "Build exceeded maximum duration"

**Solution**:

1. Remove unused dependencies: `pnpm exec depcheck`
2. Clear cache and retry: `vercel --force`
3. Upgrade Vercel plan if consistently hitting limits

#### Error: "Build failed with exit code 1"

**Solution**:

```bash
# Fix TypeScript errors
pnpm typecheck

# Install missing dependencies
pnpm install

# Verify build works locally
pnpm build
```

### VITE_ Variable Issues

#### Error: "import.meta.env.VITE_API_URL is undefined"

**Cause**: Environment variable not set or incorrect prefix

**Solution**:

1. Verify variable exists in Project Settings then Environment Variables
2. Check prefix: Must be `VITE_` for client-side access
3. Redeploy after adding/changing variables: `vercel --prod`

#### Error: "VITE_* variable not updating"

**Cause**: Build cache

**Solution**:

```bash
vercel --force --prod
```

### TanStack Router Errors

#### Error: "No routes matched"

1. Verify route file exists in `src/routes/`
2. Check route path matches URL
3. Regenerate routes: `pnpm dev`

#### Error: "Cannot access router context"

Ensure app is wrapped with `RouterProvider`.

### Authentication Issues

#### Error: "Better Auth publishable key is missing"

1. Add `VITE_BETTER_AUTH_URL` in Vercel
2. Redeploy

#### Error: "Redirect loop after sign in"

Configure in Better Auth Dashboard:

1. Go to Paths
2. Set Sign-in URL: `https://admin.hospeda.com/sign-in`
3. Set After sign-in: `https://admin.hospeda.com/dashboard`

### Deployment Errors

#### Error: "Deployment failed to start"

Verify in vercel.json:

```json
{
  "outputDirectory": ".output",
  "buildCommand": "pnpm build"
}
```

#### Error: "Function execution timed out"

Increase function timeout in vercel.json:

```json
{
  "functions": {
    "apps/admin/src/routes/**/*.tsx": {
      "maxDuration": 30
    }
  }
}
```

---

## Rollback Procedures

### Instant Rollback

Vercel keeps previous deployments active, allowing instant rollback.

#### Using Dashboard

1. Go to Deployments tab
2. Find last working deployment
3. Click menu then "Promote to Production"
4. Confirm promotion

**Effect**: Instant switch to previous deployment (< 1 second)

#### Using CLI

```bash
# List recent deployments
vercel ls

# Promote previous deployment
vercel promote hospeda-admin-def456.vercel.app

# Verify production
curl https://admin.hospeda.com
```

### Deployment History

Vercel keeps deployment history for:

- **Free Plan**: 7 days
- **Pro Plan**: Unlimited

### Testing Rollback

Every deployment gets a unique URL:

```bash
# 1. Get deployment URL of last good version
vercel ls

# 2. Test in browser
curl https://hospeda-admin-def456.vercel.app

# 3. If working, promote
vercel promote hospeda-admin-def456.vercel.app

# 4. Verify production
curl https://admin.hospeda.com
```

### Preventing Bad Deployments

**Deployment Protection**:

1. Go to Project Settings then Deployment Protection
2. Enable protection for production deployments
3. Require Vercel Authentication for preview deployments

**Branch Protection**:

1. In GitHub: Settings then Branches then Add rule
2. Protect `main` branch:
   - Require pull request reviews
   - Require status checks (Vercel deployment success)

**Pre-Deployment Checks**:

```yaml
# .github/workflows/checks.yml
name: Pre-deployment Checks
on:
  pull_request:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - name: Install
        run: pnpm install
      - name: Type check
        run: pnpm typecheck
      - name: Lint
        run: pnpm lint
      - name: Test
        run: pnpm test
```

---

## Deployment Checklist

**Before deploying:**

- [ ] All tests pass locally
- [ ] TypeScript checks pass
- [ ] Build succeeds locally
- [ ] Environment variables configured
- [ ] Secrets not in code
- [ ] .env.local in .gitignore
- [ ] Dependencies updated

**After deploying:**

- [ ] Verify deployment URL works
- [ ] Test critical user flows
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Verify custom domains work

---

## Related

- [Architecture Overview](../architecture.md)
- [Development Documentation](./README.md)
