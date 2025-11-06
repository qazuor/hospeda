# API Deployment Guide - Fly.io

Complete guide for deploying the Hospeda Hono API to Fly.io.

**Last Updated**: 2025-01-05
**Target Platform**: Fly.io
**Framework**: Hono (Node.js)
**Version**: 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Deployment Process](#deployment-process)
5. [Environment Variables](#environment-variables)
6. Scaling & Performance
7. Monitoring & Logs
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)
10. [Advanced Topics](#advanced-topics)

---

## Overview

### About the API

The Hospeda API is a Hono-based backend service that provides:

- RESTful API endpoints for the web and admin applications
- Authentication via Clerk
- Database access via Drizzle ORM (PostgreSQL on Neon)
- Payment processing via Mercado Pago
- Image storage via Cloudinary
- Error tracking via Sentry

**Architecture**:

```text
┌─────────────┐
│   Client    │ (Web/Admin Apps)
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────┐
│  Fly.io     │ (Global Edge Network)
│  Proxy      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  API App    │ (Hono Server - Node.js)
│  Container  │
└──────┬──────┘
       │
       ├─→ Neon PostgreSQL (Database)
       ├─→ Clerk (Authentication)
       ├─→ Mercado Pago (Payments)
       ├─→ Cloudinary (Images)
       └─→ Sentry (Error Tracking)
```

### Why Fly.io?

**Advantages**:

- **Global Edge Network**: Deploy close to users worldwide
- **Zero-Downtime Deployments**: Rolling deployments with health checks
- **Automatic SSL**: Free SSL certificates via Let's Encrypt
- **Docker-Based**: Flexible container deployment
- **Scaling**: Easy horizontal and vertical scaling
- **Cost-Effective**: Pay only for what you use
- **PostgreSQL Support**: Built-in PostgreSQL if needed (we use Neon)

**Use Cases**:

- Production API deployment
- Staging environments
- Preview deployments
- Geographic load distribution

### Deployment Architecture

**Single Region Deployment** (recommended for MVP):

```text
Region: gru (São Paulo, Brazil - closest to Argentina)

┌──────────────────────────────────┐
│      Fly.io Edge (Global)        │
│  - SSL Termination               │
│  - Load Balancing                │
│  - DDoS Protection               │
└────────────┬─────────────────────┘
             │
             ↓
      ┌──────────────┐
      │  GRU Region  │
      │  (São Paulo) │
      └──────┬───────┘
             │
        ┌────┴────┐
        ↓         ↓
    ┌──────┐  ┌──────┐
    │ VM 1 │  │ VM 2 │  (Auto-scaled)
    └──────┘  └──────┘
```

**Multi-Region Deployment** (future):

```text
Primary: gru (São Paulo)
Secondary: iad (Virginia, USA)
Tertiary: mad (Madrid, Spain)
```

### Key Specifications

- **Runtime**: Node.js 20.x LTS
- **Port**: 3000 (internal), 80/443 (external)
- **Build Tool**: pnpm + TurboRepo
- **Output**: `dist/index.js` (bundled ESM)
- **Health Check**: `GET /health`
- **Startup Time**: ~2-5 seconds
- **Memory**: 512MB (minimum), 1GB (recommended)
- **CPU**: Shared (minimum), 1 core (recommended)

### Deployment Flow

```text
Local Changes
    ↓
Git Commit & Push
    ↓
CI/CD (GitHub Actions)
    ↓
Build Docker Image
    ↓
Push to Fly.io Registry
    ↓
Deploy to Fly.io
    ↓
Health Checks
    ↓
Traffic Routing
    ↓
Production Live ✓
```

---

## Prerequisites

### Required Accounts

#### 1. Fly.io Account

**Sign Up**:

```bash
# Visit https://fly.io/app/sign-up
# Options:
# - GitHub OAuth (recommended)
# - Email + Password
```

**Account Verification**:

- Email verification required
- Credit card required (even for free tier)
- Free allowances: 3 VMs with shared CPU, 3GB storage, 160GB outbound transfer/month

**Pricing Tier** (as of 2024):

- **Free Tier**: 3 shared-cpu-1x VMs, 3GB storage
- **Hobby**: $1.94/month per VM (shared-cpu-1x, 256MB RAM)
- **Scale**: $7.50/month per VM (dedicated-cpu-1x, 1GB RAM)

**Recommended for Production**: Scale tier (1-2 VMs)

#### 2. GitHub Account

Required for:

- Code repository
- CI/CD with GitHub Actions
- Fly.io integration (optional)

#### 3. Neon Database

- Already set up in previous deployment docs
- Connection string: `HOSPEDA_DATABASE_URL`

#### 4. Clerk Account

- Already set up for authentication
- API keys: `HOSPEDA_CLERK_SECRET_KEY`, `HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Install Fly.io CLI

#### macOS

**Via Homebrew**:

```bash
brew install flyctl
```

**Via Install Script**:

```bash
curl -L https://fly.io/install.sh | sh
```

**Add to PATH**:

```bash
# Add to ~/.zshrc or ~/.bash_profile
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

# Reload shell
source ~/.zshrc  # or source ~/.bash_profile
```

#### Linux

```bash
curl -L https://fly.io/install.sh | sh
```

**Add to PATH**:

```bash
# Add to ~/.bashrc or ~/.zshrc
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

#### Windows

**Via PowerShell** (Run as Administrator):

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Via Scoop**:

```powershell
scoop install flyctl
```

#### Verify Installation

```bash
flyctl version
# Output: flyctl v0.2.xxx
```

### Authenticate with Fly.io

#### Browser Authentication (Recommended)

```bash
flyctl auth login
```

This will:

1. Open your browser
2. Prompt you to authorize flyctl
3. Save authentication token locally (`~/.fly/config.yml`)

**Output**:

```text
Opening https://fly.io/app/auth/cli/xxx in your browser...
Waiting for authentication...
Successfully logged in as your-email@example.com
```

#### Token Authentication (CI/CD)

For GitHub Actions or other CI/CD:

```bash
# Get your token from https://fly.io/user/personal_access_tokens
export FLY_API_TOKEN="your-token-here"

# Verify
flyctl auth whoami
```

**Store in GitHub Secrets**:

```bash
# GitHub repository → Settings → Secrets → Actions
# Add: FLY_API_TOKEN = your-token-here
```

### Verify Prerequisites

Run this checklist before proceeding:

```bash
# 1. Fly.io CLI installed
flyctl version

# 2. Authenticated
flyctl auth whoami

# 3. Node.js version
node --version  # Should be v20.x.x

# 4. PNPM installed
pnpm --version  # Should be v8.15.6+

# 5. Docker installed (for local testing)
docker --version

# 6. Project dependencies installed
cd /path/to/hospeda
pnpm install

# 7. API builds successfully
cd apps/api
pnpm build
# Should create dist/index.js

# 8. Environment variables ready
# Check .env.example for all required variables
cat .env.example
```

**All checks passed?** ✓ Ready to proceed!

---

## Initial Setup

### Step 1: Create Fly.io App

Navigate to the API directory:

```bash
cd /path/to/hospeda/apps/api
```

#### Initialize Fly.io App

```bash
flyctl launch --no-deploy
```

**Interactive Prompts**:

```text
? Choose an app name (leave blank to generate one): hospeda-api
? Choose a region for deployment: São Paulo, Brazil (gru)
? Would you like to set up a PostgreSQL database now? No
? Would you like to set up an Upstash Redis database now? No
? Would you like to deploy now? No
```

**What This Does**:

- Creates a `fly.toml` configuration file
- Registers the app with Fly.io
- Configures the region
- Does NOT deploy yet (we need to configure first)

**Expected Output**:

```text
Created app 'hospeda-api' in organization 'personal'
Admin URL: https://fly.io/apps/hospeda-api
Hostname: hospeda-api.fly.dev
Wrote config file fly.toml
```

#### Alternative: Manual App Creation

If you prefer manual control:

```bash
flyctl apps create hospeda-api --org personal
```

Then create `fly.toml` manually (see below).

### Step 2: Configure fly.toml

The `fly.toml` file defines your app configuration. Here's the complete configuration:

**File**: `apps/api/fly.toml`

```toml
# Fly.io Application Configuration
# App: hospeda-api (Hono API)
# Version: 1.0.0

app = "hospeda-api"
primary_region = "gru"  # São Paulo, Brazil
kill_signal = "SIGINT"
kill_timeout = "5s"

[build]
  # Use Dockerfile from monorepo root
  dockerfile = "../../Dockerfile.api"
  # Build context is the monorepo root
  # This allows access to all packages/

[env]
  # Node.js environment
  NODE_ENV = "production"
  PORT = "3000"

  # Logging
  LOG_LEVEL = "info"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false  # Keep at least 1 running
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [http_service.concurrency]
    type = "requests"
    soft_limit = 200
    hard_limit = 250

[[http_service.checks]]
  interval = "15s"
  timeout = "10s"
  grace_period = "5s"
  method = "GET"
  path = "/health"
  protocol = "http"

  [http_service.checks.headers]
    X-Health-Check = "fly.io"

[[vm]]
  size = "shared-cpu-1x"  # 1 shared CPU, 256MB RAM (Hobby tier)
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

# Metrics endpoint (for Fly.io dashboard)
[metrics]
  port = 9091
  path = "/metrics"
```

**Configuration Breakdown**:

#### App Settings

```toml
app = "hospeda-api"           # Must match Fly.io app name
primary_region = "gru"        # São Paulo (closest to Argentina)
kill_signal = "SIGINT"        # Graceful shutdown signal
kill_timeout = "5s"           # Wait 5s for graceful shutdown
```

#### Build Configuration

```toml
[build]
  dockerfile = "../../Dockerfile.api"
```

**Important**: The Dockerfile is at the monorepo root (`Dockerfile.api`), not in `apps/api/`.

**Dockerfile Location**:

```text
hospeda/
├── Dockerfile.api       ← Build configuration
├── apps/
│   └── api/
│       └── fly.toml     ← Deployment configuration
└── packages/            ← Shared packages
```

#### Metrics endpoint Environment Variables

```toml
[env]
  NODE_ENV = "production"
  PORT = "3000"
  LOG_LEVEL = "info"
```

**Non-Sensitive Only**: Secrets go in Fly.io secrets (see [Environment Variables](#environment-variables) section).

#### HTTP Service

```toml
[http_service]
  internal_port = 3000        # App listens on port 3000
  force_https = true          # Redirect HTTP → HTTPS
  auto_stop_machines = false  # Always keep at least 1 running
  auto_start_machines = true  # Start machines on request
  min_machines_running = 1    # Minimum 1 for zero-downtime
```

**Concurrency Limits**:

```toml
[http_service.concurrency]
  type = "requests"
  soft_limit = 200  # Start scaling at 200 concurrent requests
  hard_limit = 250  # Max 250 concurrent requests per machine
```

#### Metrics endpoint Health Checks

```toml
[[http_service.checks]]
  interval = "15s"     # Check every 15 seconds
  timeout = "10s"      # Fail if no response in 10s
  grace_period = "5s"  # Wait 5s after startup before checking
  method = "GET"
  path = "/health"
  protocol = "http"
```

**Health Check Endpoint**:

Your API must implement `GET /health`:

```typescript
// apps/api/src/routes/health.route.ts
import { Hono } from 'hono';

const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { health };
```

#### VM Resources

```toml
[[vm]]
  size = "shared-cpu-1x"  # Fly.io machine size
  memory = "512mb"         # RAM allocation
  cpu_kind = "shared"      # Shared CPU (cost-effective)
  cpus = 1
```

**Available Sizes**:

| Size | CPUs | Memory | Type | Cost/Month |
|------|------|--------|------|------------|
| shared-cpu-1x | 1 shared | 256MB | Hobby | $1.94 |
| shared-cpu-1x | 1 shared | 512MB | Hobby | $3.88 |
| shared-cpu-1x | 1 shared | 1GB | Hobby | $5.82 |
| dedicated-cpu-1x | 1 dedicated | 2GB | Scale | $29.00 |
| dedicated-cpu-2x | 2 dedicated | 4GB | Scale | $58.00 |

**Recommendation**: Start with `shared-cpu-1x` + 512MB, scale up if needed.

### Step 3: Create Dockerfile

The Dockerfile is located at the monorepo root.

**File**: `Dockerfile.api`

```dockerfile
# Dockerfile for Hospeda API (Hono)
# Multi-stage build for optimized production image

# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.6

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# Install dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Stage 3: Build
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Build API
RUN pnpm --filter=api build

# Stage 4: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm (production)
RUN npm install -g pnpm@8.15.6

# Copy package files for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy shared packages (compiled)
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/service-core/dist ./packages/service-core/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run application
CMD ["node", "apps/api/dist/index.js"]
```

**Dockerfile Breakdown**:

#### Run application Stage 1: Base

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm@8.15.6
```

- **Alpine Linux**: Minimal image (~50MB vs ~300MB for standard Node)
- **Node.js 20 LTS**: Long-term support
- **pnpm**: Package manager for monorepo

#### Run application Stage 2: Dependencies

```dockerfile
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/
RUN pnpm install --frozen-lockfile
```

- **Copy package files only**: Leverage Docker layer caching
- **Install all dependencies**: Including dev dependencies for build
- **Frozen lockfile**: Ensure reproducible builds

#### Run application Stage 3: Build

```dockerfile
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter=api build
```

- **Copy dependencies**: From deps stage
- **Copy source code**: All apps and packages
- **Build API**: Creates `apps/api/dist/index.js`

#### Run application Stage 4: Production

```dockerfile
FROM node:20-alpine AS runner
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/*/dist ./packages/*/dist
CMD ["node", "apps/api/dist/index.js"]
```

- **Fresh Alpine image**: Clean production environment
- **Production dependencies only**: Smaller image
- **Copy built artifacts**: Compiled JavaScript only
- **Run application**: Start Node.js server

**Image Size Optimization**:

- **Without multi-stage**: ~800MB
- **With multi-stage**: ~150MB
- **Savings**: 81% reduction

### Step 4: Configure Regions

Fly.io deploys to specific regions. Choose regions closest to your users.

#### List Available Regions

```bash
flyctl platform regions
```

**Output**:

```text
CODE  NAME                     GATEWAY
ams   Amsterdam, Netherlands   ✓
arn   Stockholm, Sweden        ✓
atl   Atlanta, Georgia (US)    ✓
bog   Bogotá, Colombia         ✓
bos   Boston, Massachusetts    ✓
cdg   Paris, France            ✓
den   Denver, Colorado (US)    ✓
dfw   Dallas, Texas (US)       ✓
ewr   Secaucus, NJ (US)        ✓
fra   Frankfurt, Germany       ✓
gdl   Guadalajara, Mexico      ✓
gru   São Paulo, Brazil        ✓  ← Recommended (closest to Argentina)
hkg   Hong Kong                ✓
iad   Ashburn, Virginia (US)   ✓
jnb   Johannesburg             ✓
lax   Los Angeles              ✓
lhr   London, United Kingdom   ✓
mad   Madrid, Spain            ✓
mia   Miami, Florida (US)      ✓
nrt   Tokyo, Japan             ✓
ord   Chicago, Illinois (US)   ✓
scl   Santiago, Chile          ✓  ← Alternative for South America
sea   Seattle, Washington      ✓
sin   Singapore                ✓
sjc   San Jose, California     ✓
syd   Sydney, Australia        ✓
yyz   Toronto, Canada          ✓
```

#### Set Primary Region

Already set in `fly.toml`:

```toml
primary_region = "gru"  # São Paulo, Brazil
```

**Why GRU (São Paulo)?**

- **Proximity**: Closest to Concepción del Uruguay, Argentina (~1,200km)
- **Latency**: ~20-30ms from Argentina
- **Cost**: Standard pricing
- **Reliability**: Major Fly.io region

#### Add Backup Regions (Optional)

For high availability, add backup regions:

```bash
flyctl regions add scl  # Santiago, Chile
flyctl regions add iad  # Ashburn, Virginia (US)
```

**View Current Regions**:

```bash
flyctl regions list
```

**Output**:

```text
Region Pool:
gru (primary)
scl (backup)
iad (backup)
```

**Note**: Backup regions are used if primary region is unavailable. They increase costs (more VMs).

### Step 5: Configure Resources

Define compute resources for your VMs.

#### View Current Configuration

```bash
flyctl status --app hospeda-api
```

#### Update VM Size

**Via fly.toml** (recommended):

```toml
[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

**Via CLI**:

```bash
flyctl scale vm shared-cpu-1x --memory 512 --app hospeda-api
```

#### Step 5: Scale Machine Count

**Add more machines** (horizontal scaling):

```bash
flyctl scale count 2 --app hospeda-api
```

**Result**: 2 VMs in the primary region, traffic load-balanced between them.

**View Scaling**:

```bash
flyctl scale show --app hospeda-api
```

**Output**:

```text
VM Resources for app: hospeda-api

VM Size: shared-cpu-1x
VM Memory: 512 MB
Count: 2
```

#### Resource Recommendations

**Development/Staging**:

- Size: `shared-cpu-1x`
- Memory: `256mb`
- Count: `1`
- Cost: ~$1.94/month

**Production (MVP)**:

- Size: `shared-cpu-1x`
- Memory: `512mb`
- Count: `2` (redundancy)
- Cost: ~$7.76/month

**Production (Growth)**:

- Size: `shared-cpu-1x`
- Memory: `1gb`
- Count: `3`
- Cost: ~$17.46/month

**Production (High Traffic)**:

- Size: `dedicated-cpu-1x`
- Memory: `2gb`
- Count: `3-5`
- Cost: ~$87-145/month

### Step 6: Set Up Secrets

Secrets are environment variables that contain sensitive data (API keys, database URLs, etc.).

**Never commit secrets to git!**

#### List Required Secrets

From `apps/api/.env.example`:

```bash
# Database
HOSPEDA_DATABASE_URL="postgresql://..."

# Authentication
HOSPEDA_CLERK_SECRET_KEY="sk_live_..."
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."

# Payments
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."

# Image Storage
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Error Tracking
SENTRY_DSN="https://...@sentry.io/..."

# API Configuration
API_PORT="3000"
API_CORS_ORIGIN="https://hospeda.com,https://admin.hospeda.com"
```

#### Set Secrets via CLI

**Single secret**:

```bash
flyctl secrets set HOSPEDA_DATABASE_URL="postgresql://user:pass@host/db" --app hospeda-api
```

**Multiple secrets** (recommended):

```bash
flyctl secrets set \
  HOSPEDA_DATABASE_URL="postgresql://user:pass@host/db" \
  HOSPEDA_CLERK_SECRET_KEY="sk_live_xxx" \
  HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxx" \
  MERCADO_PAGO_ACCESS_TOKEN="APP_USR-xxx" \
  CLOUDINARY_CLOUD_NAME="hospeda" \
  CLOUDINARY_API_KEY="xxx" \
  CLOUDINARY_API_SECRET="xxx" \
  SENTRY_DSN="https://xxx@sentry.io/xxx" \
  API_CORS_ORIGIN="https://hospeda.com,https://admin.hospeda.com" \
  --app hospeda-api
```

**From .env file**:

```bash
# Create a secrets file (DO NOT COMMIT!)
cat > .env.secrets << 'EOF'
HOSPEDA_DATABASE_URL=postgresql://user:pass@host/db
HOSPEDA_CLERK_SECRET_KEY=sk_live_xxx
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxx
CLOUDINARY_CLOUD_NAME=hospeda
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
SENTRY_DSN=https://xxx@sentry.io/xxx
API_CORS_ORIGIN=https://hospeda.com,https://admin.hospeda.com
EOF

# Import secrets
cat .env.secrets | flyctl secrets import --app hospeda-api

# Delete secrets file
rm .env.secrets
```

#### View Secrets

**List secret names** (values are hidden):

```bash
flyctl secrets list --app hospeda-api
```

**Output**:

```text
NAME                                    DIGEST                  CREATED AT
HOSPEDA_DATABASE_URL                    abc123...               2024-01-05T10:00:00Z
HOSPEDA_CLERK_SECRET_KEY                def456...               2024-01-05T10:00:00Z
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY    ghi789...               2024-01-05T10:00:00Z
MERCADO_PAGO_ACCESS_TOKEN               jkl012...               2024-01-05T10:00:00Z
CLOUDINARY_CLOUD_NAME                   mno345...               2024-01-05T10:00:00Z
CLOUDINARY_API_KEY                      pqr678...               2024-01-05T10:00:00Z
CLOUDINARY_API_SECRET                   stu901...               2024-01-05T10:00:00Z
SENTRY_DSN                              vwx234...               2024-01-05T10:00:00Z
API_CORS_ORIGIN                         yzab56...               2024-01-05T10:00:00Z
```

#### Update a Secret

```bash
flyctl secrets set HOSPEDA_CLERK_SECRET_KEY="sk_live_new_key" --app hospeda-api
```

**Note**: Setting a secret triggers a new deployment.

#### Delete a Secret

```bash
flyctl secrets unset MERCADO_PAGO_ACCESS_TOKEN --app hospeda-api
```

**Warning**: This also triggers a deployment.

---

## Deployment Process

### Build Process

The build happens automatically during deployment, but you can test locally.

#### Local Build

**Build the API**:

```bash
cd /path/to/hospeda/apps/api
pnpm build
```

**Output**:

```text
Building API...
✓ Built in 3.2s
Output: dist/index.js
```

**Verify build**:

```bash
ls -lh dist/
# Should show index.js and other compiled files
```

**Test build locally**:

```bash
node dist/index.js
```

**Output**:

```text
Server running on http://localhost:3000
```

**Test health endpoint**:

```bash
curl http://localhost:3000/health
```

**Expected Response**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-05T10:00:00.000Z",
  "uptime": 1.234
}
```

#### Docker Build (Local Testing)

**Build Docker image**:

```bash
cd /path/to/hospeda
docker build -f Dockerfile.api -t hospeda-api:local .
```

**Run container**:

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOSPEDA_DATABASE_URL="postgresql://..." \
  -e HOSPEDA_CLERK_SECRET_KEY="sk_test_..." \
  hospeda-api:local
```

**Test**:

```bash
curl http://localhost:3000/health
```

**Stop container**:

```bash
docker ps  # Get container ID
docker stop <container-id>
```

### First Deployment

#### Deploy to Fly.io

**Deploy command**:

```bash
cd /path/to/hospeda/apps/api
flyctl deploy --app hospeda-api
```

**What happens**:

1. **Reads fly.toml**: Gets app configuration
2. **Builds Docker image**: Using Dockerfile.api
3. **Pushes image**: To Fly.io registry
4. **Creates VMs**: Based on configuration
5. **Runs health checks**: Verifies app is healthy
6. **Routes traffic**: To healthy VMs

**Output**:

```text
==> Verifying app config
--> Verified app config
==> Building image
--> Building Dockerfile.api
[+] Building 45.3s (23/23) FINISHED
 => [internal] load build definition from Dockerfile.api
 => => transferring dockerfile: 1.2kB
 => [internal] load .dockerignore
 => => transferring context: 100B
 => [internal] load metadata for docker.io/library/node:20-alpine
 => [base 1/2] FROM docker.io/library/node:20-alpine@sha256:...
 => CACHED [base 2/2] RUN npm install -g pnpm@8.15.6
 => [deps 1/4] WORKDIR /app
 => [deps 2/4] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
 => [deps 3/4] COPY apps/api/package.json ./apps/api/
 => [deps 4/4] RUN pnpm install --frozen-lockfile
 => [builder 1/3] COPY --from=deps /app/node_modules ./node_modules
 => [builder 2/3] COPY . .
 => [builder 3/3] RUN pnpm --filter=api build
 => [runner 1/6] WORKDIR /app
 => [runner 2/6] RUN npm install -g pnpm@8.15.6
 => [runner 3/6] COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
 => [runner 4/6] RUN pnpm install --frozen-lockfile --prod
 => [runner 5/6] COPY --from=builder /app/apps/api/dist ./apps/api/dist
 => [runner 6/6] COPY --from=builder /app/packages/*/dist ./packages/*/dist
 => exporting to image
 => => exporting layers
 => => writing image sha256:abc123...
 => => naming to registry.fly.io/hospeda-api:deployment-...

--> Pushing image to fly
--> Pushing image done
image: registry.fly.io/hospeda-api:deployment-01234567890
image size: 147 MB

--> Creating release
Release v1 created

--> Monitoring deployment
  1 desired, 1 placed, 1 healthy, 0 unhealthy [health checks: 1 total, 1 passing]
--> v1 deployed successfully

Visit your newly deployed app at https://hospeda-api.fly.dev/
```

**Verify Deployment**:

```bash
curl https://hospeda-api.fly.dev/health
```

**Expected Response**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-05T10:15:30.000Z",
  "uptime": 15.234
}
```

#### Deploy with --remote-only

If your local Docker is slow or unavailable, use remote builds:

```bash
flyctl deploy --remote-only --app hospeda-api
```

**Advantage**: Builds on Fly.io infrastructure (faster for slow connections).

#### Deploy from Specific Directory

```bash
flyctl deploy --app hospeda-api --config apps/api/fly.toml --dockerfile Dockerfile.api
```

**Use Case**: Deploying from monorepo root.

### Subsequent Deployments

After the first deployment, subsequent deployments are simpler:

#### Standard Deployment

```bash
cd apps/api
flyctl deploy
```

**Fast Deployment** (skip confirmation):

```bash
flyctl deploy --yes
```

#### Zero-Downtime Deployment

Fly.io automatically performs zero-downtime deployments:

**Process**:

1. **Build new image**: New version built
2. **Create new VMs**: New VMs started alongside old ones
3. **Health checks**: Wait for new VMs to pass health checks
4. **Traffic shift**: Gradually shift traffic to new VMs
5. **Shutdown old VMs**: Old VMs drained and stopped

**Verify Zero-Downtime**:

```bash
# In one terminal, watch deployment
flyctl logs --app hospeda-api

# In another terminal, continuously test health endpoint
while true; do
  curl -s https://hospeda-api.fly.dev/health | jq '.timestamp'
  sleep 1
done
```

**Expected**: No interruption in responses during deployment.

#### Deployment with Specific Image Tag

```bash
flyctl deploy --image registry.fly.io/hospeda-api:v1.2.3
```

**Use Case**: Deploy a previously built image (useful for rollbacks).

### Deployment Workflow

#### Manual Deployment

**Step-by-step**:

```bash
# 1. Navigate to API directory
cd /path/to/hospeda/apps/api

# 2. Run tests
pnpm test

# 3. Type check
pnpm typecheck

# 4. Build locally (optional, to verify)
pnpm build

# 5. Deploy to Fly.io
flyctl deploy --app hospeda-api

# 6. Verify deployment
curl https://hospeda-api.fly.dev/health

# 7. Monitor logs
flyctl logs --app hospeda-api

# 8. Check status
flyctl status --app hospeda-api
```

#### Automated Deployment (GitHub Actions)

**File**: `.github/workflows/deploy-api.yml`

```yaml
name: Deploy API to Fly.io

on:
  push:
    branches:
      - main
    paths:
      - 'apps/api/**'
      - 'packages/**'
      - 'Dockerfile.api'
      - '.github/workflows/deploy-api.yml'

jobs:
  deploy:
    name: Deploy to Fly.io
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8.15.6

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm --filter=api test

      - name: Type check
        run: pnpm --filter=api typecheck

      - name: Setup Fly.io
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only --app hospeda-api
        working-directory: apps/api
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

      - name: Verify deployment
        run: |
          sleep 10
          curl -f https://hospeda-api.fly.dev/health || exit 1
```

**Setup**:

1. Go to GitHub repository → Settings → Secrets → Actions
2. Add secret: `FLY_API_TOKEN` = (your Fly.io token from <https://fly.io/user/personal_access_tokens>)

**Trigger**: Automatically deploys on push to `main` branch when API files change.

#### Deployment with Smoke Tests

Add smoke tests after deployment:

```yaml
      - name: Run smoke tests
        run: |
          # Test health endpoint
          curl -f https://hospeda-api.fly.dev/health || exit 1

          # Test authentication endpoint
          curl -f https://hospeda-api.fly.dev/api/auth/status || exit 1

          # Test a protected endpoint (should return 401 without auth)
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://hospeda-api.fly.dev/api/accommodations)
          if [ "$STATUS" -ne 401 ]; then
            echo "Expected 401, got $STATUS"
            exit 1
          fi

          echo "Smoke tests passed!"
```

### Deployment Strategies

#### Deployment Strategies Blue-Green Deployment

**Concept**: Run two versions (blue = old, green = new), switch traffic.

**Implementation**:

```bash
# 1. Deploy to staging slot
flyctl deploy --app hospeda-api-staging

# 2. Test staging
curl https://hospeda-api-staging.fly.dev/health

# 3. If tests pass, deploy to production
flyctl deploy --app hospeda-api

# 4. If issues, rollback (see Rollback section)
```

#### Canary Deployment

**Concept**: Gradually shift traffic to new version.

**Fly.io does this automatically** with multiple VMs:

- Deploy new version
- Health checks pass
- Traffic gradually shifts (10% → 50% → 100%)
- Old VMs drained and stopped

**Monitor during canary**:

```bash
flyctl logs --app hospeda-api
```

**Look for**:

- Error rates increasing? Rollback
- Performance degrading? Rollback
- All healthy? Continue

#### Rolling Deployment

**Concept**: Update VMs one at a time.

**Fly.io default behavior**:

```bash
# With 3 VMs:
# 1. Update VM 1 → health check → route traffic
# 2. Update VM 2 → health check → route traffic
# 3. Update VM 3 → health check → route traffic
```

**Configure in fly.toml**:

```toml
[deploy]
  strategy = "rolling"
  max_unavailable = 1  # Only 1 VM down at a time
```

---

## Environment Variables

### Overview

Environment variables configure your API without code changes.

**Types**:

1. **Public** (in `fly.toml`): Non-sensitive config
2. **Secrets** (Fly.io secrets): Sensitive data (API keys, etc.)

### Public Environment Variables

**Set in fly.toml**:

```toml
[env]
  NODE_ENV = "production"
  PORT = "3000"
  LOG_LEVEL = "info"
  API_RATE_LIMIT = "100"
  API_RATE_WINDOW = "60000"
```

**Access in code**:

```typescript
const nodeEnv = process.env.NODE_ENV;  // "production"
const port = process.env.PORT;         // "3000"
```

**Update**:

1. Edit `fly.toml`
2. Redeploy: `flyctl deploy`

### Secrets (Sensitive Variables)

#### Required Secrets

**Database**:

```bash
HOSPEDA_DATABASE_URL="postgresql://user:password@host.region.neon.tech/hospeda?sslmode=require"
```

**Authentication (Clerk)**:

```bash
HOSPEDA_CLERK_SECRET_KEY="YOUR_SECRET_KEY_HERE"
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY_HERE"
HOSPEDA_CLERK_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Payments (Mercado Pago)**:

```bash
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
MERCADO_PAGO_PUBLIC_KEY="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
MERCADO_PAGO_WEBHOOK_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Image Storage (Cloudinary)**:

```bash
CLOUDINARY_CLOUD_NAME="hospeda"
CLOUDINARY_API_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
CLOUDINARY_API_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Error Tracking (Sentry)**:

```bash
SENTRY_DSN="https://xxxxxxxxxxxxxxxxxxxxxxxxxxxx@o123456.ingest.sentry.io/123456"
SENTRY_ENVIRONMENT="production"
```

**API Configuration**:

```bash
API_CORS_ORIGIN="https://hospeda.com,https://admin.hospeda.com"
API_BASE_URL="https://hospeda-api.fly.dev"
```

#### Set All Secrets at Once

**Create secrets file** (temporary, DO NOT COMMIT):

```bash
cat > .env.production << 'EOF'
HOSPEDA_DATABASE_URL=postgresql://user:password@host.region.neon.tech/hospeda?sslmode=require
HOSPEDA_CLERK_SECRET_KEY=sk_live_xxx
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
HOSPEDA_CLERK_WEBHOOK_SECRET=whsec_xxx
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxx
MERCADO_PAGO_PUBLIC_KEY=APP_USR-xxx
MERCADO_PAGO_WEBHOOK_SECRET=xxx
CLOUDINARY_CLOUD_NAME=hospeda
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
SENTRY_DSN=https://xxx@o123456.ingest.sentry.io/123456
SENTRY_ENVIRONMENT=production
API_CORS_ORIGIN=https://hospeda.com,https://admin.hospeda.com
API_BASE_URL=https://hospeda-api.fly.dev
EOF
```

**Import secrets**:

```bash
flyctl secrets import --app hospeda-api < .env.production
```

**Output**:

```text
Setting secrets on hospeda-api...
Release v2 created
```

**Delete secrets file**:

```bash
rm .env.production
```

**Verify secrets**:

```bash
flyctl secrets list --app hospeda-api
```

#### Update Individual Secret

```bash
flyctl secrets set HOSPEDA_CLERK_SECRET_KEY="sk_live_new_key" --app hospeda-api
```

**Note**: This triggers a new deployment (release v3).

#### Delete Secret

```bash
flyctl secrets unset MERCADO_PAGO_WEBHOOK_SECRET --app hospeda-api
```

**Warning**: Triggers a new deployment.

### Environment-Specific Configuration

#### Development (.env.local)

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
HOSPEDA_DATABASE_URL=postgresql://localhost:5432/hospeda_dev
HOSPEDA_CLERK_SECRET_KEY=sk_test_xxx
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxx
CLOUDINARY_CLOUD_NAME=hospeda-dev
SENTRY_ENVIRONMENT=development
API_CORS_ORIGIN=http://localhost:4321,http://localhost:4322
```

#### Staging (Fly.io App: hospeda-api-staging)

```bash
NODE_ENV=staging
LOG_LEVEL=debug
HOSPEDA_DATABASE_URL=postgresql://...@staging.neon.tech/hospeda_staging
HOSPEDA_CLERK_SECRET_KEY=sk_test_xxx
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxx
SENTRY_ENVIRONMENT=staging
API_CORS_ORIGIN=https://staging.hospeda.com,https://staging-admin.hospeda.com
API_BASE_URL=https://hospeda-api-staging.fly.dev
```

#### Production (Fly.io App: hospeda-api)

```bash
NODE_ENV=production
LOG_LEVEL=info
HOSPEDA_DATABASE_URL=postgresql://...@production.neon.tech/hospeda
HOSPEDA_CLERK_SECRET_KEY=sk_live_xxx
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxx
SENTRY_ENVIRONMENT=production
API_CORS_ORIGIN=https://hospeda.com,https://admin.hospeda.com
API_BASE_URL=https://hospeda-api.fly.dev
```

### Access Secrets in Code

**Environment configuration** (`packages/config/src/index.ts`):

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().default('3000'),

  // Database
  HOSPEDA_DATABASE_URL: z.string().url(),

  // Authentication
  HOSPEDA_CLERK_SECRET_KEY: z.string().min(1),
  HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),

  // Payments
  MERCADO_PAGO_ACCESS_TOKEN: z.string().min(1),

  // Storage
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Error Tracking
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().default('production'),

  // API Configuration
  API_CORS_ORIGIN: z.string().min(1),
  API_BASE_URL: z.string().url(),
});

export const config = envSchema.parse(process.env);
```

**Usage in API**:

```typescript
import { config } from '@repo/config';
import { Hono } from 'hono';

const app = new Hono();

// Use validated configuration
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default {
  port: parseInt(config.PORT),
  fetch: app.fetch,
};
```

### Security Best Practices

**DO**:

- ✓ Use Fly.io secrets for sensitive data
- ✓ Validate environment variables with Zod
- ✓ Use different secrets for staging/production
- ✓ Rotate secrets regularly
- ✓ Use minimal permissions (principle of least privilege)

**DON'T**:

- ✗ Commit secrets to git (.env files)
- ✗ Share secrets via email/chat
- ✗ Log secrets (even in development)
- ✗ Use production secrets in development
- ✗ Store secrets in plain text files

**Secret Rotation**:

```bash
# 1. Generate new secret (e.g., new Clerk key)
# 2. Add new secret to Fly.io
flyctl secrets set HOSPEDA_CLERK_SECRET_KEY="sk_live_new_key"
# 3. Verify deployment successful
curl https://hospeda-api.fly.dev/health
# 4. Revoke old secret in Clerk dashboard
```

---

## Scaling & Performance

### Horizontal Scaling

**Concept**: Add more VMs to handle increased traffic.

#### Horizontal Scaling Scale Machine Count

**Add machines**:

```bash
flyctl scale count 3 --app hospeda-api
```

**Result**: 3 VMs in primary region, load-balanced automatically.

**Remove machines**:

```bash
flyctl scale count 1 --app hospeda-api
```

**View current scale**:

```bash
flyctl scale show --app hospeda-api
```

**Output**:

```text
VM Resources for app: hospeda-api

VM Size: shared-cpu-1x
VM Memory: 512 MB
Count: 3

Regions:
  gru (primary): 3 VMs
```

#### Multi-Region Scaling

**Add regions**:

```bash
flyctl regions add scl  # Santiago, Chile
flyctl scale count 5 --app hospeda-api
```

**Result**: VMs distributed across regions (e.g., 3 in GRU, 2 in SCL).

**View distribution**:

```bash
flyctl status --app hospeda-api
```

**Output**:

```text
Instances
ID       REGION  STATE   CHECKS          RESTARTS  CREATED
abc123   gru     running 1 total, 1 passing  0     2024-01-05T10:00:00Z
def456   gru     running 1 total, 1 passing  0     2024-01-05T10:00:00Z
ghi789   gru     running 1 total, 1 passing  0     2024-01-05T10:00:00Z
jkl012   scl     running 1 total, 1 passing  0     2024-01-05T10:05:00Z
mno345   scl     running 1 total, 1 passing  0     2024-01-05T10:05:00Z
```

**Traffic Routing**: Users routed to nearest healthy VM.

### Vertical Scaling

**Concept**: Increase VM resources (CPU, memory).

#### Upgrade VM Size

**List available sizes**:

```bash
flyctl platform vm-sizes
```

**Output**:

```text
NAME                CPU    MEMORY
shared-cpu-1x       1      256 MB
shared-cpu-1x       1      512 MB
shared-cpu-1x       1      1024 MB
shared-cpu-1x       1      2048 MB
dedicated-cpu-1x    1      2048 MB
dedicated-cpu-2x    2      4096 MB
dedicated-cpu-4x    4      8192 MB
dedicated-cpu-8x    8      16384 MB
```

**Scale VM**:

```bash
flyctl scale vm shared-cpu-1x --memory 1024 --app hospeda-api
```

**Result**: All VMs upgraded to 1GB memory.

**Dedicated CPU**:

```bash
flyctl scale vm dedicated-cpu-1x --memory 2048 --app hospeda-api
```

**Cost**: Higher, but better performance (no CPU sharing).

### Auto-Scaling Configuration

**Fly.io supports auto-scaling** based on concurrency.

#### Configure in fly.toml

```toml
[http_service]
  auto_stop_machines = false  # Keep at least min_machines_running
  auto_start_machines = true
  min_machines_running = 2    # Minimum 2 VMs always running
  max_machines_running = 10   # Maximum 10 VMs during high traffic

  [http_service.concurrency]
    type = "requests"
    soft_limit = 200  # Scale up when exceeding 200 concurrent requests
    hard_limit = 250  # Max 250 concurrent requests per VM
```

**How it works**:

1. **Low traffic**: 2 VMs running
2. **Traffic increases**: Exceeds 200 concurrent requests per VM
3. **Auto-scale up**: New VM started (up to 10 total)
4. **Traffic decreases**: Exceeds soft limit falls below threshold
5. **Auto-scale down**: Extra VMs stopped (down to 2 minimum)

**Deploy changes**:

```bash
flyctl deploy --app hospeda-api
```

#### Monitor Auto-Scaling

**Watch scaling events**:

```bash
flyctl logs --app hospeda-api | grep -i scale
```

**View current machines**:

```bash
flyctl status --app hospeda-api
```

**Metrics dashboard**:

```bash
flyctl dashboard --app hospeda-api
```

### Performance Optimization

#### Database Connection Pooling

**Problem**: Each request creates a new database connection (slow).

**Solution**: Use connection pooling.

**Configuration** (`packages/db/src/index.ts`):

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { config } from '@repo/config';

// Create pooled connection
const sql = neon(config.HOSPEDA_DATABASE_URL, {
  poolQueryViaFetch: true,
  fetchOptions: {
    cache: 'no-store',
  },
});

export const db = drizzle(sql);
```

**Neon HTTP** automatically pools connections.

#### Response Caching

**Cache static/slow responses**:

```typescript
import { Hono } from 'hono';
import { cache } from 'hono/cache';

const app = new Hono();

// Cache accommodations list for 5 minutes
app.get(
  '/api/accommodations',
  cache({
    cacheName: 'accommodations',
    cacheControl: 'max-age=300',
  }),
  async (c) => {
    // Fetch accommodations...
    return c.json(accommodations);
  }
);
```

**CDN Caching**: Fly.io edge network caches responses.

#### Request Compression

**Enable gzip/brotli compression**:

```typescript
import { Hono } from 'hono';
import { compress } from 'hono/compress';

const app = new Hono();

// Enable compression
app.use('*', compress());

export default app;
```

**Result**: Smaller response sizes → faster load times.

#### Reduce Payload Size

**Pagination**:

```typescript
// BAD: Return all accommodations
app.get('/api/accommodations', async (c) => {
  const accommodations = await db.select().from(accommodations);
  return c.json(accommodations);  // Could be 1000s of records!
});

// GOOD: Return paginated results
app.get('/api/accommodations', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1');
  const pageSize = parseInt(c.req.query('pageSize') ?? '20');

  const accommodations = await db
    .select()
    .from(accommodations)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return c.json({
    data: accommodations,
    pagination: { page, pageSize },
  });
});
```

**Field Selection**:

```typescript
// BAD: Return full objects
const accommodations = await db.select().from(accommodations);

// GOOD: Return only needed fields
const accommodations = await db
  .select({
    id: accommodations.id,
    title: accommodations.title,
    pricePerNight: accommodations.pricePerNight,
    // Exclude large fields like description, images
  })
  .from(accommodations);
```

#### Performance Monitoring

**Add performance headers**:

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  c.header('X-Response-Time', `${duration}ms`);
});

export default app;
```

**Test**:

```bash
curl -i https://hospeda-api.fly.dev/health | grep X-Response-Time
# X-Response-Time: 15ms
```

**Slow Query Logging**:

```typescript
import { logger } from '@repo/logger';

export async function logSlowQueries() {
  const start = Date.now();
  const result = await db.select().from(accommodations);
  const duration = Date.now() - start;

  if (duration > 1000) {  // Log if > 1 second
    logger.warn('Slow query detected', {
      query: 'select accommodations',
      duration,
    });
  }

  return result;
}
```

### Load Testing

**Test your API under load** before scaling up.

#### Using k6

**Install k6**:

```bash
brew install k6  # macOS
# or download from https://k6.io
```

**Create load test** (`load-test.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% failure rate
  },
};

export default function () {
  const res = http.get('https://hospeda-api.fly.dev/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Run test**:

```bash
k6 run load-test.js
```

**Output**:

```text
execution: local
   script: load-test.js
   output: -

scenarios: (100.00%) 1 scenario, 50 max VUs, 2m30s max duration

running (2m00.0s), 00/50 VUs, 3000 complete and 0 interrupted iterations
default ✓ [======================================] 00/50 VUs  2m0s

✓ status is 200
✓ response time < 500ms

checks.........................: 100.00% ✓ 6000  ✗ 0
http_req_duration..............: avg=45ms  min=12ms med=38ms max=312ms p(95)=98ms
http_req_failed................: 0.00%   ✓ 0     ✗ 3000
http_reqs......................: 3000    25/s
iterations.....................: 3000    25/s
```

**Analyze results**:

- **95th percentile < 500ms**: ✓ Passed
- **Failure rate < 1%**: ✓ Passed
- **Average response time: 45ms**: Good performance

**If tests fail**: Scale up VMs or optimize code.

---

## Monitoring & Logs

### View Logs

#### Real-Time Logs

```bash
flyctl logs --app hospeda-api
```

**Output**:

```text
2024-01-05T10:15:30.123Z app[abc123] gru [info] Server running on http://localhost:3000
2024-01-05T10:15:35.456Z app[abc123] gru [info] GET /health 200 15ms
2024-01-05T10:15:40.789Z app[abc123] gru [info] GET /api/accommodations 200 42ms
```

#### Filter Logs

**By level**:

```bash
flyctl logs --app hospeda-api | grep -i error
```

**By instance**:

```bash
flyctl logs --app hospeda-api --instance abc123
```

**By region**:

```bash
flyctl logs --app hospeda-api --region gru
```

**Specific time range**:

```bash
flyctl logs --app hospeda-api --since 1h  # Last 1 hour
flyctl logs --app hospeda-api --since 30m # Last 30 minutes
```

#### Log Format

**Structured logging** (`packages/logger/src/index.ts`):

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage
logger.info({ userId: '123', action: 'login' }, 'User logged in');
logger.error({ error: err, context: 'payment' }, 'Payment failed');
```

**Output**:

```json
{
  "level": "info",
  "time": "2024-01-05T10:15:30.123Z",
  "userId": "123",
  "action": "login",
  "msg": "User logged in"
}
```

### Metrics Dashboard

#### Fly.io Dashboard

**Open dashboard**:

```bash
flyctl dashboard --app hospeda-api
```

**Or visit**: <https://fly.io/apps/hospeda-api/metrics>

**Available Metrics**:

- **Requests**: Total requests, requests/second
- **Response Times**: Average, p50, p95, p99
- **Status Codes**: 2xx, 4xx, 5xx breakdown
- **Instance Health**: CPU, memory, disk usage
- **Network**: Ingress/egress bandwidth

**Time Ranges**: 1h, 6h, 24h, 7d, 30d

#### Grafana Integration

**Fly.io provides Prometheus metrics**:

```bash
# Metrics endpoint (if enabled in fly.toml)
curl https://hospeda-api.fly.dev/metrics
```

**Output**:

```text
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 12345

# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 10000
http_request_duration_seconds_bucket{le="0.5"} 12000
```

**Integration**: Export to Grafana, DataDog, etc.

### Health Checks

#### Configure Health Checks

Already configured in `fly.toml`:

```toml
[[http_service.checks]]
  interval = "15s"     # Check every 15 seconds
  timeout = "10s"      # Fail if no response in 10s
  grace_period = "5s"  # Wait 5s after startup before checking
  method = "GET"
  path = "/health"
  protocol = "http"
```

#### Health Endpoint Implementation

**File**: `apps/api/src/routes/health.route.ts`

```typescript
import { Hono } from 'hono';
import { db } from '@repo/db';

const health = new Hono();

health.get('/health', async (c) => {
  // Check database connectivity
  let dbHealthy = false;
  try {
    await db.execute('SELECT 1');
    dbHealthy = true;
  } catch (error) {
    dbHealthy = false;
  }

  const status = dbHealthy ? 'ok' : 'degraded';

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealthy ? 'connected' : 'disconnected',
  }, dbHealthy ? 200 : 503);
});

export { health };
```

**Response** (healthy):

```json
{
  "status": "ok",
  "timestamp": "2024-01-05T10:15:30.000Z",
  "uptime": 3600.123,
  "database": "connected"
}
```

**Response** (unhealthy):

```json
{
  "status": "degraded",
  "timestamp": "2024-01-05T10:15:30.000Z",
  "uptime": 3600.123,
  "database": "disconnected"
}
```

**HTTP Status**: 200 (healthy), 503 (unhealthy)

#### View Health Status

```bash
flyctl status --app hospeda-api
```

**Output**:

```text
Instances
ID       REGION  STATE   CHECKS          RESTARTS  CREATED
abc123   gru     running 1 total, 1 passing  0     2024-01-05T10:00:00Z
def456   gru     running 1 total, 1 passing  0     2024-01-05T10:00:00Z
ghi789   gru     running 1 total, 0 passing  0     2024-01-05T10:00:00Z  ⚠️ Unhealthy
```

**Check details**:

```bash
flyctl checks list --app hospeda-api
```

### Alerting Setup

#### Email Alerts

**Fly.io automatically sends alerts** for:

- App down (all instances unhealthy)
- Deployment failures
- SSL certificate expiration

**Configure**: <https://fly.io/apps/hospeda-api/monitoring>

#### Sentry Integration

**Error tracking** with Sentry:

**Installation**:

```bash
pnpm add @sentry/node --filter=api
```

**Configuration** (`apps/api/src/index.ts`):

```typescript
import * as Sentry from '@sentry/node';
import { config } from '@repo/config';

// Initialize Sentry
Sentry.init({
  dsn: config.SENTRY_DSN,
  environment: config.SENTRY_ENVIRONMENT,
  tracesSampleRate: 1.0,
});

// Add error handler
app.onError((err, c) => {
  Sentry.captureException(err);

  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An error occurred',
    },
  }, 500);
});
```

**Alerts**: Configure in Sentry dashboard (<https://sentry.io/organizations/hospeda/projects/>)

#### Slack Notifications

**Webhook integration**:

```typescript
async function sendSlackAlert(message: string) {
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

// Usage
logger.error({ error: err }, 'Critical error');
await sendSlackAlert(`🚨 Critical error in API: ${err.message}`);
```

---

## Troubleshooting

### Common Deployment Errors

#### Error: "Could not find App"

**Symptom**:

```text
Error: Could not find App "hospeda-api"
```

**Cause**: App doesn't exist or wrong name.

**Solution**:

```bash
# List your apps
flyctl apps list

# Create app if missing
flyctl apps create hospeda-api

# Or use correct app name
flyctl deploy --app <correct-name>
```

#### Error: "failed to fetch an image or build from source"

**Symptom**:

```text
Error: failed to fetch an image or build from source: error building: failed to solve with frontend dockerfile.v0
```

**Cause**: Docker build error (syntax error in Dockerfile, missing files).

**Solution**:

```bash
# Build locally to see detailed error
docker build -f Dockerfile.api -t hospeda-api:test .

# Common issues:
# - Missing files (check .dockerignore)
# - Syntax errors in Dockerfile
# - Network issues during npm install
```

**Fix**: Correct Dockerfile and retry.

#### Error: "no such file or directory"

**Symptom**:

```text
Error: failed to copy: stat Dockerfile.api: no such file or directory
```

**Cause**: Dockerfile not found at specified path.

**Solution**:

```bash
# Ensure Dockerfile.api exists at monorepo root
ls -la Dockerfile.api

# Deploy from correct directory
cd /path/to/hospeda/apps/api
flyctl deploy --dockerfile ../../Dockerfile.api
```

#### Error: "health check never passed"

**Symptom**:

```text
Error: health check never passed
Instance abc123 failed health checks
```

**Cause**: App not responding on health check endpoint.

**Solution**:

```bash
# Check logs for startup errors
flyctl logs --app hospeda-api

# Common issues:
# - Port mismatch (app listening on wrong port)
# - Missing /health endpoint
# - Database connection error
# - Crash on startup

# SSH into instance to debug
flyctl ssh console --app hospeda-api

# Inside instance:
node apps/api/dist/index.js  # Run manually to see errors
```

**Fix**: Correct startup errors and redeploy.

#### Error: "insufficient memory"

**Symptom**:

```text
Error: Process ran out of memory
Instance abc123 terminated (out of memory)
```

**Cause**: VM memory too low.

**Solution**:

```bash
# Increase memory
flyctl scale vm shared-cpu-1x --memory 1024 --app hospeda-api

# Or switch to larger VM
flyctl scale vm dedicated-cpu-1x --memory 2048 --app hospeda-api
```

### Database Connection Issues

#### Error: "connect ETIMEDOUT"

**Symptom**:

```text
Error: connect ETIMEDOUT
Could not connect to database
```

**Cause**: Neon database unreachable (network issue, wrong URL).

**Solution**:

```bash
# Verify database URL secret
flyctl secrets list --app hospeda-api | grep DATABASE_URL

# Test connection from local machine
psql "postgresql://user:pass@host.region.neon.tech/hospeda?sslmode=require"

# Common issues:
# - Missing ?sslmode=require in URL
# - Firewall blocking Fly.io IP range
# - Neon database paused (free tier)
```

**Fix**:

```bash
# Update database URL with correct format
flyctl secrets set HOSPEDA_DATABASE_URL="postgresql://user:pass@host.region.neon.tech/hospeda?sslmode=require"

# Wake up Neon database (if paused)
# Visit Neon dashboard and resume database
```

#### Error: "too many connections"

**Symptom**:

```text
Error: sorry, too many clients already
```

**Cause**: Exceeded Neon connection limit (free tier: 100 connections).

**Solution**:

```bash
# Use connection pooling (already configured with Neon HTTP)
# Or scale down VMs to reduce connections
flyctl scale count 2 --app hospeda-api

# Or upgrade Neon plan for more connections
```

### Memory/CPU Problems

#### High Memory Usage

**Symptom**: Instances restarting frequently.

**Diagnose**:

```bash
# Check instance status
flyctl status --app hospeda-api

# View logs for OOM (out of memory) errors
flyctl logs --app hospeda-api | grep -i "out of memory"

# SSH into instance and check memory
flyctl ssh console --app hospeda-api
free -m
```

**Solution**:

```bash
# Increase memory
flyctl scale vm shared-cpu-1x --memory 1024 --app hospeda-api

# Or optimize code:
# - Fix memory leaks
# - Reduce cached data
# - Optimize database queries
```

#### High CPU Usage

**Symptom**: Slow response times, timeouts.

**Diagnose**:

```bash
# Check CPU usage in dashboard
flyctl dashboard --app hospeda-api

# View logs for slow operations
flyctl logs --app hospeda-api | grep -i "slow"

# SSH into instance and check CPU
flyctl ssh console --app hospeda-api
top
```

**Solution**:

```bash
# Upgrade to dedicated CPU
flyctl scale vm dedicated-cpu-1x --app hospeda-api

# Or optimize code:
# - Add caching
# - Optimize algorithms
# - Use pagination
```

### Network Issues

#### Error: "context deadline exceeded"

**Symptom**:

```text
Error: context deadline exceeded
Request timeout
```

**Cause**: Request taking too long (> timeout).

**Solution**:

```bash
# Increase timeout in fly.toml
# Edit fly.toml:
[[http_service.checks]]
  timeout = "30s"  # Increase from 10s

# Redeploy
flyctl deploy
```

#### SSL Certificate Issues

**Symptom**: "Your connection is not private" error.

**Cause**: SSL certificate not issued or expired.

**Solution**:

```bash
# Check certificate status
flyctl certs show hospeda-api.fly.dev --app hospeda-api

# Issue new certificate
flyctl certs create hospeda-api.fly.dev --app hospeda-api

# For custom domain
flyctl certs create api.hospeda.com --app hospeda-api
```

### Debug Commands

#### SSH into Instance

```bash
flyctl ssh console --app hospeda-api
```

**Inside instance**:

```bash
# Check environment variables
env | grep HOSPEDA

# Check running processes
ps aux

# Check memory usage
free -m

# Check disk usage
df -h

# Test database connection
curl -X POST localhost:3000/health

# View application logs
tail -f /var/log/app.log
```

#### Run Command on Instance

```bash
flyctl ssh console --app hospeda-api --command "node apps/api/dist/index.js"
```

#### Restart Instance

```bash
flyctl apps restart --app hospeda-api
```

#### Destroy and Recreate

**Last resort** (data loss possible):

```bash
# Destroy app
flyctl apps destroy hospeda-api --yes

# Recreate and redeploy
flyctl launch --no-deploy
flyctl deploy
```

---

## Rollback Procedures

### View Release History

**List all releases**:

```bash
flyctl releases --app hospeda-api
```

**Output**:

```text
VERSION  STATUS   DESCRIPTION                         USER            DATE
v5       complete Deploy via flyctl                  you@email.com   2024-01-05T10:15:00Z
v4       complete Deploy via GitHub Actions          github-actions  2024-01-05T09:00:00Z
v3       complete Secrets updated                    you@email.com   2024-01-04T14:30:00Z
v2       complete Deploy via flyctl                  you@email.com   2024-01-04T10:00:00Z
v1       complete Initial deployment                 you@email.com   2024-01-03T16:00:00Z
```

**Get release details**:

```bash
flyctl releases show v4 --app hospeda-api
```

**Output**:

```text
Release: v4
Status: complete
Description: Deploy via GitHub Actions
User: github-actions
Date: 2024-01-05T09:00:00Z

Config Changes:
  (none)

Deployment Strategy: rolling
Image: registry.fly.io/hospeda-api:deployment-123456789
```

### Rollback to Previous Version

#### Quick Rollback (Previous Release)

```bash
flyctl releases rollback --app hospeda-api
```

**What happens**:

1. Identifies previous successful release (v4)
2. Redeploys that release
3. Creates new release (v6) with v4's configuration

**Output**:

```text
Rolling back to release v4
Creating release v6...
Release v6 created
Deploying...
v6 deployed successfully
```

**Verify**:

```bash
curl https://hospeda-api.fly.dev/health
```

#### Rollback to Specific Version

```bash
flyctl releases rollback v3 --app hospeda-api
```

**Use case**: Skip multiple broken releases.

#### Rollback via Image Tag

If you tagged your Docker images:

```bash
flyctl deploy --image registry.fly.io/hospeda-api:v1.2.3 --app hospeda-api
```

**Recommended**: Tag images with semantic versions during deployment.

### Emergency Rollback

**Scenario**: Production is down, need immediate rollback.

**Steps**:

```bash
# 1. Identify last known good release
flyctl releases --app hospeda-api

# 2. Rollback immediately
flyctl releases rollback v4 --app hospeda-api --yes

# 3. Verify health
curl https://hospeda-api.fly.dev/health

# 4. Monitor logs
flyctl logs --app hospeda-api

# 5. Check status
flyctl status --app hospeda-api
```

**Time to rollback**: ~30 seconds to 2 minutes.

### Database Rollback Considerations

**IMPORTANT**: Rolling back code does NOT rollback database migrations.

#### Scenario: Code Rollback After Migration

**Problem**: New code (v5) applied database migration. Rolling back to v4 may break.

**Solution**:

**Option 1: Forward-Only Migrations**

- Always write backwards-compatible migrations
- Add columns (don't remove)
- Make columns nullable initially
- Remove deprecated columns in later release

**Example**:

```sql
-- Migration v5: Add new column (backwards-compatible)
ALTER TABLE accommodations ADD COLUMN amenities TEXT[];

-- Code v5: Uses new column
-- Code v4 (rolled back): Ignores new column (no error)

-- Migration v6 (later): Make column NOT NULL
ALTER TABLE accommodations ALTER COLUMN amenities SET NOT NULL;
```

**Option 2: Manual Migration Rollback**

```bash
# 1. Rollback code
flyctl releases rollback v4 --app hospeda-api

# 2. Rollback database migration
# SSH into any VM or connect locally
psql "postgresql://..."

# 3. Manually revert migration
# (Depends on your migration tool)
# Drizzle: Manually run down migration
DROP COLUMN IF EXISTS amenities;
```

**Option 3: Snapshot Restore** (last resort)

```bash
# Neon: Restore database from snapshot
# Visit Neon dashboard → Backups → Restore to specific time
```

**Recommendation**: Test rollbacks in staging first.

### Rollback Checklist

**Before Rollback**:

- [ ] Identify root cause (if time permits)
- [ ] Check if rollback is safe (database compatibility)
- [ ] Notify team
- [ ] Identify target version

**During Rollback**:

- [ ] Rollback code: `flyctl releases rollback vX`
- [ ] Verify health: `curl https://hospeda-api.fly.dev/health`
- [ ] Monitor logs: `flyctl logs`
- [ ] Check error rates (Sentry dashboard)
- [ ] Test critical endpoints

**After Rollback**:

- [ ] Confirm stability (15-30 minutes)
- [ ] Investigate root cause
- [ ] Document incident
- [ ] Fix issue
- [ ] Deploy fix
- [ ] Update runbook

---

## Advanced Topics

### Custom Domains

**Add custom domain** (e.g., `api.hospeda.com`):

```bash
flyctl certs create api.hospeda.com --app hospeda-api
```

**Output**:

```text
Created certificate for api.hospeda.com
Certificate ID: abc123
Status: pending validation

Add these DNS records:

Type: CNAME
Name: api.hospeda.com
Value: hospeda-api.fly.dev
```

**Add DNS record** (in your domain registrar):

```text
Type: CNAME
Name: api
Value: hospeda-api.fly.dev
TTL: 3600
```

**Verify**:

```bash
flyctl certs show api.hospeda.com --app hospeda-api
```

**Output**:

```text
Certificate for api.hospeda.com
Status: issued
Issued at: 2024-01-05T10:30:00Z
Expires at: 2025-01-05T10:30:00Z
```

**Test**:

```bash
curl https://api.hospeda.com/health
```

### IPv6 Support

**Fly.io provides automatic IPv6**:

```bash
flyctl ips list --app hospeda-api
```

**Output**:

```text
VERSION  IP                    TYPE    REGION  CREATED
v4       203.0.113.1           public  global  2024-01-05T10:00:00Z
v6       2001:db8::1           public  global  2024-01-05T10:00:00Z
```

**No configuration needed** - works out of the box.

### Persistent Storage

**Fly.io VMs are ephemeral** (data lost on restart).

**Use persistent volumes** for file storage:

```bash
flyctl volumes create data --size 10 --region gru --app hospeda-api
```

**Mount in fly.toml**:

```toml
[[mounts]]
  source = "data"
  destination = "/data"
```

**Usage**:

```typescript
import fs from 'fs';

// Write to persistent storage
fs.writeFileSync('/data/uploads/image.jpg', buffer);

// Read from persistent storage
const image = fs.readFileSync('/data/uploads/image.jpg');
```

**Note**: Not recommended for user uploads (use Cloudinary instead). Use for app data like SQLite databases, caches, etc.

### CI/CD Integration

**GitHub Actions** (already shown), but here's GitLab CI:

**File**: `.gitlab-ci.yml`

```yaml
deploy-api:
  stage: deploy
  image: flyio/flyctl:latest
  script:
    - flyctl deploy --remote-only --app hospeda-api
  environment:
    name: production
    url: https://hospeda-api.fly.dev
  variables:
    FLY_API_TOKEN: $FLY_API_TOKEN
  only:
    - main
```

### Secrets Management

**Using external secret managers**:

**1Password Connect**:

```bash
# Install 1Password CLI
brew install 1password-cli

# Fetch secret
SECRET=$(op item get "Hospeda API - Clerk Key" --fields password)

# Set in Fly.io
flyctl secrets set HOSPEDA_CLERK_SECRET_KEY="$SECRET" --app hospeda-api
```

**AWS Secrets Manager**:

```bash
# Fetch secret
SECRET=$(aws secretsmanager get-secret-value --secret-id hospeda/api/clerk-key --query SecretString --output text)

# Set in Fly.io
flyctl secrets set HOSPEDA_CLERK_SECRET_KEY="$SECRET" --app hospeda-api
```

### Blue-Green Deployment

**Advanced strategy**: Run two versions simultaneously.

**Steps**:

```bash
# 1. Create "green" environment
flyctl apps create hospeda-api-green

# 2. Deploy new version to green
flyctl deploy --app hospeda-api-green

# 3. Test green environment
curl https://hospeda-api-green.fly.dev/health

# 4. Swap DNS (or Fly.io proxy)
# Update CNAME: api.hospeda.com → hospeda-api-green.fly.dev

# 5. If successful, destroy blue environment
flyctl apps destroy hospeda-api

# 6. Rename green to blue
flyctl apps rename hospeda-api-green hospeda-api
```

---

## Conclusion

You've completed the Fly.io deployment guide for the Hospeda API!

**Key Takeaways**:

- **Setup**: Easy initialization with `flyctl launch`
- **Configuration**: `fly.toml` and secrets management
- **Deployment**: Zero-downtime rolling deployments
- **Scaling**: Horizontal and vertical scaling
- **Monitoring**: Logs, metrics, health checks
- **Troubleshooting**: Common issues and solutions
- **Rollback**: Quick recovery procedures

**Next Steps**:

1. Set up staging environment (`hospeda-api-staging`)
2. Configure CI/CD for automated deployments
3. Set up monitoring and alerting
4. Perform load testing
5. Document incident response procedures

**Resources**:

- Fly.io Docs: <https://fly.io/docs>
- Hono Docs: <https://hono.dev>
- Hospeda API Source: `/apps/api`

**Support**:

- Fly.io Community: <https://community.fly.io>
- Fly.io Support: <support@fly.io>
- Internal: #hospeda-devops Slack channel

---

**Deployment Status**: ✅ Ready for Production

**Last Updated**: 2025-01-05
**Author**: Tech Writer Agent
**Version**: 1.0.0
