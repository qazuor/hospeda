# Deployment Guide

Deploying the Hospeda API.

---

## Vercel Deployment

The API is deployed on **Vercel** with the rest of the monorepo.

### Prerequisites

- Vercel account
- Project linked to Git repository
- Environment variables configured

### Environment Variables

Configure in Vercel Dashboard:

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# CORS
CORS_ORIGIN=https://hospeda.com,https://admin.hospeda.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Deployment

```bash
# From project root
pnpm vercel --prod

# Or via Git push (automatic)
git push origin main
```

### Verify Deployment

```bash
# Check health
curl https://api.hospeda.com/health

# Check OpenAPI
curl https://api.hospeda.com/docs
```

---

## Database Migrations

### Run Migrations

```bash
# From local, against production DB
DATABASE_URL=<prod-url> pnpm db:migrate
```

### Verify Migrations

```bash
# Check with Drizzle Studio
DATABASE_URL=<prod-url> pnpm db:studio
```

---

## Monitoring

### Check Logs

```bash
# Vercel logs
pnpm vercel logs

# Or via Vercel Dashboard
```

### Metrics

```bash
# Production metrics
curl https://api.hospeda.com/metrics
```

---

## Rollback

### Revert Deployment

```bash
# Via Vercel Dashboard
# Select previous deployment
# Click "Promote to Production"
```

### Revert Database

```bash
# Restore from backup
# Or run down migrations
```

---

## Best Practices

- Test locally before deploying
- Run migrations before deployment
- Monitor logs after deployment
- Have rollback plan ready
- Use environment variables for config
- Test health endpoint post-deployment

---

⬅️ Back to [Development Guide](README.md)
