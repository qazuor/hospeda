# Admin Dashboard Deployment Guide

**Last Updated**: 2024-01-15
**Target Platform**: Vercel
**Framework**: TanStack Start + React 19
**Status**: Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Build Configuration](#build-configuration)
5. [Environment Variables](#environment-variables)
6. [Deployment Process](#deployment-process)
7. Authentication & Security
8. Performance & Optimization
9. Monitoring & Logs
10. [Troubleshooting](#troubleshooting)
11. [Rollback Procedures](#rollback-procedures)

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
- **Authentication**: Clerk (role-based access control)
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
6. **Clerk Account**: Admin authentication configured
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
2. Click "Add New" → "Project"
3. Click "Continue with GitHub"
4. Authorize Vercel to access your GitHub repositories
5. Select organization/account with Hospeda repository

#### Repository Access

Ensure Vercel has access to the Hospeda repository:

1. Go to GitHub Settings → Applications → Vercel
2. Grant access to `hospeda/hospeda` repository
3. Verify repository appears in Vercel project import

### 3. Admin-Specific Requirements

#### 3. Admin-Specific Node.js Version

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

#### Clerk Authentication

**Setup**:

1. Create Clerk application for admin
2. Configure domains (production + preview)
3. Enable admin role management
4. Get publishable key

**Required for Deployment**:

- `VITE_CLERK_PUBLISHABLE_KEY`

#### Backend API

**Requirements**:

1. API must be deployed and accessible
2. CORS configured for admin domain
3. Health check endpoint available
4. Admin endpoints protected with Clerk

**Required for Deployment**:

- `VITE_API_URL` (e.g., `https://api.hospeda.com`)

---

## Initial Setup

### Import Project to Vercel

#### Using Vercel Dashboard (Recommended)

1. **Navigate to Import**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Or click "Add New" → "Project" from dashboard

1. **Select Repository**:
   - Find `hospeda/hospeda` repository
   - Click "Import"

1. **Configure Project**:
   - **Project Name**: `hospeda-admin`
   - **Framework Preset**: Select "Other" (TanStack Start not in presets)
   - **Root Directory**: `apps/admin`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `.output`
   - **Install Command**: `pnpm install`

1. **Environment Variables**:
   - Add all required variables (see [Environment Variables](#environment-variables))
   - Use "Production" environment for now

1. **Deploy**:
   - Click "Deploy"
   - Wait for first deployment (~3-5 minutes)
   - Verify deployment success

#### Import Project Using Vercel CLI

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

**First Deployment**:

The CLI will trigger a deployment. This is a test deployment.

### Configure Build Settings

#### Framework Detection

Vercel will detect the framework, but TanStack Start requires custom configuration.

**In Vercel Dashboard**:

1. Go to Project Settings → General
2. **Framework Preset**: "Other" (custom)
3. **Node.js Version**: 20.x (automatic from package.json)

#### Root Directory

**Critical**: Set root directory to monorepo app location.

1. Go to Project Settings → General
2. **Root Directory**: `apps/admin`
3. Include source files outside root directory: **Enabled** (for workspace deps)

This allows Vercel to access workspace packages like `@repo/db`, `@repo/schemas`.

#### Install Command

Vercel needs to use PNPM with workspace support.

**Configure**:

1. Go to Project Settings → General
2. **Install Command**: `pnpm install` (override)
3. Save changes

**Why Override**: Ensures PNPM is used instead of npm/yarn.

#### Build & Output Settings

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

**Configure**:

1. Go to Project Settings → General
2. **Build Command**: `pnpm build`
3. **Output Directory**: `.output`
4. Save changes

### Domain Configuration

#### Default Domain

Vercel assigns a default domain:

```
https://hospeda-admin.vercel.app
```

Or with your username:

```
https://hospeda-admin-username.vercel.app
```

#### Custom Domain (Production)

**Add Custom Domain**:

1. Go to Project Settings → Domains
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

1. Wait for DNS propagation (~5-60 minutes)
2. Verify in Vercel dashboard (should show "Valid Configuration")

#### SSL Certificate

Vercel automatically provisions SSL certificates:

1. Free Let's Encrypt certificate
2. Auto-renewal
3. Enforced HTTPS (HTTP redirects to HTTPS)

**Verify HTTPS**:

```bash
curl -I https://admin.hospeda.com
# Should return 200 OK with SSL
```

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

### Build Command Configuration

#### Default Build Script

`apps/admin/package.json`:

```json
{
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start"
  }
}
```

#### Vercel Build Command

**Set in Project Settings**:

```bash
pnpm build
```

**What It Does**:

1. Runs `vinxi build` from `apps/admin/`
2. Compiles TypeScript to JavaScript
3. Bundles React components
4. Generates server entry point
5. Optimizes assets (minification, compression)
6. Outputs to `.output/`

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

**Server Entry**:

The server is started via `.output/server/index.mjs`:

```javascript
// Simplified representation
import { createServer } from 'vinxi/server';
export default createServer({
  routes: import('./routes.json'),
  // ... configuration
});
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

**Or via .nvmrc**:

```
20.10.0
```

**Vercel Detection**:

- Reads `engines.node` from package.json
- Falls back to `.nvmrc`
- Defaults to latest LTS if neither present

### TanStack Start Build Process

#### 1. TypeScript Compilation

All `.ts` and `.tsx` files compiled to JavaScript:

```bash
# Implicit in vinxi build
tsc --noEmit  # Type checking only
```

Type errors will fail the build.

#### 2. Client Bundling (Vite)

Client-side code bundled with Vite:

- **Entry**: `src/routes/` components
- **Output**: `.output/public/assets/`
- **Optimizations**:
  - Code splitting per route
  - Tree shaking (remove unused code)
  - Minification (terser)
  - CSS extraction and minification

**Bundle Analysis**:

The build log shows bundle sizes:

```
vite v5.0.0 building for production...
✓ 234 modules transformed.
.output/public/assets/index-a1b2c3d4.js   123.45 kB │ gzip: 45.67 kB
.output/public/assets/vendor-e5f6g7h8.js  456.78 kB │ gzip: 123.45 kB
```

#### 3. Server Generation (Vinxi)

Server-side code generated:

- **Entry**: `.output/server/index.mjs`
- **Routing**: File-based routes → route manifest
- **SSR**: React server-side rendering setup
- **API Routes**: Server function compilation

**Server Chunks**:

Code split into chunks for efficient loading:

```
.output/server/chunks/
├── route-home-a1b2c3.mjs
├── route-users-d4e5f6.mjs
└── route-settings-g7h8i9.mjs
```

### SSR Configuration

TanStack Start enables SSR by default.

**SSR Benefits**:

- **Faster Initial Load**: Server renders HTML before sending to client
- **SEO**: Fully rendered HTML (though admin is private)
- **Progressive Enhancement**: Works without JavaScript

**SSR Process**:

1. User requests `/admin/dashboard`
2. Vercel Function executes `.output/server/index.mjs`
3. Server renders React components to HTML
4. HTML sent to client with hydration data
5. Client-side React hydrates (makes interactive)

**Disable SSR** (if needed):

```typescript
// src/routes/some-route.tsx
export const Route = {
  ssr: false, // Client-side only
};
```

### Build Caching

Vercel caches build artifacts to speed up deployments:

**Cached**:

- `node_modules/` (if package.json unchanged)
- `.next/cache/` (framework cache)
- Build outputs (for rollback)

**Cache Duration**:

- Dependencies: Until package.json changes
- Build cache: 7 days

**Clear Cache**:

```bash
vercel --force
```

Or in dashboard: Deployments → [deployment] → "Redeploy" → "Clear cache and redeploy"

---

## Environment Variables

### Overview

TanStack Start uses Vite for bundling, so environment variables must be prefixed with `VITE_`:

- **`VITE_*`**: Exposed to client-side code
- **No prefix**: Server-side only (not accessible in browser)

### Setting Variables in Vercel

#### Via Dashboard

1. Go to Project Settings → Environment Variables
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

#### Via vercel.json

For team collaboration, document (but don't commit values):

```json
{
  "env": {
    "VITE_CLERK_PUBLISHABLE_KEY": "@clerk-publishable-key",
    "VITE_API_URL": "@api-url"
  }
}
```

Then create secrets:

```bash
vercel secrets add clerk-publishable-key "pk_live_..."
vercel secrets add api-url "https://api.hospeda.com"
```

### Required Environment Variables

#### 1. VITE_CLERK_PUBLISHABLE_KEY

**Purpose**: Clerk authentication public key

**Format**:

```
YOUR_PUBLISHABLE_KEY_HERE  # Production
YOUR_TEST_PUBLISHABLE_HERE  # Development
```

**Get From**:

1. Go to [clerk.com](https://clerk.com/dashboard)
2. Select admin application
3. Go to API Keys
4. Copy "Publishable Key"

**Set in Vercel**:

```bash
# Production
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
# Paste: pk_live_...

# Preview
vercel env add VITE_CLERK_PUBLISHABLE_KEY preview
# Paste: pk_test_...
```

**Usage in Code**:

```typescript
// src/lib/clerk.ts
import { ClerkProvider } from '@clerk/clerk-react';

export const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
```

#### 2. VITE_API_URL

**Purpose**: Backend API base URL

**Format**:

```
https://api.hospeda.com          # Production
https://api-preview.hospeda.com  # Preview
http://localhost:3000            # Development
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

**Usage in Code**:

```typescript
// src/lib/api-client.ts
import { hc } from 'hono/client';
import type { AppType } from '@repo/api';

export const apiClient = hc<AppType>(import.meta.env.VITE_API_URL);
```

### Production vs Preview vs Development

Vercel supports three environment types:

#### Production vs Production

**When Used**:

- Deployments from `main` branch
- Custom domain deployments

**Variables**:

- Use production API URL
- Use production Clerk keys
- Enable analytics
- Disable debug logging

**Example**:

```bash
VITE_API_URL=https://api.hospeda.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

#### Production vs Preview

**When Used**:

- Pull request deployments
- Branch deployments (non-main)

**Variables**:

- Use preview/staging API URL
- Use test Clerk keys
- Enable debug features
- Disable analytics

**Example**:

```bash
VITE_API_URL=https://api-preview.hospeda.com
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

#### Production vs Development

**When Used**:

- Local development with `vercel dev`

**Variables**:

- Use localhost API
- Use test Clerk keys
- Enable all debug features

**Example**:

```bash
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Admin-Specific Variables

#### Optional Variables

**VITE_ENABLE_ANALYTICS** (optional):

```bash
# Production
VITE_ENABLE_ANALYTICS=true

# Preview/Development
VITE_ENABLE_ANALYTICS=false
```

**VITE_LOG_LEVEL** (optional):

```bash
# Production
VITE_LOG_LEVEL=error

# Preview
VITE_LOG_LEVEL=warn

# Development
VITE_LOG_LEVEL=debug
```

**VITE_FEATURE_FLAGS** (optional):

```bash
VITE_FEATURE_FLAGS=new-dashboard,advanced-filters
```

### Environment-Specific Configs

Use environment variables to configure behavior:

```typescript
// src/lib/config.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  environment: import.meta.env.MODE, // 'production' | 'development'
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'error',
  featureFlags: (import.meta.env.VITE_FEATURE_FLAGS || '')
    .split(',')
    .filter(Boolean),
};
```

### Validating Environment Variables

**Type-Safe Validation**:

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  VITE_ENABLE_ANALYTICS: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),
});

export const env = envSchema.parse(import.meta.env);
```

**Runtime Check**:

```typescript
// src/main.tsx
import { env } from './lib/env';

if (!env.VITE_CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}
```

### Security Best Practices

**DO**:

- ✅ Use `VITE_` prefix for client-exposed variables
- ✅ Use Vercel Secrets for sensitive values
- ✅ Set different values for Production/Preview
- ✅ Validate environment variables at startup
- ✅ Document required variables in README

**DON'T**:

- ❌ Commit `.env` files with secrets
- ❌ Expose server-side secrets to client (no `VITE_` prefix)
- ❌ Use production keys in preview deployments
- ❌ Hardcode sensitive values in code

---

## Deployment Process

### Git-Based Deployments (Recommended)

Vercel automatically deploys when code is pushed to GitHub.

#### Setup Git Integration

**Already configured during initial setup**:

1. GitHub repository connected
2. Vercel app installed on repository
3. Auto-deploy enabled

**Verify Integration**:

1. Go to Project Settings → Git
2. Verify:
   - **Connected Repository**: `hospeda/hospeda`
   - **Production Branch**: `main`
   - **Auto-Deploy**: Enabled

#### Deployment Triggers

**Production Deployment**:

Triggered when code is pushed to `main` branch:

```bash
# Make changes
git add apps/admin/src/routes/dashboard.tsx
git commit -m "feat(admin): update dashboard layout"

# Push to main
git push origin main
```

Vercel will:

1. Detect push to `main`
2. Start deployment
3. Clone repository
4. Install dependencies
5. Run build
6. Deploy to production URL

**Preview Deployment**:

Triggered when:

- Pull request is opened
- Code pushed to feature branch

```bash
# Create feature branch
git checkout -b feature/new-dashboard

# Make changes and push
git push origin feature/new-dashboard
```

Vercel will:

1. Detect new branch push
2. Create preview deployment
3. Comment on PR with preview URL
4. Update preview on each push

### Automatic Deployments

#### Production Deployments

**When**:

- Push to `main` branch
- Merge pull request to `main`

**Process**:

1. **Trigger**: Git push detected
2. **Build**: Run `pnpm build` in `apps/admin/`
3. **Deploy**: Upload `.output/` to Vercel infrastructure
4. **Verify**: Run health checks
5. **Activate**: Switch traffic to new deployment
6. **Notify**: Send deployment status (Slack, email, etc.)

**Duration**: ~3-5 minutes

**Notification**:

Vercel sends deployment status:

- **Success**: Green checkmark on GitHub commit
- **Failure**: Red X on GitHub commit

#### Preview Deployments

**When**:

- Pull request opened
- Code pushed to PR branch

**Process**:

Same as production, but deploys to unique preview URL:

```
https://hospeda-admin-git-feature-new-dashboard-username.vercel.app
```

**Benefits**:

- Test changes before merging
- Share with team for review
- QA testing in production-like environment

**Automatic Comments**:

Vercel bot comments on PR:

```markdown
✅ Deployment ready!

🔍 Inspect: https://vercel.com/username/hospeda-admin/...
✅ Preview: https://hospeda-admin-git-feature-...
```

### Manual Deployments

#### Manual Deployments Using Vercel CLI

**Deploy from Local**:

```bash
cd apps/admin
vercel
```

Follow prompts:

```text
? Set up and deploy? Y
? Deploy to production? N (creates preview)
```

**Deploy to Production**:

```bash
vercel --prod
```

**Deploy Specific Branch**:

```bash
git checkout feature/new-dashboard
vercel
```

#### Manual Deployments Using Dashboard

1. Go to Deployments tab
2. Click "Deploy"
3. Select:
   - **Branch**: Choose branch to deploy
   - **Environment**: Production or Preview
4. Click "Deploy"

### Deployment Configuration

#### vercel.json

Configure deployment behavior:

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

#### Build Overrides

Override build command per deployment:

**CLI**:

```bash
vercel --build-env NODE_ENV=production
```

**Dashboard**:

1. Go to Project Settings → General
2. Override Build Command:

```bash
NODE_ENV=production pnpm build
```

### Deployment Hooks

#### Deploy Hooks (Webhooks)

Create URLs that trigger deployments when called.

**Create Hook**:

1. Go to Project Settings → Git
2. Scroll to "Deploy Hooks"
3. Click "Create Hook"
4. Enter:
   - **Name**: "Manual Deploy"
   - **Branch**: `main`
5. Copy generated URL

**Trigger Deployment**:

```bash
curl -X POST https://api.vercel.com/v1/integrations/deploy/...
```

**Use Cases**:

- Deploy from CI/CD pipeline
- Deploy when CMS content changes
- Scheduled deployments (via cron + curl)

---

## Authentication & Security

### Clerk Integration

#### Clerk Integration Overview

Clerk provides authentication for the admin dashboard:

- **User Management**: Admins, editors, viewers
- **Role-Based Access**: Different permissions per role
- **Session Management**: Secure JWT tokens
- **SSO**: Single sign-on support

#### Configuration

**Install Clerk React SDK** (already in package.json):

```json
{
  "dependencies": {
    "@clerk/clerk-react": "^5.0.0"
  }
}
```

**Wrap App with ClerkProvider**:

```typescript
// src/main.tsx
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      {/* App routes */}
    </ClerkProvider>
  );
}
```

**Configure Allowed Domains**:

In Clerk Dashboard:

1. Go to Domains
2. Add production domain: `admin.hospeda.com`
3. Add preview domain pattern: `*.vercel.app`

### Protected Routes

#### Route Protection

Use Clerk's route guards:

```typescript
// src/routes/__root.tsx
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

export const Route = createRootRoute({
  component: () => (
    <>
      <SignedIn>
        {/* Protected admin content */}
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  ),
});
```

#### Role-Based Access

Protect routes by role:

```typescript
// src/components/RequireRole.tsx
import { useUser } from '@clerk/clerk-react';
import { Navigate } from '@tanstack/react-router';

type Role = 'admin' | 'editor' | 'viewer';

export function RequireRole({
  children,
  role,
}: {
  children: React.ReactNode;
  role: Role;
}) {
  const { user } = useUser();
  const userRole = user?.publicMetadata?.role as Role;

  if (userRole !== role && userRole !== 'admin') {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
}
```

**Usage**:

```typescript
// src/routes/settings.tsx
import { RequireRole } from '@/components/RequireRole';

export const Route = createRoute({
  component: () => (
    <RequireRole role="admin">
      <SettingsPage />
    </RequireRole>
  ),
});
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

#### Content Security Policy (CSP)

**Add CSP Header**:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.hospeda.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.hospeda.com https://clerk.hospeda.com;"
        }
      ]
    }
  ]
}
```

**Why `unsafe-inline` and `unsafe-eval`**:

- Required for React development
- Required for Clerk authentication
- Can be removed with CSP nonce in production

### CORS Configuration

Admin dashboard needs CORS configured on the API.

**API Configuration** (in API deployment):

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

**Best Practices**:

1. **Never commit secrets**: Use `.gitignore` for `.env` files
2. **Use Vercel Secrets**: For team sharing
3. **Rotate keys regularly**: Update Clerk keys quarterly
4. **Separate by environment**: Different keys for prod/preview
5. **Validate at startup**: Fail fast if required vars missing

**Validation**:

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  VITE_API_URL: z.string().url(),
});

export const env = envSchema.parse(import.meta.env);
```

---

## Performance & Optimization

### Code Splitting

TanStack Router provides automatic code splitting per route.

#### Route-Based Splitting

Each route becomes a separate bundle:

```
src/routes/
├── index.tsx           → index-[hash].js
├── dashboard.tsx       → dashboard-[hash].js
├── users.tsx           → users-[hash].js
└── settings.tsx        → settings-[hash].js
```

**Benefits**:

- Smaller initial bundle
- Faster page loads
- Lazy loading of routes

**How It Works**:

```typescript
// TanStack Router automatically splits
export const Route = createRoute({
  path: '/dashboard',
  component: DashboardPage, // Loaded only when route accessed
});
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

TanStack Router can prefetch routes on hover.

**Enable Prefetching**:

```typescript
// src/main.tsx
import { Router } from '@tanstack/react-router';

const router = new Router({
  routeTree,
  defaultPreload: 'intent', // Prefetch on hover/focus
  defaultPreloadDelay: 100, // Wait 100ms before prefetch
});
```

**Options**:

- `false`: No prefetching
- `'intent'`: Prefetch on hover/focus
- `'render'`: Prefetch when link renders

**Benefits**:

- Instant route transitions
- Feels like SPA navigation
- No loading spinners

### TanStack Query Caching

Optimize data fetching with TanStack Query.

#### Configure Query Client

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});
```

#### Cache Data Across Routes

```typescript
// src/routes/users/index.tsx
import { useQuery } from '@tanstack/react-query';

function UsersList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.users.$get(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return <UsersTable data={users} />;
}
```

Navigating away and back to this route reuses cached data (no refetch).

### Bundle Optimization

#### Analyze Bundle Size

**Install Analyzer**:

```bash
pnpm add -D rollup-plugin-visualizer
```

**Configure**:

```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    // ... other plugins
    visualizer({
      filename: './dist/stats.html',
      open: true,
    }),
  ],
});
```

**Generate Report**:

```bash
pnpm build
# Opens stats.html in browser
```

#### Reduce Bundle Size

**Tree Shaking**:

Ensure imports are tree-shakeable:

```typescript
// ❌ Bad: Imports entire library
import _ from 'lodash';
_.chunk(array, 2);

