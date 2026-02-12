---
name: github-actions-patterns
description: GitHub Actions CI/CD patterns. Use when creating workflows, matrix builds, caching strategies, or deployment pipelines.
---

# GitHub Actions Patterns

## Purpose

Provide patterns for CI/CD workflows with GitHub Actions, including workflow syntax, job configuration, caching strategies, matrix builds, environment management, secrets handling, reusable workflows, and deployment pipelines.

## Basic CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
```

## Matrix Builds

```yaml
jobs:
  test:
    name: Test (Node ${{ matrix.node-version }}, ${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18, 20, 22]
        exclude:
          - os: macos-latest
            node-version: 18

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

## Caching Strategies

### Dependency Caching

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: pnpm/action-setup@v4
    with:
      version: 9

  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: "pnpm"

  # Built-in cache with setup-node handles node_modules
  - run: pnpm install --frozen-lockfile
```

### Custom Cache

```yaml
steps:
  - uses: actions/cache@v4
    id: build-cache
    with:
      path: |
        .next/cache
        node_modules/.cache
      key: ${{ runner.os }}-build-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('src/**') }}
      restore-keys: |
        ${{ runner.os }}-build-${{ hashFiles('**/pnpm-lock.yaml') }}-
        ${{ runner.os }}-build-
```

## Environments and Secrets

```yaml
jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
      - run: pnpm deploy:staging

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm deploy:production
```

## Reusable Workflows

### Callable Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      url:
        required: true
        type: string
    secrets:
      DEPLOY_TOKEN:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: ${{ inputs.environment }}
      url: ${{ inputs.url }}
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

### Caller Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  deploy-staging:
    needs: [ci]
    uses: ./.github/workflows/deploy.yml
    with:
      environment: staging
      url: https://staging.example.com
    secrets:
      DEPLOY_TOKEN: ${{ secrets.STAGING_DEPLOY_TOKEN }}

  deploy-production:
    needs: [deploy-staging]
    uses: ./.github/workflows/deploy.yml
    with:
      environment: production
      url: https://example.com
    secrets:
      DEPLOY_TOKEN: ${{ secrets.PRODUCTION_DEPLOY_TOKEN }}
```

## Service Containers

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
          REDIS_URL: redis://localhost:6379
```

## Docker Build and Push

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Release with Changesets

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"
      - run: pnpm install --frozen-lockfile
      - uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Conditional Steps

```yaml
steps:
  - name: Deploy docs
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    run: pnpm deploy:docs

  - name: Comment PR
    if: github.event_name == 'pull_request'
    uses: actions/github-script@v7
    with:
      script: |
        github.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: 'Build succeeded!'
        })
```

## Best Practices

- Use `concurrency` with `cancel-in-progress: true` to avoid redundant runs on rapid pushes
- Cache dependencies using `actions/setup-node` with the `cache` option for fast installs
- Use `--frozen-lockfile` in CI to ensure deterministic dependency resolution
- Split CI into parallel jobs (lint, typecheck, test) for faster feedback
- Use `fail-fast: false` in matrix builds to see all failures, not just the first
- Use GitHub environments with protection rules for deployment approvals
- Never hardcode secrets; use `${{ secrets.NAME }}` and configure in repository settings
- Use reusable workflows (`workflow_call`) to share CI/CD logic across repositories
- Use service containers for integration tests with databases and caches
- Use Docker BuildKit layer caching (`type=gha`) for faster image builds
- Pin action versions to specific major versions (e.g., `@v4`) for stability
- Use `permissions` to follow the principle of least privilege for GITHUB_TOKEN
