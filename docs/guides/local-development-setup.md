# Local Development Setup

This guide covers Docker Compose setup for PostgreSQL and Redis, database initialization with Drizzle ORM, and common development commands.

## Prerequisites

### Docker and Docker Compose

PostgreSQL and Redis run in Docker containers for local development.

**Verify installation:**

```bash
docker --version       # >= 20.10
docker compose version # >= 2.0
docker info            # Verify Docker is running
```

**Installation:**

- **Ubuntu/Debian**: See [official Docker install guide](https://docs.docker.com/engine/install/ubuntu/)
- **macOS**: `brew install --cask docker`
- **Windows**: Download Docker Desktop from docker.com

### Docker Permissions (Linux)

```bash
# Add your user to the docker group to avoid sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify permissions
docker run hello-world
```

### Node.js and pnpm

Required for running Drizzle commands and seeds:

```bash
node --version  # >= 18
pnpm --version  # >= 8.15.6
```

## Quick Start

### Option 1: Full Setup (Recommended)

```bash
# Single command: start containers, migrate, and seed
pnpm db:fresh
```

### Option 2: Step by Step

```bash
# 1. Start containers
pnpm db:start

# 2. Generate migrations (if schema changed)
pnpm db:generate

# 3. Apply migrations
pnpm db:migrate

# 4. Seed the database
pnpm db:seed
```

## Docker Compose Configuration

The project uses Docker Compose to run local services:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: hospeda_postgres
    environment:
      POSTGRES_DB: hospeda_dev
      POSTGRES_USER: hospeda_user
      POSTGRES_PASSWORD: hospeda_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hospeda_user -d hospeda_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: hospeda_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: hospeda_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin123
    ports:
      - "8080:80"
    depends_on:
      postgres:
        condition: service_healthy
```

## Connection Details

### PostgreSQL

```
Host:     localhost
Port:     5432
Database: hospeda_dev
Username: hospeda_user
Password: hospeda_pass
URL:      postgresql://hospeda_user:hospeda_pass@localhost:5432/hospeda_dev
```

### Redis

```
Host: localhost
Port: 6379
No password
```

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# Database
HOSPEDA_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@localhost:5432/hospeda_dev

# Redis
HOSPEDA_REDIS_URL=redis://localhost:6379

# Authentication (Better Auth)
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key-min-32-chars
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# API
API_PORT=3001
API_HOST=localhost
```

## Database Commands

### Start and Stop

```bash
pnpm db:start     # Start PostgreSQL and Redis containers
pnpm db:stop      # Stop containers
pnpm db:restart   # Restart containers
pnpm db:logs      # View container logs
```

### Migrations

```bash
pnpm db:generate  # Generate migration from schema changes
pnpm db:migrate   # Apply pending migrations
```

**When to generate migrations:**

- After modifying files in `packages/db/src/schemas/`
- When adding new tables or columns
- When changing relationships between tables

### Seeding

```bash
pnpm db:seed      # Seed database with required and example data
```

**Seed data includes:**

- **Required data**: Super admin user, roles and permissions, basic amenities, features, attractions
- **Example data**: Test accommodations, tourist destinations, events, reviews, blog posts, user bookmarks

You can also use the CLI directly:

```bash
pnpm --filter @repo/seed seed --reset --required --example
```

### Reset

```bash
pnpm db:reset     # Reset keeping Docker volumes
pnpm db:fresh     # Full reset: drop, migrate, and seed
pnpm db:fresh-dev # Dev shortcut: push schema + seed (no migration files)
```

## Database Administration

### Drizzle Studio (Recommended)

```bash
pnpm db:studio
```

Opens a web-based interface for browsing tables, editing data, exploring relationships, and running SQL queries.

### pgAdmin (Alternative)

```bash
pnpm pgadmin:start
```

Access at `http://localhost:8080` with email `admin@example.com` and password `admin123`.

### Direct SQL Access

```bash
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev
```

## Common Workflows

### Daily Development

```bash
# Start of day
pnpm db:start

# End of day
pnpm db:stop
```

### After Schema Changes

```bash
# 1. Edit files in packages/db/src/schemas/
# 2. Generate migration
pnpm db:generate

# 3. Apply changes
pnpm db:migrate

# 4. Verify in Drizzle Studio
pnpm db:studio
```

### Fresh Start

```bash
# When something goes wrong or starting a new feature
pnpm db:fresh
```

### Database Backup and Restore

```bash
# Create backup
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev > backup.sql

# Restore backup
docker exec -i hospeda_postgres psql -U hospeda_user hospeda_dev < backup.sql
```

## Local Development Ports

| Service         | URL / Port           |
|-----------------|----------------------|
| API             | `http://localhost:3001` |
| Admin           | `http://localhost:3000` |
| Web             | `http://localhost:4321` |
| PostgreSQL      | `localhost:5432`     |
| Redis           | `localhost:6379`     |
| pgAdmin         | `http://localhost:8080` |
| Drizzle Studio  | Opens automatically  |

## Troubleshooting

### Port 5432 Already in Use

```bash
# Check what is using the port
sudo lsof -i :5432

# Stop a local PostgreSQL service
sudo systemctl stop postgresql
```

### Docker Permission Errors

```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and log back in for the change to take effect
```

### Container Fails to Start

```bash
# Check detailed logs
docker logs hospeda_postgres

# Clean up volumes and restart
docker-compose down -v
pnpm db:fresh
```

### Seeds Fail

```bash
# Verify the database is available
pnpm db:logs

# Full reset
pnpm db:fresh

# Run seeds step by step
pnpm --filter @repo/seed seed --required
pnpm --filter @repo/seed seed --example
```

### Migrations Fail

```bash
# Check migration status in Drizzle Studio
pnpm db:studio

# Regenerate migrations
pnpm --filter @repo/db db:regenerate

# Apply manually
pnpm db:migrate
```

### Cannot Connect to Docker Daemon

```bash
# Start Docker
sudo systemctl start docker

# Check Docker status
sudo systemctl status docker
```

## Monitoring

```bash
# Container healthcheck
docker ps

# Real-time logs
pnpm db:logs

# Disk usage
docker exec hospeda_postgres du -sh /var/lib/postgresql/data

# Docker resource usage
docker stats
```

## Best Practices

1. Use `pnpm db:fresh` when starting a new feature branch
2. Create backups before making important schema changes
3. Use Drizzle Studio to inspect data during development
4. Keep migrations small and focused
5. Use seeds for consistent test data across the team
6. Never manually edit required seed data

## Related Documentation

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Database Package](../../packages/db/CLAUDE.md)
