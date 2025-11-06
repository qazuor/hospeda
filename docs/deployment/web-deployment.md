# Web Deployment Guide - Vercel

Complete guide for deploying the Hospeda Astro web application to Vercel.

**Last Updated**: 2025-01-05
**Target Platform**: Vercel
**Framework**: Astro + React 19
**Version**: 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Build Configuration](#build-configuration)
5. [Environment Variables](#environment-variables)
6. [Deployment Process](#deployment-process)
7. [Custom Domains](#custom-domains)
8. Performance & Optimization
9. Monitoring & Logs
10. [Troubleshooting](#troubleshooting)
11. [Rollback Procedures](#rollback-procedures)

---

## Overview

### About the Web App

The Hospeda web application is the public-facing frontend for the tourism platform, built with:

- **Astro 4**: Modern static site generator with islands architecture
- **React 19**: Interactive components via Astro islands
- **SSR + SSG**: Server-side rendering and static site generation
- **Tailwind CSS**: Utility-first styling
- **Shadcn UI**: Accessible component library
- **TanStack Query**: Data fetching and caching
- **Clerk**: Authentication

**Architecture**:

```text
┌──────────────┐
│    Users     │ (Visitors, Guests, Hosts)
└──────┬───────┘
       │ HTTPS
       ↓
┌──────────────┐
│   Vercel     │ (Edge Network)
│   CDN        │ - Static Assets
│              │ - Edge Functions
│              │ - Image Optimization
└──────┬───────┘
       │
       ├─→ Static Pages (SSG)
       │   - Home, About, etc.
       │
       ├─→ Dynamic Pages (SSR)
       │   - Accommodation Details
       │   - Search Results
       │   - User Profile
       │
       └─→ API Routes
           - Webhooks
           - Server-side actions
```

### Why Vercel?

**Advantages**:

- **Zero Configuration**: Optimized for Astro out of the box
- **Global Edge Network**: Fast delivery worldwide
- **Automatic HTTPS**: Free SSL certificates
- **Instant Rollbacks**: One-click rollback to any deployment
- **Preview Deployments**: Automatic preview for every PR
- **Image Optimization**: On-the-fly image optimization
- **Analytics**: Built-in Web Vitals tracking
- **Edge Functions**: Run code at the edge (low latency)

**Use Cases**:

- Production web app deployment
- Staging environments
- Preview deployments for PRs
- A/B testing different versions

### Deployment Architecture

**Production Deployment**:

```text
                    Vercel Edge Network
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    Americas           Europe              Asia
     (IAD)             (FRA)              (SIN)
        │                  │                  │
    ┌───┴───┐          ┌───┴───┐        ┌───┴───┐
    │ Edge  │          │ Edge  │        │ Edge  │
    │ Cache │          │ Cache │        │ Cache │
    └───┬───┘          └───┬───┘        └───┬───┘
        │                  │                  │
        └──────────────────┴──────────────────┘
                           │
                    Origin Server
                  (Vercel Functions)
                           │
                    ┌──────┴──────┐
                    │             │
                Hospeda API    Neon DB
```

**Edge Locations**: Vercel has 100+ edge locations worldwide for optimal performance.

### Key Specifications

- **Framework**: Astro 4.x
- **Adapter**: `@astrojs/vercel` (SSR support)
- **Build Command**: `pnpm build`
- **Output Directory**: `dist/`
- **Install Command**: `pnpm install`
- **Node.js Version**: 20.x LTS
- **Development Port**: 4321
- **Preview Port**: 4321

### Rendering Strategies

**Static Generation (SSG)**:

- **Pages**: Home, About, Privacy Policy
- **Build Time**: Pre-rendered at build time
- **Caching**: Indefinite (until new deployment)
- **Performance**: Fastest (served from CDN)

**Server-Side Rendering (SSR)**:

- **Pages**: Accommodation details, Search results, User profile
- **Build Time**: Rendered on-demand (per request)
- **Caching**: Optional (via headers)
- **Performance**: Fast (edge functions)

**Hybrid** (Astro Islands):

- **Components**: Interactive React components
- **Hydration**: Partial hydration (only interactive parts)
- **Performance**: Optimal (minimal JavaScript)

### Deployment Flow

```text
Local Changes
    ↓
Git Commit & Push to GitHub
    ↓
Vercel Detects Push
    ↓
Build Process (CI/CD)
    ↓
Deploy to Preview (PR)
 or Production (main)
    ↓
Edge Network Distribution
    ↓
Production Live ✓
```

---

## Prerequisites

### Required Accounts

#### 1. Vercel Account

**Sign Up**:

- Visit <https://vercel.com/signup>
- Options:
  - **GitHub OAuth** (recommended)
  - GitLab
  - Bitbucket
  - Email

**Account Verification**:

- Email verification required
- No credit card required for Hobby plan

**Pricing Tiers** (as of 2024):

- **Hobby**: Free
  - 100GB bandwidth/month
  - 100 GB-hours serverless execution
  - Unlimited deployments
  - Analytics included

- **Pro**: $20/month
  - 1TB bandwidth/month
  - 1,000 GB-hours serverless execution
  - Advanced analytics
  - Team collaboration

- **Enterprise**: Custom pricing
  - Custom bandwidth
  - Enterprise support
  - SLA guarantees

**Recommended for Production**: Hobby plan (MVP), Pro plan (growth)

#### 2. GitHub Account

Required for:

- Code repository
- Automatic deployments
- Preview deployments
- Vercel integration

**Setup**:

- Repository: `https://github.com/your-org/hospeda`
- Branch: `main` (production), `develop` (staging)

#### 3. Clerk Account

- Already set up for authentication
- Public key: `HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY`

#### 4. API Access

- API URL: `https://hospeda-api.fly.dev` (or custom domain)
- Required for data fetching

### Install Vercel CLI

#### macOS/Linux

**Via npm** (recommended):

```bash
npm install -g vercel
```

**Via pnpm**:

```bash
pnpm add -g vercel
```

**Via Homebrew** (macOS):

```bash
brew install vercel-cli
```

#### Windows

**Via npm**:

```bash
npm install -g vercel
```

**Via Scoop**:

```bash
scoop install vercel-cli
```

#### Verify Installation

```bash
vercel --version
# Output: Vercel CLI 33.x.x
```

### Authenticate with Vercel

#### Browser Authentication (Recommended)

```bash
vercel login
```

**What happens**:

1. Opens browser
2. Prompts to authorize Vercel CLI
3. Saves authentication token locally (`~/.vercel/auth.json`)

**Output**:

```text
Vercel CLI 33.0.0
> Log in to Vercel
✔ Email or Username: your-email@example.com
✔ Email sent to your-email@example.com
> Verify your email by clicking the link sent to your-email@example.com
✔ Email verified
Congratulations! You are now logged in.
```

#### Token Authentication (CI/CD)

For GitHub Actions or other CI/CD:

```bash
# Get token from https://vercel.com/account/tokens
export VERCEL_TOKEN="your-token-here"

# Verify
vercel whoami
```

**Store in GitHub Secrets**:

```bash
# GitHub repository → Settings → Secrets → Actions
# Add: VERCEL_TOKEN = your-token-here
```

### Verify Prerequisites

Run this checklist before proceeding:

```bash
# 1. Vercel CLI installed
vercel --version

# 2. Authenticated
vercel whoami

# 3. Node.js version
node --version  # Should be v20.x.x

# 4. PNPM installed
pnpm --version  # Should be v8.15.6+

# 5. Project dependencies installed
cd /path/to/hospeda
pnpm install

# 6. Web app builds successfully
cd apps/web
pnpm build
# Should create dist/ folder

# 7. Preview works locally
pnpm preview
# Should start server on http://localhost:4321

# 8. Environment variables ready
cat .env.example
```

**All checks passed?** ✓ Ready to proceed!

---

## Initial Setup

### Step 1: Import Project to Vercel

Navigate to the web app directory:

```bash
cd /path/to/hospeda/apps/web
```

#### Option A: Via Vercel Dashboard (Recommended)

**Steps**:

1. **Go to Vercel Dashboard**: <https://vercel.com/new>
2. **Import Git Repository**: Click "Import Project"
3. **Select Repository**: Choose `your-org/hospeda` from GitHub
4. **Configure Project**:
   - **Framework Preset**: Astro
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`
5. **Add Environment Variables**: See [Environment Variables](#environment-variables) section
6. **Deploy**: Click "Deploy"

**Result**: Project deployed to `https://hospeda-xxx.vercel.app`

#### Option B: Via Vercel CLI

**Initialize project**:

```bash
cd apps/web
vercel
```

**Interactive Prompts**:

```text
Vercel CLI 33.0.0
? Set up and deploy "~/projects/hospeda/apps/web"? [Y/n] y
? Which scope do you want to deploy to? Your Personal Account
? Link to existing project? [y/N] n
? What's your project's name? hospeda-web
? In which directory is your code located? ./
Auto-detected Project Settings (Astro):
- Build Command: pnpm build
- Output Directory: dist
- Development Command: pnpm dev
? Want to override the settings? [y/N] n
```

**What happens**:

1. Creates `.vercel/` directory with project configuration
2. Links local project to Vercel project
3. Does NOT deploy yet (we need to configure first)

**Output**:

```text
🔗  Linked to your-account/hospeda-web (created .vercel)
ℹ️  Inspect: https://vercel.com/your-account/hospeda-web [1s]
```

#### Verify Project Link

```bash
vercel ls
```

**Output**:

```text
hospeda-web
  https://hospeda-web.vercel.app
  https://hospeda-web-git-main-your-account.vercel.app
```

### Step 2: Configure Build Settings

#### Vercel Dashboard Configuration

**Navigate to**: <https://vercel.com/your-account/hospeda-web/settings/general>

**Build & Development Settings**:

| Setting | Value |
|---------|-------|
| Framework Preset | Astro |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Install Command | `pnpm install` |
| Development Command | `pnpm dev` |

**Root Directory**:

- Set to: `apps/web` (for monorepo)

**Node.js Version**:

- Set to: `20.x` (LTS)

**Environment Variables** (see next section)

#### vercel.json Configuration

**File**: `apps/web/vercel.json`

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": "astro",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://hospeda-api.fly.dev/api/:path*"
    }
  ]
}
```

**Configuration Breakdown**:

#### Build Settings

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": "astro"
}
```

- **buildCommand**: Command to build the app
- **outputDirectory**: Where built files are located
- **installCommand**: How to install dependencies
- **framework**: Framework preset (enables optimizations)

#### Regions

```json
{
  "regions": ["iad1"]
}
```

- **iad1**: Washington D.C., USA (closest to Argentina for serverless functions)
- **Alternative**: `gru1` (São Paulo, Brazil) - if available

**Available Regions**:

| Code | Location |
|------|----------|
| iad1 | Washington D.C., USA |
| sfo1 | San Francisco, USA |
| gru1 | São Paulo, Brazil |
| lhr1 | London, UK |
| fra1 | Frankfurt, Germany |
| hnd1 | Tokyo, Japan |
| sin1 | Singapore |
| syd1 | Sydney, Australia |

#### Security Headers

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-XSS-Protection", "value": "1; mode=block" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ]
}
```

**Security benefits**:

- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Enables XSS filter
- **Referrer-Policy**: Controls referer information

#### Cache Headers

```json
{
  "source": "/assets/(.*)",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
  ]
}
```

**Caching**:

- **Static assets** (`/assets/*`): Cached for 1 year (immutable)
- **HTML pages**: No cache (always fresh)
- **API responses**: Configurable per endpoint

#### Step 2: Redirects

```json
{
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    }
  ]
}
```

**Use cases**:

- Redirect old URLs
- Canonical URL enforcement
- Language redirects

#### Rewrites (API Proxy)

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://hospeda-api.fly.dev/api/:path*"
    }
  ]
}
```

**Benefits**:

- **Same-origin requests**: Avoids CORS issues
- **URL simplification**: `/api/accommodations` instead of `https://hospeda-api.fly.dev/api/accommodations`
- **Flexibility**: Can switch API backend without frontend changes

### Step 3: Configure Astro for Vercel

#### Install Vercel Adapter

```bash
cd apps/web
pnpm add @astrojs/vercel
```

#### Update astro.config.mjs

**File**: `apps/web/astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: 'hybrid', // SSG by default, opt-in to SSR per page
  adapter: vercel({
    imageService: true,
    webAnalytics: {
      enabled: true,
    },
    speedInsights: {
      enabled: true,
    },
  }),
  vite: {
    optimizeDeps: {
      exclude: ['@repo/db', '@repo/service-core'],
    },
  },
});
```

**Configuration Breakdown**:

#### Output Mode

```javascript
output: 'hybrid'
```

**Options**:

- **static**: All pages pre-rendered (SSG only)
- **server**: All pages rendered on-demand (SSR only)
- **hybrid**: SSG by default, opt-in to SSR per page (recommended)

**Hybrid Example**:

```astro
---
// pages/index.astro (Static - default)
const accommodations = await fetch('...');
---
<Layout>
  <AccommodationList accommodations={accommodations} />
</Layout>
```

```astro
---
// pages/accommodations/[id].astro (Server-rendered)
export const prerender = false; // Opt-in to SSR

const { id } = Astro.params;
const accommodation = await fetch(`.../${id}`);
---
<Layout>
  <AccommodationDetail accommodation={accommodation} />
</Layout>
```

#### Vercel Adapter Options

```javascript
adapter: vercel({
  imageService: true,
  webAnalytics: { enabled: true },
  speedInsights: { enabled: true },
})
```

**imageService**: Enables Vercel's image optimization

- **Automatic formats**: WebP, AVIF
- **Responsive images**: Automatic srcset
- **On-demand optimization**: No build-time overhead

**webAnalytics**: Tracks Web Vitals

- **Metrics**: LCP, FID, CLS, TTFB, FCP
- **Real user data**: Actual user experience
- **Dashboard**: <https://vercel.com/your-account/hospeda-web/analytics>

**speedInsights**: Real User Monitoring (RUM)

- **Performance score**: Overall site performance
- **Recommendations**: Actionable insights
- **Tracking**: Page-by-page performance

### Step 4: Set Root Directory (Monorepo)

**For monorepos**, Vercel needs to know the project root.

#### Step 4: Via Vercel Dashboard

1. Go to: <https://vercel.com/your-account/hospeda-web/settings/general>
2. Scroll to: **Root Directory**
3. Set: `apps/web`
4. Click: **Save**

#### Via vercel.json

Already configured in `vercel.json`:

```json
{
  "buildCommand": "cd ../.. && pnpm build --filter=web",
  "installCommand": "cd ../.. && pnpm install"
}
```

**Note**: Build commands run from monorepo root for proper dependency resolution.

### Step 5: Configure Environment Variables

See [Environment Variables](#environment-variables) section for complete configuration.

---

## Build Configuration

### Build Command

**Standard build**:

```bash
pnpm build
```

**What happens**:

1. **Install dependencies**: `pnpm install`
2. **Type checking**: `tsc --noEmit`
3. **Astro build**: Compiles pages, components, assets
4. **Output**: `dist/` folder with static files and serverless functions

**Build output** (`dist/`):

```text
dist/
├── client/              # Client-side assets
│   ├── _astro/          # Hashed assets (CSS, JS, images)
│   ├── assets/          # Static assets
│   └── index.html       # Pre-rendered HTML pages
└── server/              # Serverless functions (SSR pages)
    └── entry.mjs        # Server entry point
```

### Monorepo Build Command

**For monorepos**, build from root:

```bash
# From monorepo root
pnpm build --filter=web
```

**TurboRepo** automatically handles dependencies:

```bash
# turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**Build order**:

1. `@repo/schemas` (dependencies)
2. `@repo/db`
3. `@repo/service-core`
4. `web` (app)

### Output Directory

**Static files**:

```bash
dist/client/
```

**Serverless functions**:

```bash
dist/server/
```

**Vercel deployment**:

- **Static files**: Served from CDN
- **Serverless functions**: Run on-demand (edge or regional)

### Install Command

**Standard install**:

```bash
pnpm install
```

**Frozen lockfile** (recommended for CI/CD):

```bash
pnpm install --frozen-lockfile
```

**Benefits**:

- **Reproducible builds**: Same dependencies every time
- **Faster installs**: No dependency resolution
- **Security**: Prevents unexpected updates

### Node.js Version

**Specify in package.json**:

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Or in .nvmrc**:

```bash
# apps/web/.nvmrc
20
```

**Vercel automatically detects** and uses the specified version.

### Build Optimizations

#### Enable Build Cache

**Vercel automatically caches**:

- `node_modules/`
- `.astro/` (Astro cache)
- `.vercel/` (build artifacts)

**Invalidate cache** (if needed):

```bash
vercel build --force
```

#### Parallel Builds

**TurboRepo** enables parallel builds:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

**Benefits**:

- **Faster builds**: Parallel execution
- **Caching**: Skip unchanged packages

#### Tree Shaking

**Vite automatically tree-shakes** unused code:

```javascript
// Only imports used functions
import { useState } from 'react';

// Entire lodash imported (bad)
import _ from 'lodash';

// Only imports used functions (good)
import { debounce } from 'lodash-es';
```

**Result**: Smaller bundle size.

#### Build Optimizations Code Splitting

**Astro automatically code-splits** by page:

```text
dist/client/_astro/
├── index.123abc.js       # Home page JavaScript
├── about.456def.js       # About page JavaScript
└── accommodation.789ghi.js # Accommodation page JavaScript
```

**Benefits**:

- **Faster initial load**: Load only what's needed
- **Better caching**: Change one page, others remain cached

---

## Environment Variables

### Overview

Environment variables configure your web app without code changes.

**Types**:

1. **Public** (`PUBLIC_*`): Exposed to client-side JavaScript
2. **Private**: Server-side only (SSR, API routes)

**IMPORTANT**: Vercel replaces environment variables at **build time** for static pages and **runtime** for serverless functions.

### Public Environment Variables

**Prefix**: `PUBLIC_*`

**Access**:

```typescript
// Client-side (browser)
const apiUrl = import.meta.env.PUBLIC_API_URL;
const clerkKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
```

**Never include secrets** in public variables (exposed in client bundle).

#### Required Public Variables

**Authentication (Clerk)**:

```bash
PUBLIC_CLERK_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY_HERE"
```

**API Configuration**:

```bash
PUBLIC_API_URL="https://hospeda-api.fly.dev"
# or via proxy: PUBLIC_API_URL="/api"
```

**Analytics** (optional):

```bash
PUBLIC_GOOGLE_ANALYTICS_ID="G-XXXXXXXXXX"
PUBLIC_SENTRY_DSN="https://xxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/123456"
```

**Feature Flags**:

```bash
PUBLIC_ENABLE_BOOKING="true"
PUBLIC_ENABLE_REVIEWS="false"
```

### Private Environment Variables

**No prefix** (or any other prefix)

**Access**:

```typescript
// Server-side only (SSR, API routes)
const clerkSecret = import.meta.env.CLERK_SECRET_KEY;
const dbUrl = import.meta.env.DATABASE_URL;
```

**NOT accessible** in client-side code.

#### Required Private Variables

**Authentication (Clerk)**:

```bash
CLERK_SECRET_KEY="YOUR_SECRET_KEY_HERE"
```

**Database** (if using SSR with direct DB access):

```bash
DATABASE_URL="postgresql://user:password@host.region.neon.tech/hospeda?sslmode=require"
```

**Note**: For most cases, the web app should NOT access the database directly. Use the API instead.

### Set Environment Variables via Vercel Dashboard

**Steps**:

1. Go to: <https://vercel.com/your-account/hospeda-web/settings/environment-variables>
2. Click: **Add New**
3. Enter:
   - **Key**: `PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Value**: `pk_live_xxx`
   - **Environments**: Select `Production`, `Preview`, `Development`
4. Click: **Save**

**Repeat** for all required variables.

**Screenshot reference**: [Vercel Environment Variables Settings]

### Set Environment Variables via CLI

**Single variable**:

```bash
vercel env add PUBLIC_CLERK_PUBLISHABLE_KEY production
# Paste value when prompted
```

**From .env file**:

```bash
# Create .env.production (DO NOT COMMIT!)
cat > .env.production << 'EOF'
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
PUBLIC_API_URL=https://hospeda-api.fly.dev
CLERK_SECRET_KEY=sk_live_xxx
EOF

# Pull existing variables (optional)
vercel env pull .env.local

# Add new variables
vercel env add < .env.production

# Delete temporary file
rm .env.production
```

**Note**: CLI method adds variables one by one (use dashboard for bulk).

### Environment-Specific Configuration

#### Development (.env.local)

**Not committed to git**.

```bash
# Authentication
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# API
PUBLIC_API_URL=http://localhost:3000

# Features
PUBLIC_ENABLE_BOOKING=true
PUBLIC_ENABLE_REVIEWS=true
```

**Usage**:

```bash
pnpm dev
# Automatically loads .env.local
```

#### Preview (Vercel Deployment Previews)

**Set in Vercel Dashboard** → Environment Variables → **Preview**

```bash
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
PUBLIC_API_URL=https://hospeda-api-staging.fly.dev
CLERK_SECRET_KEY=sk_test_xxx
```

**Triggered by**: Pull request deployments

**URL**: `https://hospeda-web-git-feature-xxx-your-account.vercel.app`

#### Production (Main Branch)

**Set in Vercel Dashboard** → Environment Variables → **Production**

```bash
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
PUBLIC_API_URL=https://hospeda-api.fly.dev
CLERK_SECRET_KEY=sk_live_xxx
```

**Triggered by**: Push to `main` branch

**URL**: `https://hospeda.com` (or `https://hospeda-web.vercel.app`)

### Access Environment Variables in Code

#### Client-Side (Browser)

**Astro pages/components**:

```astro
---
// pages/index.astro
const apiUrl = import.meta.env.PUBLIC_API_URL;
---

<script>
  // Also accessible in client scripts
  const apiUrl = import.meta.env.PUBLIC_API_URL;
  console.log('API URL:', apiUrl);
</script>
```

**React components** (Astro islands):

```tsx
// components/AccommodationList.tsx
export function AccommodationList() {
  const apiUrl = import.meta.env.PUBLIC_API_URL;

  // Fetch accommodations
  const { data } = useQuery({
    queryKey: ['accommodations'],
    queryFn: () => fetch(`${apiUrl}/api/accommodations`).then(r => r.json()),
  });

  return <div>{/* ... */}</div>;
}
```

#### Server-Side (SSR, API Routes)

**Astro SSR pages**:

```astro
---
// pages/accommodations/[id].astro
export const prerender = false; // Enable SSR