// ✅ Good: Imports only needed function
import { chunk } from 'lodash-es';
chunk(array, 2);
```

**Dynamic Imports**:

```typescript
// ❌ Bad: Always loaded
import { HeavyLibrary } from 'heavy-library';

// ✅ Good: Loaded only when needed
const HeavyLibrary = await import('heavy-library');
```

**Remove Unused Dependencies**:

```bash
pnpm exec depcheck
# Lists unused dependencies
pnpm remove unused-package
```

### Image Optimization

Use optimized images:

**Next-Gen Formats**:

- WebP instead of PNG/JPEG
- AVIF for best compression

**Responsive Images**:

```tsx
<img
  src="/images/logo.webp"
  srcSet="/images/logo-320w.webp 320w, /images/logo-640w.webp 640w"
  sizes="(max-width: 768px) 320px, 640px"
  alt="Hospeda Logo"
  loading="lazy"
/>
```

**CDN**:

Host images on CDN (Cloudinary, Vercel, etc.):

```tsx
<img
  src="https://res.cloudinary.com/hospeda/image/upload/v1/logo.webp"
  alt="Logo"
/>
```

---

## Monitoring & Logs

### Deployment Logs

View logs during deployment:

**Dashboard**:

1. Go to Deployments tab
2. Click on deployment
3. View "Building" logs in real-time

**CLI**:

```bash
vercel logs [deployment-url]
```

**Example Output**:

```
[01:23:45] Installing dependencies...
[01:24:12] Running "pnpm install"...
[01:25:33] Running build command...
[01:25:34] Running "pnpm build"...
[01:26:45] Build completed
[01:26:50] Deploying...
[01:27:00] Deployment ready
```

### Function Logs

View runtime logs from server functions:

**Dashboard**:

1. Go to Deployments → [active deployment]
2. Click "Functions" tab
3. Select function
4. View logs

**CLI**:

```bash
vercel logs --follow
```

**Add Logging**:

```typescript
// src/server/api.ts
export async function GET() {
  console.log('API called'); // Appears in function logs

  return Response.json({ success: true });
}
```

**Log Levels**:

- `console.log()`: Info
- `console.warn()`: Warning
- `console.error()`: Error

### Error Tracking

Integrate error tracking service.

#### Sentry Integration

**Install**:

```bash
pnpm add @sentry/react
```

**Configure**:

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

**Wrap App**:

```typescript
// src/main.tsx
import { ErrorBoundary } from '@sentry/react';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      {/* App content */}
    </ErrorBoundary>
  );
}
```

**Capture Errors**:

```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
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

