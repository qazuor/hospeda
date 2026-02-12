---
name: ci-cd-patterns
description: CI/CD pipeline patterns for GitHub Actions. Use when setting up workflows, build caching, matrix builds, or deployment strategies.
---

# CI/CD Patterns

## Purpose

Reference for CI/CD pipeline patterns with a focus on GitHub Actions. Covers workflow structure, build/test/deploy stages, caching strategies, matrix builds, environment secrets, reusable workflows, and deployment strategies.

## Activation

Use this skill when the user asks about:

- GitHub Actions workflows
- CI/CD pipeline design
- Build, test, or deploy automation
- Caching in CI pipelines
- Matrix builds
- Environment secrets management
- Deployment strategies (blue-green, canary, rolling)

## GitHub Actions Fundamentals

### Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:              # Manual trigger

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true       # Cancel previous runs on same branch

permissions:
  contents: read
  pull-requests: write

env:
  NODE_VERSION: "20"
  PNPM_VERSION: "9"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
          retention-days: 7
```

### Trigger Patterns

```yaml
on:
  # Push to specific branches
  push:
    branches: [main, "release/**"]
    paths:
      - "src/**"
      - "package.json"
      - "pnpm-lock.yaml"
    paths-ignore:
      - "docs/**"
      - "*.md"

  # Pull request events
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

  # Scheduled (cron)
  schedule:
    - cron: "0 6 * * 1"         # Every Monday at 6 AM UTC

  # Manual with inputs
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options:
          - staging
          - production
      dry_run:
        description: "Dry run mode"
        type: boolean
        default: false

  # On release
  release:
    types: [published]

  # Called by another workflow
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      deploy_key:
        required: true
```

## Caching Strategies

### Node.js / pnpm Cache

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: "pnpm"          # Built-in caching for pnpm

# For more control:
- name: Get pnpm store directory
  shell: bash
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: pnpm-store-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      pnpm-store-${{ runner.os }}-
```

### Turborepo Remote Cache

```yaml
- name: Build with Turbo cache
  run: pnpm turbo build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

### Docker Layer Cache

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: myapp:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### General Cache Pattern

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  id: playwright-cache
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}

- name: Install Playwright (cache miss only)
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: pnpm exec playwright install --with-deps
```

## Matrix Builds

### Basic Matrix

```yaml
test:
  runs-on: ${{ matrix.os }}
  strategy:
    fail-fast: false                   # Do not cancel other jobs if one fails
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
      node-version: [18, 20, 22]
      exclude:
        - os: windows-latest
          node-version: 18
      include:
        - os: ubuntu-latest
          node-version: 20
          coverage: true               # Extra variable for this combination

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}

    - run: npm test

    - name: Upload coverage
      if: matrix.coverage
      run: npm run coverage:upload
```

### Dynamic Matrix

```yaml
prepare:
  runs-on: ubuntu-latest
  outputs:
    packages: ${{ steps.find.outputs.packages }}
  steps:
    - uses: actions/checkout@v4
    - id: find
      run: |
        PACKAGES=$(ls -d packages/*/package.json | jq -R -s -c 'split("\n")[:-1] | map(split("/")[1])')
        echo "packages=$PACKAGES" >> $GITHUB_OUTPUT

test:
  needs: prepare
  runs-on: ubuntu-latest
  strategy:
    matrix:
      package: ${{ fromJson(needs.prepare.outputs.packages) }}
  steps:
    - uses: actions/checkout@v4
    - run: pnpm test --filter=${{ matrix.package }}
```

## Environment and Secrets

### Environment Configuration

```yaml
deploy:
  runs-on: ubuntu-latest
  environment:
    name: production
    url: https://myapp.com
  steps:
    - name: Deploy
      run: ./deploy.sh
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
        API_KEY: ${{ secrets.API_KEY }}
        APP_URL: ${{ vars.APP_URL }}          # Non-secret variable
```

### Secret Management Best Practices

1. **Never echo secrets** - They are masked but avoid `echo $SECRET` in logs
2. **Use environment-scoped secrets** - Different secrets for staging vs production
3. **Use `vars` for non-sensitive config** - URLs, feature flags, region names
4. **Rotate secrets regularly** - Use GitHub's secret scanning alerts
5. **Use OIDC for cloud providers** - Avoid long-lived credentials

```yaml
# OIDC authentication for AWS (no stored credentials)
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789:role/github-actions
      aws-region: us-east-1
```

## Reusable Workflows

### Defining a Reusable Workflow

```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      app_name:
        required: true
        type: string
      node_version:
        required: false
        type: string
        default: "20"
    secrets:
      deploy_token:
        required: true
    outputs:
      deploy_url:
        description: "Deployed URL"
        value: ${{ jobs.deploy.outputs.url }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node_version }}
      - run: npm ci && npm run build
      - id: deploy
        run: |
          URL=$(./deploy.sh ${{ inputs.app_name }} ${{ inputs.environment }})
          echo "url=$URL" >> $GITHUB_OUTPUT
        env:
          DEPLOY_TOKEN: ${{ secrets.deploy_token }}
```

### Calling a Reusable Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      app_name: myapp
    secrets:
      deploy_token: ${{ secrets.STAGING_DEPLOY_TOKEN }}

  deploy-production:
    needs: deploy-staging
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      app_name: myapp
    secrets:
      deploy_token: ${{ secrets.PROD_DEPLOY_TOKEN }}
```

## Composite Actions

```yaml
# .github/actions/setup-project/action.yml
name: "Setup Project"
description: "Install dependencies and setup environment"

inputs:
  node-version:
    description: "Node.js version"
    required: false
    default: "20"

runs:
  using: "composite"
  steps:
    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: "pnpm"

    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile

# Usage in a workflow:
# - uses: ./.github/actions/setup-project
#   with:
#     node-version: "20"
```

## Deployment Strategies

### Preview Deployments (PR)

```yaml
preview:
  if: github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci && npm run build

    - name: Deploy Preview
      id: deploy
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

    - name: Comment PR
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `Preview deployed: ${{ steps.deploy.outputs.preview-url }}`
          })
```

### Blue-Green Deployment

```yaml
deploy:
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to green
      run: ./deploy.sh green

    - name: Health check green
      run: |
        for i in {1..10}; do
          if curl -sf https://green.myapp.com/health; then
            echo "Green is healthy"
            break
          fi
          sleep 10
        done

    - name: Switch traffic to green
      run: ./switch-traffic.sh green

    - name: Monitor for 5 minutes
      run: |
        sleep 300
        if ! ./check-error-rate.sh; then
          echo "Error rate too high, rolling back"
          ./switch-traffic.sh blue
          exit 1
        fi
```

### Release Pipeline

```yaml
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test

  build:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  publish:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"

      - run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

## Pipeline Optimization Tips

| Optimization | Impact | How |
|---|---|---|
| Parallel jobs | Large | Split lint/typecheck/test into separate jobs |
| Dependency caching | Large | Use `actions/cache` or built-in setup caching |
| `fail-fast: false` | Medium | Get full test results instead of stopping early |
| `concurrency` groups | Medium | Cancel stale runs on same branch |
| `paths` filtering | Medium | Skip CI for docs-only changes |
| Composite actions | Medium | DRY up repeated setup steps |
| Turborepo remote cache | Large (monorepo) | Share build cache across CI runs |
| Artifact passing | Medium | Build once, deploy to multiple environments |
| ARM runners | Cost | `ubuntu-latest-arm64` is cheaper |
| Conditional steps | Small | Skip unnecessary steps with `if:` |
