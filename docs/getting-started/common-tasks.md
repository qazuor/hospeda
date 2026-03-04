# Common Tasks

Quick reference cheatsheet for Hospeda development. For full command listings, see [CLAUDE.md](../../CLAUDE.md).

---

## Quick Workflows

### New Feature

```bash
git pull
pnpm db:fresh
pnpm dev
# ... make changes ...
pnpm lint && pnpm typecheck && pnpm test
git add <files>
git commit -m "feat(scope): description"
```

### Bug Fix (Test-First)

```bash
# 1. Write failing test
# 2. Run test (should fail)
pnpm --filter @repo/db test user.model.test.ts
# 3. Fix the bug
# 4. Run test (should pass)
# 5. Run all tests
pnpm test
# 6. Commit
git add <files>
git commit -m "fix(scope): description"
```

### Database Schema Change

```bash
# 1. Modify schema file
# 2. Generate migration
pnpm db:generate
# 3. Review migration SQL
# 4. Apply migration
pnpm db:migrate
# 5. Test changes
pnpm db:studio
# 6. Commit
git add packages/db/
git commit -m "feat(db): add new table/field"
```

---

## Seed Data Options

```bash
pnpm db:seed                                # All data (required + examples)
pnpm --filter @repo/seed seed --required    # Only required data
pnpm --filter @repo/seed seed --example     # Only example data
```

---

## Running Commands in Specific Packages

```bash
# Using filter (from root)
pnpm --filter @repo/db <command>
pnpm --filter @repo/schemas test user.schema.test.ts

# From package directory
cd packages/db && pnpm run <command>
```

---

## Database Tools

```bash
pnpm db:studio       # Drizzle Studio GUI (http://localhost:4983)
pnpm db:logs         # View database logs
pnpm pgadmin:start   # pgAdmin (http://localhost:8080)
```

---

## Debugging

```bash
# Debug tests with breakpoints
pnpm test --inspect-brk <test-file>
# Then attach VSCode debugger (F5)

# View container logs
docker logs hospeda_postgres
docker logs hospeda_redis
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| TypeScript errors after changes | `pnpm build` to rebuild all packages |
| TS server stale in VSCode | Cmd/Ctrl+Shift+P then "TypeScript: Restart TS Server" |
| Port already in use | `lsof -i :3000` then `kill -9 <PID>` |
| Database connection issues | `pnpm db:restart` or `pnpm db:fresh` |
| Module not found | `rm -rf node_modules && pnpm install && pnpm build` |
| Tests failing after changes | `pnpm build && pnpm test` |

---

## Access Points

| Service | URL |
|---------|-----|
| API | <http://localhost:3001> |
| Web | <http://localhost:4321> |
| Admin | <http://localhost:3000> |

---

## Further Reading

- [Installation](installation.md) - Initial setup
- [Development Environment](development-environment.md) - IDE configuration
- [Troubleshooting](../resources/troubleshooting.md) - Detailed troubleshooting guide