1. Verify `pnpm-workspace.yaml` includes packages:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

1. Enable "Include source files outside root directory" in Vercel:
   - Project Settings → General → Root Directory
   - Toggle ON

1. Rebuild:

```bash
vercel --force
```

#### Error: "Build exceeded maximum duration"

**Symptom**:

```
Error: Build exceeded maximum duration of 45 minutes
```

**Cause**: Build taking too long (large dependencies, complex builds)

**Solution**:

1. **Optimize Dependencies**:

```bash
# Remove unused dependencies
pnpm exec depcheck
pnpm remove unused-package
```

1. **Enable Caching**:

Already enabled by default. Clear cache and retry:

```bash
vercel --force
```

1. **Upgrade Vercel Plan**: If consistently hitting limits

### VITE\_ Variable Issues

#### Error: "import.meta.env.VITE_API_URL is undefined"

**Symptom**:

```
TypeError: Cannot read property 'VITE_API_URL' of undefined
```

**Cause**: Environment variable not set or incorrect prefix

**Solution**:

1. **Verify Variable Exists**:

Go to Project Settings → Environment Variables

1. **Check Prefix**:

Must be `VITE_` prefix for client-side access:

```bash
# ❌ Wrong
API_URL=https://api.hospeda.com

# ✅ Correct
VITE_API_URL=https://api.hospeda.com
```

