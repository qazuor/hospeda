# Deployment Guide

Complete guide to deploying the Hospeda Admin Dashboard to Vercel.

---

## 📖 Overview

The admin dashboard is deployed to **Vercel**, the platform built by the creators of Next.js and with excellent support for TanStack Start applications. This guide covers everything from initial setup to production deployment and monitoring.

**What you'll learn:**

- Project configuration for Vercel
- Environment variables setup
- Build configuration
- Deployment workflow
- Preview deployments
- Production deployment
- Custom domains
- Monitoring and logs
- Performance optimization
- Troubleshooting deployment issues

**Prerequisites:**

- Git repository set up
- Admin app running locally
- Vercel account (free tier available)
- Basic understanding of environment variables

---

## 🎯 Quick Start

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

## ⚙️ Project Configuration

### vercel.json

Create `apps/admin/vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": null,
  "outputDirectory": ".vinxi/output/public",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "VITE_CLERK_PUBLISHABLE_KEY": "@clerk-publishable-key"
    }
  }
}
```

**Key settings:**

- `buildCommand` - Command to build the app
- `outputDirectory` - Where build files are located
- `regions` - Deployment regions (iad1 = US East)
- `env` - Environment variables for build

### Package Scripts

Verify `apps/admin/package.json`:

```json
{
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start",
    "serve": "vinxi start",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

### Build Settings in Vercel Dashboard

**Framework Preset:** Other

**Build Command:**

```bash
cd apps/admin && pnpm build
```

**Output Directory:**

```
apps/admin/.vinxi/output/public
```

**Install Command:**

```bash
pnpm install
```

**Root Directory:** Leave as `/` (monorepo root)

---

## 🔐 Environment Variables

### Required Variables

**Clerk Authentication:**

```env
# Public (VITE_ prefix = exposed to client)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Secret (server-only)
CLERK_SECRET_KEY=sk_live_...
```

**API Configuration:**

```env
VITE_API_URL=https://api.hospeda.com
```

### Setting Variables in Vercel

**Via Dashboard:**

1. Go to project settings
2. Navigate to "Environment Variables"
3. Add variables:
   - Name: `VITE_CLERK_PUBLISHABLE_KEY`
   - Value: `pk_live_...`
   - Environment: Production, Preview, Development
4. Click "Save"

**Via CLI:**

```bash
# Set production variable
vercel env add VITE_CLERK_PUBLISHABLE_KEY production

# Set preview variable
vercel env add VITE_CLERK_PUBLISHABLE_KEY preview

# Pull environment variables locally
vercel env pull .env.local
```

### Environment Variable Types

**Public variables (client-accessible):**

```env
# These are bundled into client code
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://api.hospeda.com
VITE_APP_NAME=Hospeda Admin
```

**Secret variables (server-only):**

```env
# These are NEVER exposed to client
CLERK_SECRET_KEY=sk_live_...
DATABASE_URL=postgresql://...
INTERNAL_API_SECRET=...
```

### Using Environment Variables

**Client-side:**

```tsx
// Only VITE_ prefixed variables
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const apiUrl = import.meta.env.VITE_API_URL;

// ❌ This is undefined in client code
const secret = import.meta.env.CLERK_SECRET_KEY; // undefined
```

**Server-side:**

```tsx
// Server functions have access to all variables
import { createServerFn } from '@tanstack/react-start';

export const checkAuth = createServerFn({ method: 'GET' })
  .handler(async () => {
    // Has access to secret key
    const secret = process.env.CLERK_SECRET_KEY;

    // Server-side logic
  });
```

---

## 🚀 Deployment Workflow

### Git-Based Deployment

**Automatic deployment on push:**

1. Configure in Vercel Dashboard:
   - Settings → Git
   - Connect GitHub/GitLab/Bitbucket
   - Select repository
   - Set production branch (usually `main`)

2. Push code:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

3. Vercel automatically:
   - Detects push
   - Runs build
   - Deploys to production
   - Updates domain

### Branch-Based Deployments

**Preview deployments:**

```bash
# Create feature branch
git checkout -b feature/new-dashboard

# Make changes
git add .
git commit -m "feat: new dashboard design"
git push origin feature/new-dashboard

# Vercel creates preview deployment
# URL: new-dashboard-hospeda-admin.vercel.app
```

**Benefits:**

- Test changes before merging
- Share with team for review
- Automatic SSL certificate
- Isolated environment

### Manual Deployment

**Via CLI:**

```bash
# Preview deployment
cd apps/admin
vercel

