# Common Tasks

Quick reference for frequently used commands and tasks in Hospeda development.

---

## Daily Development

### Start Development Servers

```bash
# Start all apps (API + Web + Admin)
pnpm dev

# Start specific app
pnpm dev --filter=api        # API only
pnpm dev --filter=web        # Web only
pnpm dev --filter=admin      # Admin only
```

**Access points:**

- API: <http://localhost:3000>
- Web: <http://localhost:4321>
- Admin: <http://localhost:3001>

---

### Stop Services

```bash
# Stop dev servers
Ctrl + C  # In terminal where pnpm dev is running

# Stop database
pnpm db:stop
```

---

## Database Operations

### Start/Stop Database

```bash
# Start PostgreSQL + Redis
pnpm db:start

# Stop databases
pnpm db:stop

# Restart databases
pnpm db:restart
```

---

### Reset Database

```bash
# Complete reset (removes all data)
pnpm db:fresh

# Reset without sudo
pnpm db:fresh-no-sudo

# Reset preserving volumes
pnpm db:reset
```

**What `db:fresh` does:**

1. Stops and removes containers
2. Deletes all volumes
3. Starts fresh containers
4. Runs migrations
5. Seeds database with initial data

---

### Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Both generate and migrate
pnpm db:generate && pnpm db:migrate
```

---

### Database Tools

```bash
# Open Drizzle Studio (GUI)
pnpm db:studio
# Access: http://localhost:4983

# View database logs
pnpm db:logs

# Open pgAdmin
pnpm pgadmin:start
# Access: http://localhost:8080
```

---

### Seed Data

```bash
# Seed with all data (required + examples)
pnpm db:seed

# Seed only required data
pnpm --filter @repo/seed seed --required

# Seed only example data
pnpm --filter @repo/seed seed --example
```

---

## Testing

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Test specific package
pnpm --filter @repo/db test
pnpm --filter @repo/service-core test:coverage
```

---

### Test Specific Files

```bash
# From package directory
cd packages/schemas
pnpm test user.schema.test.ts

# From project root
pnpm --filter @repo/schemas test user.schema.test.ts
```

---

### Debug Tests

```bash
# Run with debugger
pnpm test --inspect-brk

# Then attach VSCode debugger (F5)
```

---

## Quality Checks

### Type Checking

```bash
# Check all packages
pnpm typecheck

# Check specific package
pnpm --filter @repo/db typecheck
cd packages/db && pnpm run typecheck
```

---

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter api lint
cd apps/api && pnpm run lint
```

---

### Formatting

```bash
# Format TypeScript/JavaScript (Biome)
pnpm check

# Format Markdown
pnpm format:md

# Format .claude docs only
pnpm format:md:claude

# Check markdown without fixing
pnpm lint:md
```

---

### Run All Checks

```bash
# Before committing
pnpm lint && pnpm typecheck && pnpm test
```

---

## Building

### Build All

```bash
# Build all apps and packages
pnpm build
```

---

### Build Specific Apps

```bash
# Build API
pnpm build:api

# Build specific package
pnpm --filter @repo/db build
```

---

## Git Operations

### Check Status

```bash
# Short status
git status --short

# Detailed status
git status
```

---

### Stage Files

```bash
# Stage specific files (RECOMMENDED)
git add path/to/file.ts

# Stage multiple files
git add file1.ts file2.ts file3.ts

# AVOID: Staging all changes
# git add .  # NOT RECOMMENDED
```

---

### Create Commit

```bash
# Commit with message
git commit -m "feat(scope): description"

# Commit with multi-line message
git commit -m "$(cat <<'EOF'
feat(scope): short description

- Detailed change 1
- Detailed change 2
- Detailed change 3
EOF
)"

# Amend last commit (use carefully)
git commit --amend
```

**Commit types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Maintenance tasks

---

### View History

```bash
# Recent commits
git log --oneline -10

# Detailed last commit
git log -1

# Show changes in commit
git show HEAD

# Show specific commit
git show <commit-hash>
```

---

### Undo Changes

```bash
# Unstage file
git reset HEAD <file>

# Discard changes in working directory
git checkout -- <file>

# Reset to last commit (DANGEROUS)
git reset --hard HEAD
```

---

## Package Management

### Install Dependencies

```bash
# Install all dependencies
pnpm install

# Install for specific package
pnpm --filter @repo/db install

# Add new dependency
pnpm add package-name --filter @repo/db

# Add dev dependency
pnpm add -D package-name --filter api
```

---

### Update Dependencies

```bash
# Update all
pnpm update

# Update specific package
pnpm update typescript

# Check outdated packages
pnpm outdated
```

---

### Clean Install

```bash
# Remove and reinstall
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

## Monorepo Tasks

### List Packages

```bash
# List all packages
pnpm list --depth=0

# List packages with filter
pnpm list --filter @repo/*
```

---

### Run Command in Package