1. **Redeploy**:

After adding/changing variables:

```bash
vercel --prod
```

#### Error: "VITE\_\* variable not updating"

**Symptom**: Changed variable value but still seeing old value

**Cause**: Build cache

**Solution**:

```bash
# Clear cache and redeploy
vercel --force --prod
```

Or in dashboard: "Redeploy" → "Clear cache and redeploy"

### TanStack Router Errors

#### Error: "No routes matched"

**Symptom**:

```
Error: No routes matched location "/admin/dashboard"
```

**Cause**: Route not defined or incorrect path

**Solution**:

1. **Verify Route File Exists**:

```
src/routes/admin/dashboard.tsx
```

1. **Check Route Path**:

```typescript
// src/routes/admin/dashboard.tsx
export const Route = createRoute({
  path: '/admin/dashboard', // Must match URL
});
```

1. **Regenerate Routes** (if using route generation):

```bash
pnpm dev
# Routes auto-generated
```

#### Error: "Cannot access router context"

**Symptom**:

```
Error: useRouter must be used within a RouterProvider
```

**Cause**: Router not properly initialized

**Solution**:

Ensure app is wrapped with Router:

```typescript
// src/main.tsx
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';

function App() {
  return <RouterProvider router={router} />;
}
```

### Authentication Issues

