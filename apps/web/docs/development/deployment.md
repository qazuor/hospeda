# Deployment Guide

Complete guide to deploying Hospeda Web App to Vercel.

---

## 📖 Overview

Hospeda Web App deploys to **Vercel** using automatic deployments from Git.

**Deployment Features**:

- 🚀 Automatic deployments from `main` branch
- 🔍 Preview deployments for Pull Requests
- 🌍 Global CDN
- 📊 Analytics and monitoring
- 🔄 Instant rollbacks
- 🔐 Environment variables management

**Deployment URL**: <https://hospeda.com.ar>

---

## 🚀 Initial Setup

### Prerequisites

- Vercel account (<https://vercel.com/signup>)
- GitHub/GitLab/Bitbucket repository
- Node.js 18+ locally

### Connect Repository

#### Option 1: Vercel Dashboard

1. Go to <https://vercel.com/new>
2. Click "Import Project"
3. Select your Git provider (GitHub)
4. Choose `hospeda` repository
5. Select `apps/web` as root directory
6. Click "Deploy"

#### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
cd apps/web
vercel link

# Deploy
vercel
```sql

---

## ⚙️ Build Configuration

### Vercel Configuration

Create `vercel.json` in project root if not exists:

```json
{
  "buildCommand": "pnpm --filter=web build",
  "devCommand": "pnpm --filter=web dev",
  "installCommand": "pnpm install",
  "framework": "astro",
  "outputDirectory": "apps/web/dist"
}
```markdown

### Astro Configuration

```ts
// apps/web/astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import react from '@astrojs/react';

export default defineConfig({
  output: 'hybrid', // SSG + SSR
  adapter: vercel({
    webAnalytics: { enabled: true },
    speedInsights: { enabled: true }
  }),
  integrations: [react()],
  site: 'https://hospeda.com.ar'
});
```markdown

### Build Settings in Dashboard

**Framework Preset**: Astro

**Build Command**:

```bash
pnpm --filter=web build
```text

**Install Command**:

```bash
pnpm install
```text

**Output Directory**:

```text
apps/web/dist
```text

**Node Version**: 18.x (or later)

---

## 🔐 Environment Variables

### Add Environment Variables

**In Vercel Dashboard**:

1. Go to Project Settings
2. Click "Environment Variables"
3. Add variables for each environment

**Required Variables**:

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_AUTH_TOKEN=...

# Clerk Authentication
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Site Configuration
PUBLIC_SITE_URL=https://hospeda.com.ar
PUBLIC_API_URL=https://api.hospeda.com.ar

# Optional: Analytics
PUBLIC_GA_TRACKING_ID=G-...
```markdown

### Environment-Specific Variables

**Production**:

```bash
DATABASE_URL=postgresql://prod-db...
PUBLIC_SITE_URL=https://hospeda.com.ar
```text

**Preview** (for PR deployments):

```bash
DATABASE_URL=postgresql://staging-db...
PUBLIC_SITE_URL=https://preview.hospeda.com.ar
```text

**Development** (local only):

```bash
DATABASE_URL=postgresql://localhost:5432/hospeda
PUBLIC_SITE_URL=http://localhost:4321
```markdown

### Access Environment Variables

```ts
// Server-side (all variables)
const dbUrl = import.meta.env.DATABASE_URL;

// Client-side (only PUBLIC_ variables)
const siteUrl = import.meta.env.PUBLIC_SITE_URL;
```text

---

## 🌍 Custom Domains

### Add Custom Domain

**In Vercel Dashboard**:

1. Go to Project Settings
2. Click "Domains"
3. Add `hospeda.com.ar`
4. Follow DNS configuration instructions

### DNS Configuration

Add these records to your DNS provider:

```text
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```text

**Verify**: Click "Verify" in Vercel dashboard

### SSL Certificate

Vercel automatically provisions SSL certificates via Let's Encrypt.

**Configuration**:

- Automatic HTTPS redirect
- HSTS enabled
- HTTP/2 enabled

---

## 🔍 Preview Deployments

### Automatic Preview Deployments

**Every Pull Request** gets a unique preview URL:

```text
https://hospeda-git-feature-branch.vercel.app
```text

**Features**:

- Isolated environment
- Separate database (staging)
- Full functionality testing
- Shareable URL for review

### Commenting on PRs

Vercel automatically comments on GitHub PRs with:

- Preview URL
- Build status
- Lighthouse scores
- Deployment logs

### Testing Preview Deployments

```bash
# Get preview URL from PR comment
# Example: https://hospeda-git-feature-auth.vercel.app

# Test the preview
curl https://hospeda-git-feature-auth.vercel.app
```text

---

## 🚀 Production Deployments

### Automatic Production Deployments

**Push to `main` branch** triggers production deployment:

```bash
git checkout main
git merge feature/new-feature
git push origin main

# Vercel automatically deploys to production
```markdown

### Manual Deployments

**Via CLI**:

```bash
# Deploy to production
vercel --prod

# Or promote a preview to production
vercel promote <deployment-url>
```text

**Via Dashboard**:

1. Go to Deployments tab
2. Find the deployment
3. Click "Promote to Production"

### Deployment Process

1. **Build**: Vercel runs build command
2. **Test**: Optional checks (if configured)
3. **Deploy**: Upload to global CDN
4. **Verify**: Health checks
5. **Live**: Traffic routed to new deployment

**Typical deployment time**: 1-3 minutes

---

## ⏪ Rollbacks

### Instant Rollback

**Via Dashboard**:

1. Go to Deployments tab
2. Find previous working deployment
3. Click "Promote to Production"
4. Confirm rollback

**Result**: Previous deployment becomes active in < 30 seconds

### Via CLI

```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <previous-deployment-url> --prod
```markdown

### Rollback Best Practices

- **Test before promoting**: Use preview deployments
- **Monitor after deployment**: Check error rates
- **Keep deployment history**: Don't delete old deployments
- **Document rollbacks**: Note why rollback was needed

---

## 📊 Monitoring & Analytics

### Vercel Analytics

**Enable in Dashboard**:

1. Project Settings → Analytics
2. Enable Web Analytics
3. Enable Speed Insights

**Metrics Tracked**:

- Page views
- Unique visitors
- Top pages
- Referrers
- Devices/browsers

**Access**: Dashboard → Analytics tab

### Vercel Speed Insights

**Real User Monitoring (RUM)**:

- Core Web Vitals
- Page load times
- Performance scores
- Device breakdown

**View**: Dashboard → Speed Insights tab

### Custom Analytics

```astro
---
// Add custom tracking
---

<script>
  // Track page views
  if (import.meta.env.PROD) {
    fetch('/api/analytics/pageview', {
      method: 'POST',
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer
      })
    });
  }
</script>
```markdown

### Error Tracking (Sentry)

```ts
// apps/web/src/lib/sentry.ts
import * as Sentry from '@sentry/astro';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.PUBLIC_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1
  });
}
```text

---

## 🔧 Advanced Configuration

### Custom Headers

```ts
// vercel.json
{
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
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=300, stale-while-revalidate=60"
        }
      ]
    }
  ]
}
```markdown

### Redirects

```ts
// vercel.json
{
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    },
    {
      "source": "/blog/:slug",
      "destination": "/publicaciones/:slug",
      "permanent": false
    }
  ]
}
```markdown

### Rewrites

```ts
// vercel.json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.hospeda.com.ar/:path*"
    }
  ]
}
```markdown

### Edge Functions

```ts
// apps/web/src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Runs on Vercel Edge Network
  console.log('Edge middleware:', context.url.pathname);

  return next();
});
```text

---

## ✅ Deployment Checklist

### Before First Deployment

- [ ] Repository connected to Vercel
- [ ] Build configuration verified
- [ ] Environment variables set
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Analytics enabled

### Before Each Production Deployment

- [ ] All tests passing (`pnpm test`)
- [ ] TypeScript checks pass (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Build succeeds locally (`pnpm build`)
- [ ] Preview deployment tested
- [ ] Lighthouse score > 95
- [ ] No console errors in browser
- [ ] Database migrations applied
- [ ] Environment variables updated

### After Production Deployment

- [ ] Production site loads correctly
- [ ] No console errors
- [ ] Analytics tracking works
- [ ] Forms submit correctly
- [ ] Authentication works
- [ ] API endpoints respond
- [ ] Images load properly
- [ ] No broken links
- [ ] Monitor error rates
- [ ] Check Core Web Vitals

---

## 🚫 Common Deployment Issues

### Issue 1: Build Fails

**Problem**:

```text
Error: Cannot find module '@repo/db'
```text

**Solution**:

```bash
# Ensure all dependencies are in package.json
cd apps/web
pnpm install

# Test build locally
pnpm build
```markdown

### Issue 2: Environment Variables Missing

**Problem**:

```text
Error: DATABASE_URL is not defined
```text

**Solution**:

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add missing variables
3. Redeploy

### Issue 3: 404 on Dynamic Routes

**Problem**:

```text
/alojamientos/hotel-test returns 404
```text

**Solution**:

```astro
---
// Ensure getStaticPaths is defined
export const getStaticPaths = async () => {
  // Return all paths
};
---
```markdown

### Issue 4: Slow Build Times

**Problem**: Build takes > 5 minutes

**Solution**:

```ts
// Optimize getStaticPaths
export const getStaticPaths = async () => {
  // ❌ Bad: Sequential fetches
  const paths = [];
  for (const item of items) {
    const details = await fetchDetails(item.id);
    paths.push({ params: { slug: item.slug }, props: { details } });
  }

  // ✅ Good: Parallel fetches
  const [items, allDetails] = await Promise.all([
    fetchItems(),
    fetchAllDetails()
  ]);

  return items.map(item => ({
    params: { slug: item.slug },
    props: { details: allDetails[item.id] }
  }));
};
```markdown

### Issue 5: Client-Side Hydration Fails

**Problem**: React components don't hydrate

**Solution**:

```astro
<!-- ❌ Bad: Missing client directive -->
<SearchForm />

<!-- ✅ Good: Add client directive -->
<SearchForm client:load />
```text

---

## 📖 Vercel CLI Commands

### Useful Commands

```bash
# Login
vercel login

# Link project
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# List deployments
vercel ls

# View logs
vercel logs <deployment-url>

# Inspect deployment
vercel inspect <deployment-url>

# Remove deployment
vercel rm <deployment-url>

# Pull environment variables
vercel env pull

# Add environment variable
vercel env add
```text

---

## 🔒 Security Best Practices

### 1. Protect Sensitive Routes

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Protect admin routes
  if (context.url.pathname.startsWith('/admin')) {
    const { userId } = getAuth(context);

    if (!userId) {
      return context.redirect('/auth/signin');
    }
  }

  return next();
});
```markdown

### 2. Rate Limiting

```ts
// Use Vercel Edge Config or Upstash Redis
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  limiter: Ratelimit.slidingWindow(10, '10 s')
});

export const GET: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response('Too many requests', { status: 429 });
  }

  // Handle request
};
```markdown

### 3. HTTPS Only

Vercel automatically redirects HTTP to HTTPS.

**Verify**: Force HTTPS in headers

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

---

## 📖 Additional Resources

### Internal Documentation

- **[Performance Guide](performance.md)** - Optimize before deployment
- **[SEO Guide](seo.md)** - SEO configuration
- **[Debugging Guide](debugging.md)** - Debug deployment issues

### External Resources

- **[Vercel Docs](https://vercel.com/docs)** - Official Vercel documentation
- **[Astro Deployment](https://docs.astro.build/en/guides/deploy/vercel/)** - Astro on Vercel
- **[Vercel CLI](https://vercel.com/docs/cli)** - CLI reference

---

⬅️ Back to [Development Guide](README.md)