```bash
# Using filter (from root)
pnpm --filter @repo/db <command>

# Using cd (from anywhere)
cd packages/db && pnpm run <command>
```

---

### Link Local Packages

```bash
# Already done automatically by pnpm
# No manual linking needed
```

---

## Debugging

### Debug API

```bash
# Start with debugger
cd apps/api
pnpm dev

# Attach VSCode debugger (F5)
```

---

### Debug Tests with Breakpoints

```bash
# Run test with debugger
pnpm test --inspect-brk <test-file>

# Attach VSCode debugger (F5)
```

---

### View Logs

```bash
# Database logs
pnpm db:logs

# Docker logs
docker logs hospeda_postgres
docker logs hospeda_redis
```

---

## Troubleshooting

### TypeScript Errors

```bash
# Rebuild all packages
pnpm build

# Restart TypeScript server (VSCode)
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

---

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :5432

# Kill process
kill -9 <PID>
```

---

### Database Connection Issues

```bash
# Check containers
docker ps

# Restart database
pnpm db:restart

# Complete reset
pnpm db:fresh
```

---

### Module Not Found

```bash
# Clean install
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install

# Rebuild packages
pnpm build
```

---

### Tests Failing

```bash
# Clear test cache
pnpm test --clearCache

# Rebuild and test
pnpm build && pnpm test
```

---

## Environment Management

### Environment Files

```bash
# Copy example
cp .env.example .env.local

# Edit environment
code .env.local

# Validate environment
pnpm dev  # Will fail if vars missing
```

---

### Switch Environments

```bash
# Development (default)
# Uses .env.local

# Production
NODE_ENV=production pnpm build

# Test
NODE_ENV=test pnpm test
```

---

## Documentation

### View Documentation

```bash
# Open main docs
code docs/index.md

# Open getting started
code docs/getting-started/README.md

# Generate docs (if configured)
pnpm docs:build
```

---

### Update Documentation

```bash
# Format markdown
pnpm format:md

# Check links
pnpm docs:check-links

# Validate examples
pnpm docs:validate-examples
```

---

## Performance

### Check Bundle Size

```bash
# Build and check
pnpm build

# Analyze (if configured)
pnpm analyze
```

---

### Profile Performance

```bash
# Profile API
NODE_ENV=production pnpm --filter api build
# Use tools like autocannon for load testing
```

---

## Quick Workflows

### New Feature Workflow

```bash
# 1. Ensure latest code
git pull

# 2. Start fresh database
pnpm db:fresh

# 3. Start dev servers
pnpm dev

# 4. Make changes...

# 5. Run checks
pnpm lint && pnpm typecheck && pnpm test

# 6. Commit
git add <files>
git commit -m "feat(scope): description"
```

---

### Bug Fix Workflow

```bash
# 1. Write failing test
code packages/.../test/file.test.ts

# 2. Run test (should fail)
pnpm test file.test.ts

# 3. Fix the bug
code packages/.../src/file.ts

# 4. Run test (should pass)
pnpm test file.test.ts

# 5. Run all tests
pnpm test

# 6. Commit
git add <files>
git commit -m "fix(scope): description"
```

---

### Database Schema Change Workflow

```bash
# 1. Modify schema
code packages/db/src/schemas/table.schema.ts

# 2. Generate migration
pnpm db:generate

# 3. Review migration
code packages/db/drizzle/<timestamp>_*.sql

# 4. Apply migration
pnpm db:migrate

# 5. Update model/service if needed

# 6. Test changes
pnpm db:studio

# 7. Commit
git add packages/db/
git commit -m "feat(db): add new table/field"
```

---

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# Project aliases
alias hospeda="cd ~/projects/hospeda"
alias h-dev="pnpm dev"
alias h-test="pnpm test"
alias h-db="pnpm db:fresh"
alias h-check="pnpm lint && pnpm typecheck && pnpm test"
```

---

## Keyboard Shortcuts Reference

### VSCode

- `Cmd/Ctrl + P` - Quick file open
- `Cmd/Ctrl + Shift + P` - Command palette
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + J` - Toggle terminal
- `F5` - Start debugging
- `F12` - Go to definition

### Terminal

- `Ctrl + C` - Stop process
- `Ctrl + L` - Clear terminal
- `Ctrl + R` - Search history
- `↑/↓` - Navigate history

---

## Getting Help

**Can't find the command you need?**

- Check [Installation](installation.md) for setup commands
- Check [Development Environment](development-environment.md) for VSCode commands
- Check package.json scripts: `cat package.json | grep scripts -A 50`
- Ask in [Discussions](https://github.com/qazuor/hospeda/discussions)

**Command not working?**

- Verify you're in correct directory
- Check you have latest dependencies: `pnpm install`
- Try from project root vs package directory
- See [Troubleshooting](../resources/troubleshooting.md)

---

**Need more help?** → [Troubleshooting](../resources/troubleshooting.md)

**Ready for more?** → [Adding a New Entity](../guides/adding-new-entity.md)