#### Error: "Clerk publishable key is missing"

**Symptom**:

```
Error: Clerk: publishableKey is required
```

**Cause**: `VITE_CLERK_PUBLISHABLE_KEY` not set

**Solution**:

1. Add variable in Vercel:

```bash
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
# Paste: pk_live_...
```

1. Redeploy

#### Error: "Redirect loop after sign in"

**Symptom**: After signing in, page keeps redirecting

**Cause**: Incorrect sign-in redirect URL

**Solution**:

Configure in Clerk Dashboard:

1. Go to Paths
2. Set Sign-in URL: `https://admin.hospeda.com/sign-in`
3. Set After sign-in: `https://admin.hospeda.com/dashboard`

---

## Rollback Procedures

### Instant Rollback

Vercel keeps previous deployments active, allowing instant rollback.

#### Instant Rollback Using Dashboard

1. Go to Deployments tab
2. Find last working deployment
3. Click "⋯" menu → "Promote to Production"
4. Confirm promotion

**Effect**: Instant switch to previous deployment (< 1 second)

#### Using CLI

**List Recent Deployments**:

```bash
vercel ls
```

**Output**:

```
Age  Deployment                    Status   Duration
1m   hospeda-admin-abc123.vercel   Ready    2m 34s
1h   hospeda-admin-def456.vercel   Ready    2m 45s
1d   hospeda-admin-ghi789.vercel   Ready    2m 38s
```