# Production deployment
vercel --prod

# Deploy specific branch
git checkout feature-branch
vercel --prod
```

---

## 🔍 Preview Deployments

### What Are Preview Deployments?

- Created for every push to non-production branch
- Unique URL for each deployment
- Full production-like environment
- Automatic HTTPS
- Access to environment variables

### Preview URL Format

```text
<branch-name>-<project-name>.vercel.app

Examples:
- feature-auth-hospeda-admin.vercel.app
- fix-bug-hospeda-admin.vercel.app
- develop-hospeda-admin.vercel.app
```

### Using Preview Deployments

**1. Push to branch:**

```bash
git checkout -b feature/new-ui
git push origin feature/new-ui
```

**2. Get preview URL:**

- Check GitHub PR comments (Vercel bot)
- Or Vercel dashboard → Deployments
- Or CLI output

**3. Test preview:**

```bash
# Visit preview URL
https://feature-new-ui-hospeda-admin.vercel.app

# Test features
# Share with team
# Get feedback
```

**4. Merge to production:**

```bash
git checkout main
git merge feature/new-ui
git push origin main

# Production auto-deploys
```

---

## 🌐 Custom Domains

### Adding a Domain

**Via Dashboard:**

1. Project settings → Domains
2. Add domain: `admin.hospeda.com`
3. Configure DNS:

```text
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
```

4. Wait for DNS propagation (5-30 minutes)
5. Vercel automatically provisions SSL

**Via CLI:**

```bash
# Add domain
vercel domains add admin.hospeda.com

# List domains
vercel domains ls

# Remove domain
vercel domains rm admin.hospeda.com
```

### SSL Certificates

**Automatic SSL:**

- Vercel provides free SSL certificates
- Auto-renewal
- No configuration needed
- Issued by Let's Encrypt

**Custom SSL:**

```text
For custom SSL certificates:
1. Go to project settings
2. Navigate to Security → SSL
3. Upload certificate and private key
```

### Domain Redirects

**Redirect www to apex:**

```json
// vercel.json
{
  "redirects": [
    {
      "source": "www.admin.hospeda.com",
      "destination": "https://admin.hospeda.com",
      "permanent": true
    }
  ]
}
```

---

## 📊 Monitoring & Logs

### Deployment Logs

**View build logs:**

1. Vercel Dashboard → Deployments
2. Click deployment
3. View "Building" logs

**Common log sections:**

```text
[1/5] Installing dependencies
  pnpm install
  ✓ Dependencies installed

[2/5] Building application
  vinxi build
  ✓ Build complete

[3/5] Uploading build output
  ✓ Upload complete

[4/5] Deploying
  ✓ Deployment ready

[5/5] Assigning domains
  ✓ admin.hospeda.com → deployment
```

### Runtime Logs

**View serverless function logs:**

1. Vercel Dashboard → Project
2. Click "Logs" tab
3. Filter by:
   - Time range
   - Status code
   - Search query

**Log output:**

```text
[GET] /api/accommodations
Status: 200
Duration: 150ms
Memory: 64MB

[GET] /api/accommodations/123
Status: 404
Duration: 50ms
Error: Accommodation not found
```

### Real-Time Monitoring

**Via CLI:**

```bash
# Stream logs in real-time
vercel logs <deployment-url> --follow

# Filter by status
vercel logs <deployment-url> --since 1h --status 500
```

### Analytics

**Vercel Analytics (optional addon):**

- Page views
- Unique visitors
- Top pages
- Geographic distribution
- Performance metrics

**Enable in Dashboard:**

1. Project settings → Analytics
2. Enable Vercel Analytics
3. Add to code:

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

## ⚡ Performance Optimization

### Build Optimization

**Enable caching:**

```json
// vercel.json
{
  "github": {
    "enabled": true,
    "autoJobCancelation": true
  },
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "cache": true
      }
    }
  ]
}
```

**Optimize dependencies:**

```bash
# Remove unused dependencies
pnpm prune

# Update to latest versions
pnpm update

# Check bundle size
pnpm build
# Check .vinxi/output size
```

### Runtime Optimization

**Function regions:**

```json
// vercel.json
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
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

### Image Optimization

**Use Vercel Image Optimization:**

