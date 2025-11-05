# Guide: Environment Configuration

Guide to environment-specific seeding strategies for development, testing, staging, and production environments.

## Environment Types

### Development
Full seeds with realistic test data for local development.

### Testing
Minimal seeds for fast test execution.

### Staging
Production-like data for final validation.

### Production
Required data only, no example seeds.

## Environment-Specific Commands

```bash
# Development
pnpm seed --reset --required --example

# Testing (CI/CD)
pnpm seed --reset --required --example --continueOnError

# Staging
pnpm seed --required --migrate

# Production
pnpm seed --required --migrate
```

## Environment Variables

```bash
# Development
DATABASE_URL=postgresql://localhost:5432/hospeda_dev

# Testing
DATABASE_URL=postgresql://localhost:5432/hospeda_test

# Production
DATABASE_URL=postgresql://prod-host/hospeda_prod
```

## Best Practices

1. **Never run example seeds in production**
2. **Use --reset carefully in shared environments**
3. **Test seeds in CI/CD pipeline**
4. **Document environment requirements**
5. **Version control seed data**

---

Last updated: 2024-11-05
