---
name: docker-patterns
description: Docker containerization patterns. Use when writing Dockerfiles, multi-stage builds, docker-compose, or container security hardening.
---

# Docker Patterns

## Purpose

Provide patterns for containerizing applications with Docker, including Dockerfile best practices, multi-stage builds, docker-compose orchestration, volume management, networking, health checks, and security hardening.

## Multi-Stage Dockerfile (Node.js)

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

## Multi-Stage Dockerfile (Next.js)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

## Docker Compose

### Development Environment

```yaml
# docker-compose.yml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:pass@db:5432/appdb
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: appdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Production Environment

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    restart: unless-stopped
```

## .dockerignore

```
node_modules
.git
.gitignore
.env*
!.env.example
Dockerfile*
docker-compose*
.next
dist
coverage
*.md
.vscode
.idea
```

## Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY . .

EXPOSE 3000
CMD ["pnpm", "dev"]
```

## Volume Patterns

```yaml
# Named volumes for persistent data
volumes:
  postgres_data:
    driver: local

# Bind mount for development
services:
  app:
    volumes:
      - .:/app                # Source code (bind mount)
      - /app/node_modules     # Exclude node_modules from bind mount

# Read-only bind mount for config
services:
  nginx:
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

## Network Patterns

```yaml
services:
  app:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend

  nginx:
    networks:
      - frontend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access
```

## Health Check Patterns

```dockerfile
# HTTP health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# TCP health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD pg_isready -U postgres || exit 1
```

## Useful Commands

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f app

# Run one-off command
docker compose exec app pnpm migrate

# Stop and remove containers, volumes
docker compose down -v

# Prune unused images and build cache
docker system prune -af
```

## Best Practices

- Use multi-stage builds to minimize production image size
- Run containers as a non-root user with `adduser` and `USER`
- Use `.dockerignore` to exclude unnecessary files from the build context
- Pin base image versions (e.g., `node:20-alpine`, not `node:latest`)
- Use `--frozen-lockfile` for deterministic installs in CI/Docker
- Add health checks to all services for proper orchestration
- Use named volumes for persistent data (databases, caches)
- Exclude `node_modules` from bind mounts with anonymous volume trick
- Use `internal: true` on backend networks to isolate database access
- Set resource limits in production to prevent runaway containers
- Use `depends_on` with `condition: service_healthy` for proper startup order
- Keep secrets in environment files (`.env.production`), never in Dockerfiles