```tsx
import { Image } from '@tanstack/react-start';

<Image
  src="/accommodation.jpg"
  alt="Beach House"
  width={800}
  height={600}
  quality={80}
/>
```

---

## 🐛 Troubleshooting

### Build Failures

**Issue: "Build failed with exit code 1"**

**Check:**

1. Build logs in Vercel dashboard
2. Run build locally:

```bash
cd apps/admin
pnpm build
```

3. Common causes:
   - TypeScript errors
   - Missing dependencies
   - Environment variables not set
   - Import errors

**Solution:**

```bash
# Fix TypeScript errors
pnpm typecheck

# Install missing dependencies
pnpm install

# Verify build works locally
pnpm build
```

### Deployment Errors

**Issue: "Deployment failed to start"**

**Check:**

1. Runtime logs in Vercel dashboard
2. Environment variables are set
3. Build output directory is correct

**Solution:**

```json
// Verify vercel.json
{
  "outputDirectory": ".vinxi/output/public",
  "buildCommand": "pnpm build"
}
```

### Function Timeouts

**Issue: "Function execution timed out"**

**Solution:**

```json
// Increase function timeout
// vercel.json
{
  "functions": {
    "apps/admin/src/routes/**/*.tsx": {
      "maxDuration": 30
    }
  }
}
```

### Environment Variable Issues

**Issue: "Environment variable undefined"**

**Check:**

1. Variable is set in Vercel dashboard
2. Variable name is correct (case-sensitive)
3. For client variables, use `VITE_` prefix
4. Redeploy after adding variables

**Solution:**

```bash
# Pull environment variables
vercel env pull .env.local

# Verify variables are set
cat .env.local

# Redeploy
vercel --prod
```

---

## 🔒 Security Best Practices

### Environment Variables

**✅ DO:**

```bash
# Use secrets for sensitive data
CLERK_SECRET_KEY=sk_live_...

# Never commit secrets to git
# Add to .gitignore:
.env.local
.env.production
```

**❌ DON'T:**

```bash
# Don't expose secrets in client code
VITE_SECRET_KEY=sk_live_...  # ❌ VITE_ prefix exposes to client
```

### Security Headers

```json
// vercel.json
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
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### Rate Limiting

**Via Vercel Edge Config:**

```json
// vercel.json
{
  "functions": {
    "apps/admin/src/routes/api/**/*.tsx": {
      "memory": 1024,
      "maxDuration": 10,
      "regions": ["iad1"]
    }
  }
}
```

---

## 💡 Best Practices

### Deployment Checklist

**Before deploying:**

- [ ] All tests pass locally
- [ ] TypeScript checks pass
- [ ] Build succeeds locally
- [ ] Environment variables configured
- [ ] Secrets not in code
- [ ] .env.local in .gitignore
- [ ] Dependencies updated
- [ ] Changelog updated

**After deploying:**

- [ ] Verify deployment URL works
- [ ] Test critical user flows
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Verify custom domains work

### Git Workflow

**✅ DO:**

```bash
# Use feature branches
git checkout -b feature/new-feature

# Push to get preview deployment
git push origin feature/new-feature

# Test preview deployment
# Get feedback

# Merge to main when ready
git checkout main
git merge feature/new-feature
git push origin main
```

### Rollback Strategy

**Instant rollback:**

1. Go to Vercel Dashboard
2. Click "Deployments"
3. Find last working deployment
4. Click "..." → "Promote to Production"

**Or via CLI:**

```bash
# List deployments
vercel ls

# Promote specific deployment
vercel promote <deployment-url>
```

---

## 📖 Additional Resources

### Official Documentation

- **[Vercel Documentation](https://vercel.com/docs)** - Complete Vercel docs
- **[Vercel CLI](https://vercel.com/docs/cli)** - CLI reference
- **[TanStack Start Deployment](https://tanstack.com/start/latest/docs/framework/react/guide/deployment)** - Framework-specific guide

### Internal Resources

- **[Environment Variables Guide](../configuration.md)** - Environment setup
- **[Architecture Overview](../architecture.md)** - System architecture

### Support

- **Vercel Support:** <support@vercel.com>
- **Vercel Community:** [GitHub Discussions](https://github.com/vercel/vercel/discussions)
- **TanStack Discord:** [Join Server](https://discord.gg/tanstack)

---

⬅️ Back to [Development Documentation](./README.md)