**Promote Previous Deployment**:

```bash
vercel promote hospeda-admin-def456.vercel.app
```

**Verify**:

```bash
curl https://admin.hospeda.com
# Should serve rolled-back version
```

### Deployment History

Vercel keeps deployment history for:

- **Free Plan**: 7 days
- **Pro Plan**: Unlimited

**View History**:

1. Go to Deployments tab
2. View all past deployments
3. Filter by:
   - Branch
   - Status (Ready, Error, Canceled)
   - Environment (Production, Preview)

**Inspect Old Deployment**:

1. Click on deployment
2. View:
   - Source code (commit hash)
   - Build logs
   - Deployment URL (still accessible)
   - Environment variables used

### Testing Rollback

**Verify Before Promoting**:

Every deployment gets a unique URL, even production:

```
https://hospeda-admin-def456.vercel.app
```

**Test Old Deployment**:

1. Copy deployment URL from history
2. Open in browser
3. Verify functionality
4. If good, promote to production

**Rollback Workflow**:

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

1. Go to Project Settings → Deployment Protection
2. Enable:
   - **Protection Bypass for Automation**: Require approval for prod deployments
   - **Vercel Authentication**: Require login to access preview deployments

**Branch Protection**:

1. In GitHub: Settings → Branches → Add rule
2. Protect `main` branch:
   - Require pull request reviews
   - Require status checks (Vercel deployment success)

**Pre-Deployment Checks**:

Add checks before deploying:

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

Only merge (and deploy) if all checks pass.

---

## Summary

This guide covered deploying the TanStack Start admin dashboard to Vercel:

**Key Points**:

1. **Platform**: Vercel with SSR support
2. **Build**: `pnpm build` → `.output/` directory
3. **Environment Variables**: `VITE_*` prefix for client-side
4. **Deployment**: Git-based automatic deployments
5. **Authentication**: Clerk with role-based access
6. **Optimization**: Code splitting, route prefetching, query caching
7. **Monitoring**: Deployment logs, function logs, error tracking
8. **Rollback**: Instant rollback to previous deployment

**Next Steps**:

1. Complete initial setup
2. Configure environment variables
3. Set up custom domain
4. Enable deployment protection
5. Integrate monitoring (Sentry)
6. Test rollback procedure

For database deployment, see [Database Deployment Guide](./database-deployment.md).

---

**Document Version**: 1.0.0
**Last Reviewed**: 2024-01-15
**Maintained By**: DevOps Team