const { id } = Astro.params;
const apiUrl = import.meta.env.PUBLIC_API_URL;
const clerkSecret = import.meta.env.CLERK_SECRET_KEY; // Server-side only

const accommodation = await fetch(`${apiUrl}/api/accommodations/${id}`, {
  headers: { 'Authorization': `Bearer ${clerkSecret}` }
}).then(r => r.json());
---

<Layout>
  <AccommodationDetail accommodation={accommodation} />
</Layout>
```

**API routes** (`pages/api/*.ts`):

```typescript
// pages/api/webhook.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const clerkSecret = import.meta.env.CLERK_SECRET_KEY;

  // Verify webhook signature
  // ...

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### TypeScript Types for Environment Variables

**File**: `apps/web/src/env.d.ts`

```typescript
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Public
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_GOOGLE_ANALYTICS_ID?: string;
  readonly PUBLIC_SENTRY_DSN?: string;
  readonly PUBLIC_ENABLE_BOOKING: string;
  readonly PUBLIC_ENABLE_REVIEWS: string;

  // Private (server-side only)
  readonly CLERK_SECRET_KEY: string;
  readonly DATABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Benefits**:

- **Autocomplete**: IntelliSense for environment variables
- **Type checking**: Catch missing or incorrect variables at build time

### Security Best Practices

**DO**:

- ✓ Prefix public variables with `PUBLIC_`
- ✓ Use different values for dev/preview/production
- ✓ Validate environment variables at build time
- ✓ Use Vercel's encrypted environment variables
- ✓ Rotate secrets regularly

**DON'T**:

- ✗ Commit `.env` files to git (add to `.gitignore`)
- ✗ Expose secrets in public variables
- ✗ Log environment variables (even in development)
- ✗ Use production secrets in development
- ✗ Share environment variables via email/chat

**Validation Example**:

```typescript
// src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  PUBLIC_API_URL: z.string().url(),
  PUBLIC_ENABLE_BOOKING: z.enum(['true', 'false']),
});

export const config = envSchema.parse(import.meta.env);
```

**Build fails** if validation fails (prevents deploying with missing/invalid variables).

---

## Deployment Process

### Git-Based Deployments (Recommended)

**Vercel automatically deploys** when you push to GitHub.

#### Automatic Production Deployment

**Trigger**: Push to `main` branch

**Steps**:

```bash
# 1. Make changes locally
# Edit files...

# 2. Commit changes
git add .
git commit -m "feat(web): add accommodation search filters"

# 3. Push to GitHub
git push origin main
```

**What happens**:

1. **GitHub webhook**: Notifies Vercel of new commit
2. **Build starts**: Vercel starts building the project
3. **Install dependencies**: `pnpm install --frozen-lockfile`
4. **Build**: `pnpm build --filter=web`
5. **Deploy**: Uploads `dist/` to Vercel CDN
6. **Go live**: Routes traffic to new deployment
7. **Notification**: Email/Slack notification (if configured)

**Duration**: ~2-5 minutes

**Output** (Vercel dashboard):

```text
✓ Build successful
✓ Deployment successful
✓ Live at https://hospeda.com
```

#### Automatic Preview Deployment

**Trigger**: Create pull request

**Steps**:

```bash
# 1. Create feature branch
git checkout -b feature/search-filters

# 2. Make changes and commit
git add .
git commit -m "feat(web): add accommodation search filters"

# 3. Push branch
git push origin feature/search-filters

# 4. Create pull request on GitHub
# Visit: https://github.com/your-org/hospeda/compare/feature/search-filters
```

**What happens**:

1. **PR created**: GitHub webhook notifies Vercel
2. **Build starts**: Vercel builds preview deployment
3. **Deploy to unique URL**: `https://hospeda-web-git-feature-search-filters-your-account.vercel.app`
4. **Comment on PR**: Vercel bot comments with preview URL

**GitHub PR Comment**:

```text
✅ Deployment successful!

Preview: https://hospeda-web-git-feature-search-filters-your-account.vercel.app

Inspect: https://vercel.com/your-account/hospeda-web/deployments/xxx
```

**Benefits**:

- **Test before merge**: Preview changes before going live
- **Collaborate**: Share preview link with team/stakeholders
- **Automatic updates**: New commits update preview deployment

### Manual Deployments

#### Deploy via Vercel CLI

**Production deployment**:

```bash
cd apps/web
vercel --prod
```

**Preview deployment**:

```bash
vercel
```

**What happens**:

1. **Builds locally** or on Vercel (depending on configuration)
2. **Uploads to Vercel**
3. **Deploys to production** (`--prod`) or preview

**Output**:

```text
Vercel CLI 33.0.0
🔍  Inspect: https://vercel.com/your-account/hospeda-web/xxx [3s]
✅  Production: https://hospeda-web.vercel.app [5s]
```

#### Deploy from Specific Branch

```bash
git checkout feature/search-filters
vercel
```

**Creates preview deployment** for that branch.

#### Deploy with Environment Variables

```bash
vercel --env CUSTOM_VAR=value --prod
```

**Note**: Prefer setting environment variables in Vercel dashboard (persistent).

### Deployment Workflow

#### Standard Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Develop and test locally
pnpm dev

# 3. Run tests
pnpm test

# 4. Commit changes
git add .
git commit -m "feat(web): add new feature"

# 5. Push and create PR
git push origin feature/new-feature
# Create PR on GitHub

# 6. Review preview deployment
# Click preview link in PR comment

# 7. Request code review
# Add reviewers to PR

# 8. Merge PR
# Merge to main on GitHub

# 9. Automatic production deployment
# Vercel deploys to production

# 10. Verify production
# Visit https://hospeda.com and verify changes
```

#### Hotfix Workflow

**For critical production bugs**:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. Fix the bug
# Edit files...

# 3. Test locally
pnpm dev
pnpm test

# 4. Commit and push
git add .
git commit -m "fix(web): fix critical bug"
git push origin hotfix/critical-bug

# 5. Create PR and merge immediately
# Skip preview review if critical

# 6. Delete hotfix branch
git checkout main
git branch -d hotfix/critical-bug
```

### Deployment Strategies

#### Blue-Green Deployment

**Concept**: Deploy new version alongside old, then switch traffic.

**Implementation** (via Vercel):

1. **Deploy to preview**: `vercel` (creates preview URL)
2. **Test preview**: Verify everything works
3. **Promote to production**: `vercel --prod` or merge PR

**Instant rollback**: If issues, rollback to previous deployment (see [Rollback](#rollback-procedures)).

#### Canary Deployment

**Concept**: Gradually shift traffic to new version.

**Vercel doesn't support native canary**, but you can:

**Option 1**: Use A/B testing

```javascript
// Redirect 10% of users to new version
if (Math.random() < 0.1) {
  window.location.href = 'https://hospeda-web-canary.vercel.app';
}
```

**Option 2**: Use feature flags

```typescript
const enableNewFeature = import.meta.env.PUBLIC_ENABLE_NEW_FEATURE === 'true';

{enableNewFeature ? <NewComponent /> : <OldComponent />}
```

**Progressive rollout**:

1. Set `PUBLIC_ENABLE_NEW_FEATURE=true` for 10% of users
2. Monitor metrics
3. Increase to 50%, then 100%

#### Progressive Deployment (Vercel Native)

**Vercel automatically does progressive deployment**:

1. **Build new version**
2. **Deploy to edge network** (background)
3. **Wait for propagation** (~30 seconds)
4. **Switch traffic** (instant)

**Zero-downtime**: Old version serves traffic while new version deploys.

---

## Custom Domains

### Add Custom Domain

**Steps**:

1. **Go to Vercel Dashboard**: <https://vercel.com/your-account/hospeda-web/settings/domains>
2. **Click**: "Add Domain"
3. **Enter domain**: `hospeda.com`
4. **Click**: "Add"

**Vercel provides DNS instructions**:

```text
Add these DNS records to your domain:

Type: A
Name: @
Value: 76.76.21.21

Type: AAAA
Name: @
Value: 2606:4700:d0::a29f:c001

Or use CNAME (recommended):

Type: CNAME
Name: @
Value: cname.vercel-dns.com
```

### Configure DNS

**Option 1: Vercel Nameservers (Recommended)**

**Steps**:

1. **Go to domain registrar** (GoDaddy, Namecheap, etc.)
2. **Change nameservers** to Vercel:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. **Wait for propagation** (~24-48 hours)

**Benefits**:

- **Automatic configuration**: Vercel manages DNS
- **SSL auto-renewal**: No manual intervention
- **Best performance**: Optimized DNS routing

**Option 2: CNAME (Manual)**

**Steps**:

1. **Go to domain registrar DNS settings**
2. **Add CNAME record**:
   - Type: `CNAME`
   - Name: `@` (or `www`)
   - Value: `cname.vercel-dns.com`
   - TTL: `3600`
3. **Save**

**Wait for propagation** (~1-24 hours)

**Option 3: A + AAAA Records**

**Steps**:

1. **Add A record**:
   - Type: `A`
   - Name: `@`
   - Value: `76.76.21.21`
   - TTL: `3600`
2. **Add AAAA record** (IPv6):
   - Type: `AAAA`
   - Name: `@`
   - Value: `2606:4700:d0::a29f:c001`
   - TTL: `3600`
3. **Save**

### Add Subdomain

**Example**: `www.hospeda.com`

**Steps**:

1. **Vercel Dashboard**: Add domain `www.hospeda.com`
2. **DNS**: Add CNAME record
   - Name: `www`
   - Value: `cname.vercel-dns.com`

### SSL Certificates

**Vercel automatically provisions SSL** via Let's Encrypt.

**Steps**:

1. Add custom domain
2. Configure DNS
3. Wait for verification (~5 minutes to 24 hours)
4. SSL certificate issued automatically

**Verify SSL**:

```bash
curl -I https://hospeda.com
```

**Output**:

```text
HTTP/2 200
server: Vercel
x-vercel-id: iad1::xxx
```

**Renewal**: Automatic (every 90 days)

### Redirects

#### Redirect www to apex (or vice versa)

**Automatic**: Vercel handles this if both domains are added.

**Configuration** (`vercel.json`):

```json
{
  "redirects": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "www.hospeda.com" }],
      "destination": "https://hospeda.com/:path*",
      "permanent": true
    }
  ]
}
```

**Result**: `www.hospeda.com` → `hospeda.com`

#### Redirect old domain

```json
{
  "redirects": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "old-hospeda.com" }],
      "destination": "https://hospeda.com/:path*",
      "permanent": true
    }
  ]
}
```

---

## Performance & Optimization

### Edge Caching

**Vercel automatically caches** static assets at edge locations.

**Cache-Control Headers**:

```javascript
// astro.config.mjs
export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },
  },
});
```

**Result**: Hashed assets cached indefinitely (immutable).

**Static pages**:

```astro
---
// pages/index.astro
export const prerender = true; // Static generation

// Optional: Set cache headers
Astro.response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
---
```

**SSR pages**:

```astro
---
// pages/accommodations/[id].astro
export const prerender = false; // Server-side rendering

// Cache for 5 minutes (stale-while-revalidate)
Astro.response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
---
```

### Image Optimization

**Vercel Image Optimization** automatically:

- Converts to modern formats (WebP, AVIF)
- Generates responsive images
- Lazy loads images
- Serves from CDN

**Usage** (`Image` component):

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---

<Image
  src={heroImage}
  alt="Accommodation"
  width={800}
  height={600}
  loading="lazy"
  format="webp"
/>
```

**Output**:

```html
<img
  src="/_vercel/image?url=...&w=800&q=75"
  srcset="/_vercel/image?url=...&w=640&q=75 640w,
          /_vercel/image?url=...&w=800&q=75 800w,
          /_vercel/image?url=...&w=1200&q=75 1200w"
  alt="Accommodation"
  loading="lazy"
/>
```

**Benefits**:

- **Smaller sizes**: WebP is 25-35% smaller than JPEG
- **Faster loading**: Lazy loading defers off-screen images
- **Responsive**: Serves appropriate size per device

**Remote images** (Cloudinary):

```astro
<Image
  src="https://res.cloudinary.com/hospeda/image/upload/v1/accommodations/abc123.jpg"
  alt="Accommodation"
  width={800}
  height={600}
  format="webp"
/>
```

**Note**: Configure allowed domains in `astro.config.mjs`:

```javascript
export default defineConfig({
  image: {
    domains: ['res.cloudinary.com'],
  },
});
```

### Static Generation (SSG)

**Pre-render pages** at build time for maximum performance.

**Example** (`pages/about.astro`):

```astro
---
export const prerender = true; // Enable SSG
---

<Layout title="About Hospeda">
  <h1>About Us</h1>
  <p>Hospeda is a tourism accommodation platform...</p>
</Layout>
```

**Benefits**:

- **Fastest loading**: Served directly from CDN
- **SEO-friendly**: Fully rendered HTML
- **No server cost**: No serverless execution

**Use cases**:

- Marketing pages (home, about, pricing)
- Blog posts
- Documentation

### Incremental Static Regeneration (ISR)

**Regenerate static pages** periodically without rebuilding entire site.

**Not yet supported in Astro** (as of v4.x), but you can:

**Option 1**: Use SSR with caching

```astro
---
export const prerender = false; // SSR

Astro.response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
---
```

**Option 2**: Rebuild on-demand (webhooks)

```bash
# Trigger build via Vercel API
curl -X POST "https://api.vercel.com/v1/integrations/deploy/xxx" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

### Code Splitting

**Astro automatically code-splits** by page and island.

**Manual code splitting** (lazy loading):

```tsx
// components/HeavyComponent.tsx
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));

export function Dashboard() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <HeavyChart />
    </Suspense>
  );
}
```

**Result**: `HeavyChart` loaded only when rendered.

### Analytics

#### Vercel Web Analytics

**Already enabled** in `astro.config.mjs`:

```javascript
adapter: vercel({
  webAnalytics: { enabled: true },
})
```

**Metrics tracked**:

- **LCP** (Largest Contentful Paint): Loading performance
- **FID** (First Input Delay): Interactivity
- **CLS** (Cumulative Layout Shift): Visual stability
- **TTFB** (Time to First Byte): Server response time
- **FCP** (First Contentful Paint): Perceived loading

**Dashboard**: <https://vercel.com/your-account/hospeda-web/analytics>

#### Vercel Speed Insights

**Already enabled**:

```javascript
adapter: vercel({
  speedInsights: { enabled: true },
})
```

**Real User Monitoring** (RUM):

- Performance score (0-100)
- Page-by-page breakdown
- Device/browser breakdown
- Geographic breakdown

**Dashboard**: <https://vercel.com/your-account/hospeda-web/speed-insights>

---

## Monitoring & Logs

### View Deployment Logs

#### View Deployment Via Vercel Dashboard

**Steps**:

1. Go to: <https://vercel.com/your-account/hospeda-web>
2. Click on deployment
3. View **Build Logs** and **Function Logs**

**Build Logs**:

```text
[10:00:00.123] Running "pnpm install"
[10:00:05.456] Lockfile is up to date
[10:00:05.789] Dependencies installed
[10:00:06.012] Running "pnpm build --filter=web"
[10:00:08.345] Building Astro project...
[10:00:12.678] ✓ Built in 4.3s
[10:00:13.901] Build successful
```

**Function Logs** (SSR pages):

```text
[10:15:30.123] GET /accommodations/abc123 200 45ms
[10:15:35.456] GET /api/webhook 200 12ms
[10:15:40.789] GET /search?q=beach 200 78ms
```

#### Via Vercel CLI

**Real-time logs**:

```bash
vercel logs hospeda-web --follow
```

**Recent logs**:

```bash
vercel logs hospeda-web --since 1h
```

**Specific deployment**:

```bash
vercel logs hospeda-web --deployment <deployment-url>
```

### Function Logs

**Serverless functions** (SSR pages, API routes) generate logs.

**Logging in code**:

```typescript
// pages/api/webhook.ts
export const POST: APIRoute = async ({ request }) => {
  console.log('Webhook received:', request.url);

  // Process webhook...

  console.log('Webhook processed successfully');
  return new Response('OK', { status: 200 });
};
```

**Output** (Vercel dashboard → Function Logs):

```text
[10:15:30.123] Webhook received: https://hospeda.com/api/webhook
[10:15:30.456] Webhook processed successfully
```

**Structured logging**:

```typescript
console.log(JSON.stringify({
  level: 'info',
  message: 'Webhook received',
  url: request.url,
  timestamp: new Date().toISOString(),
}));
```

**Output**:

```json
{
  "level": "info",
  "message": "Webhook received",
  "url": "https://hospeda.com/api/webhook",
  "timestamp": "2024-01-05T10:15:30.123Z"
}
```

### Analytics Dashboard

#### Vercel Analytics

**Navigate to**: <https://vercel.com/your-account/hospeda-web/analytics>

**Metrics**:

- **Total Visitors**: Unique visitors
- **Top Pages**: Most visited pages
- **Top Countries**: Geographic distribution
- **Top Devices**: Desktop vs mobile
- **Top Browsers**: Browser distribution

**Time Range**: 24h, 7d, 30d

#### Web Vitals

**Navigate to**: <https://vercel.com/your-account/hospeda-web/analytics/web-vitals>

**Core Web Vitals**:

- **LCP**: < 2.5s (good), 2.5-4s (needs improvement), > 4s (poor)
- **FID**: < 100ms (good), 100-300ms (needs improvement), > 300ms (poor)
- **CLS**: < 0.1 (good), 0.1-0.25 (needs improvement), > 0.25 (poor)

**Breakdown**:

- Per page
- Per device
- Per country

**Recommendations**: Vercel provides actionable insights.

### Error Tracking

#### Vercel Error Monitoring

**Built-in error tracking** for serverless functions.

**Dashboard**: <https://vercel.com/your-account/hospeda-web/errors>

**Captured errors**:

- Unhandled exceptions
- HTTP 5xx errors
- Function timeouts

**Error details**:

- Stack trace
- Request URL
- Headers
- Environment

#### Sentry Integration

**For advanced error tracking**, integrate Sentry:

**Install**:

```bash
pnpm add @sentry/astro --filter=web
```

**Configure** (`astro.config.mjs`):

```javascript
import sentry from '@sentry/astro';

export default defineConfig({
  integrations: [
    sentry({
      dsn: import.meta.env.PUBLIC_SENTRY_DSN,
      environment: import.meta.env.PUBLIC_VERCEL_ENV || 'development',
      tracesSampleRate: 1.0,
    }),
  ],
});
```

**Capture errors**:

```typescript
import * as Sentry from '@sentry/astro';

try {
  // Code that might throw
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

**Benefits**:

- **Detailed stack traces**: With source maps
- **User context**: User ID, session data
- **Breadcrumbs**: User actions leading to error
- **Alerts**: Email/Slack notifications

---

## Troubleshooting

### Common Deployment Errors

#### Error: "Build Command Failed"

**Symptom**:

```text
Error: Command "pnpm build" exited with 1
```

**Causes**:

- TypeScript errors
- ESLint errors
- Missing dependencies
- Build script errors

**Solution**:

```bash
# 1. Build locally to see detailed error
cd apps/web
pnpm build

# 2. Fix errors shown

# 3. Commit and push
git add .
git commit -m "fix(web): fix build errors"
git push
```

**Common issues**:

- **TypeScript errors**: Fix type errors
- **Missing environment variables**: Add to Vercel dashboard
- **Dependency issues**: Update `package.json`, run `pnpm install`

#### Error: "Install Command Failed"

**Symptom**:

```text
Error: Command "pnpm install" exited with 1
```

**Cause**: Dependency resolution issues.

**Solution**:

```bash
# 1. Delete node_modules and lockfile
rm -rf node_modules pnpm-lock.yaml

# 2. Reinstall
pnpm install

# 3. Commit new lockfile
git add pnpm-lock.yaml
git commit -m "chore: update lockfile"
git push
```

#### Error: "Timeout: Function Execution Time Exceeded"

**Symptom**:

```text
Error: Function execution exceeded 10s timeout
```

**Cause**: SSR page taking too long to render.

**Solution**:

**Option 1**: Optimize rendering

```astro
---
// Fetch data in parallel
const [accommodations, reviews] = await Promise.all([
  fetch('...').then(r => r.json()),
  fetch('...').then(r => r.json()),
]);
---
```

**Option 2**: Use static generation

```astro
---
export const prerender = true; // Pre-render at build time
---
```

**Option 3**: Increase timeout (Pro plan only)

```json
{
  "functions": {
    "pages/accommodations/[id].astro": {
      "maxDuration": 60
    }
  }
}
```

#### Error: "404 on Dynamic Route"

**Symptom**: `pages/accommodations/[id].astro` returns 404.

**Cause**: Missing SSR configuration.

**Solution**:

```astro
---
// pages/accommodations/[id].astro
export const prerender = false; // Enable SSR for dynamic routes
---
```

**Or**: Pre-generate paths (SSG)

```astro
---
export async function getStaticPaths() {
  const accommodations = await fetch('...').then(r => r.json());

  return accommodations.map((acc) => ({
    params: { id: acc.id },
    props: { accommodation: acc },
  }));
}

const { accommodation } = Astro.props;
---
```

### Environment Variable Issues

#### Error: "Environment Variable is Undefined"

**Symptom**:

```typescript
const apiUrl = import.meta.env.PUBLIC_API_URL; // undefined
```

**Causes**:

1. Variable not set in Vercel dashboard
2. Missing `PUBLIC_` prefix (for client-side access)
3. Typo in variable name
4. Wrong environment (Production vs Preview vs Development)

**Solution**:

**1. Check Vercel dashboard**:

- Go to: <https://vercel.com/your-account/hospeda-web/settings/environment-variables>
- Verify variable exists
- Check correct environments selected

**2. Verify prefix**:

```typescript
// Client-side access requires PUBLIC_ prefix
const apiUrl = import.meta.env.PUBLIC_API_URL; // ✓

// Server-side access (no prefix needed)
const clerkSecret = import.meta.env.CLERK_SECRET_KEY; // ✓
```

**3. Redeploy**:

```bash
# After adding/updating variables, redeploy
vercel --prod
```

#### Error: "Secret Exposed in Client Bundle"

**Symptom**: Secret visible in browser DevTools → Sources.

**Cause**: Used private variable with `PUBLIC_` prefix.

**Solution**:

```typescript
// ✗ BAD: Secret exposed
const clerkSecret = import.meta.env.PUBLIC_CLERK_SECRET_KEY;

// ✓ GOOD: Secret server-side only
const clerkSecret = import.meta.env.CLERK_SECRET_KEY; // SSR only
```

**Remove `PUBLIC_` prefix** from secret variables.

### Build Performance Issues

#### Slow Builds

**Symptom**: Builds taking > 5 minutes.

**Causes**:

- Large dependencies
- No caching
- Heavy build steps

**Solution**:

**1. Enable caching** (already enabled by default):

```json
{
  "cache": true
}
```

**2. Reduce dependencies**:

```bash
# Analyze bundle size
pnpm exec vite-bundle-visualizer
```

**3. Use dynamic imports**:

```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

**4. Upgrade Vercel plan** (faster builds on Pro plan).

#### Out of Memory

**Symptom**:

```text
Error: JavaScript heap out of memory
```

**Solution**:

**Increase Node.js memory** (add to `package.json`):

```json
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' astro build"
  }
}
```

**Or**: Optimize build (reduce concurrent tasks, simplify build steps).

### Runtime Errors

#### Error: "Hydration Mismatch"

**Symptom**: React hydration error in browser console.

**Cause**: Server-rendered HTML doesn't match client-rendered HTML.

**Solution**:

**1. Check for client-only code** in server context:

```tsx
// ✗ BAD: window is undefined on server
const width = window.innerWidth;

// ✓ GOOD: Check if window exists
const width = typeof window !== 'undefined' ? window.innerWidth : 0;
```

**2. Use `client:only`** for client-only components:

```astro
<HeavyComponent client:only="react" />
```

#### Error: "Failed to Fetch"

**Symptom**: API requests failing in production.

**Causes**:

1. Wrong API URL
2. CORS issues
3. API down

**Solution**:

**1. Verify API URL**:

```typescript
console.log('API URL:', import.meta.env.PUBLIC_API_URL);
// Should be: https://hospeda-api.fly.dev
```

**2. Use API proxy** (recommended):

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://hospeda-api.fly.dev/api/:path*"
    }
  ]
}
```

**3. Check CORS** (if not using proxy):

```typescript
// API must allow origin
Access-Control-Allow-Origin: https://hospeda.com
```

---

## Rollback Procedures

### View Deployment History

**Via Vercel Dashboard**:

1. Go to: <https://vercel.com/your-account/hospeda-web>
2. Click **Deployments** tab

**Output**:

```text
Deployments
Production  Jan 5, 2024 10:15 AM  abc123  Ready
Preview     Jan 5, 2024 09:00 AM  def456  Ready
Production  Jan 4, 2024 02:30 PM  ghi789  Ready
```

**Via CLI**:

```bash
vercel ls hospeda-web
```

**Output**:

```text
  age  url                                                state
  5m   hospeda-web-abc123.vercel.app                     READY
  2h   hospeda-web-def456.vercel.app                     READY
  1d   hospeda-web-ghi789.vercel.app                     READY
```

### Instant Rollback

**Via Vercel Dashboard**:

1. Go to: <https://vercel.com/your-account/hospeda-web/deployments>
2. Find previous working deployment
3. Click **⋯** (three dots)
4. Click **Promote to Production**

**Result**: Instant rollback (< 30 seconds)

**Via CLI**:

```bash
# Promote specific deployment to production
vercel promote <deployment-url> --scope your-account
```

**Example**:

```bash
vercel promote hospeda-web-ghi789.vercel.app --scope your-account
```

**Output**:

```text
Promoting deployment hospeda-web-ghi789.vercel.app to production...
✓ Promoted successfully
Live at https://hospeda.com
```

### Rollback to Specific Deployment

**Steps**:

1. **Identify target deployment** (see history above)
2. **Promote to production** (see Instant Rollback above)

**No need to rebuild** - previous deployment is already built and ready.

### Rollback via Git

**Alternative**: Revert git commit and redeploy.

**Steps**:

```bash
# 1. Identify bad commit
git log --oneline

# 2. Revert commit
git revert <commit-hash>

# 3. Push to GitHub
git push origin main

# 4. Vercel automatically deploys revert
```

**Duration**: ~2-5 minutes (requires rebuild)

**Use case**: When you want to preserve git history (audit trail).

### Testing Rollback

**Before promoting**, test previous deployment:

1. Find deployment URL (e.g., `hospeda-web-ghi789.vercel.app`)
2. Visit URL in browser
3. Test critical functionality
4. If all good, promote to production

**Smoke tests**:

```bash
# Test health
curl https://hospeda-web-ghi789.vercel.app/

# Test search
curl https://hospeda-web-ghi789.vercel.app/search?q=beach

# Test accommodation page
curl https://hospeda-web-ghi789.vercel.app/accommodations/abc123
```

### Rollback Checklist

**Before Rollback**:

- [ ] Identify issue (error logs, user reports)
- [ ] Find last known good deployment
- [ ] Test previous deployment
- [ ] Notify team

**During Rollback**:

- [ ] Promote previous deployment
- [ ] Verify rollback successful (visit <https://hospeda.com>)
- [ ] Monitor error rates (Sentry, Vercel dashboard)
- [ ] Test critical user flows

**After Rollback**:

- [ ] Confirm stability (30 minutes)
- [ ] Investigate root cause
- [ ] Fix issue
- [ ] Test fix locally
- [ ] Deploy fix
- [ ] Document incident

---

## Conclusion

You've completed the Vercel deployment guide for the Hospeda web application!

**Key Takeaways**:

- **Setup**: Easy integration with GitHub
- **Configuration**: `vercel.json` and `astro.config.mjs`
- **Deployment**: Automatic on push, preview on PR
- **Environment Variables**: Public (`PUBLIC_*`) vs private
- **Custom Domains**: Simple DNS configuration
- **Performance**: Edge caching, image optimization, analytics
- **Monitoring**: Logs, Web Vitals, error tracking
- **Rollback**: Instant rollback to any previous deployment

**Next Steps**:

1. Set up staging environment (separate Vercel project)
2. Configure preview deployments for all PRs
3. Set up monitoring and alerting (Sentry)
4. Configure custom domain
5. Enable Web Analytics and Speed Insights
6. Document deployment runbook

**Resources**:

- Vercel Docs: <https://vercel.com/docs>
- Astro Docs: <https://docs.astro.build>
- Vercel + Astro Guide: <https://vercel.com/docs/frameworks/astro>
- Hospeda Web Source: `/apps/web`

**Support**:

- Vercel Support: <https://vercel.com/support>
- Vercel Community: <https://github.com/vercel/vercel/discussions>
- Internal: #hospeda-devops Slack channel

---

**Deployment Status**: ✅ Ready for Production

**Last Updated**: 2025-01-05
**Author**: Tech Writer Agent
**Version**: 1.0.0
