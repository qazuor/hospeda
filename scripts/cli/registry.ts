import type { CliCommand } from './types.js';

/** All 45 curated commands for the Hospeda CLI */
const CURATED_COMMANDS: readonly CliCommand[] = [
    // ── Development (5) ──────────────────────────────────────
    {
        id: 'dev',
        description: 'Start all apps via turbo',
        category: 'development',
        execution: { type: 'pnpm-root', script: 'dev' },
        source: 'root',
        mode: 'long-running',
        curated: true
    },
    {
        id: 'dev:all',
        description: 'Start all dev servers with Docker check',
        category: 'development',
        execution: { type: 'shell', command: './scripts/dev.sh' },
        source: 'root',
        mode: 'long-running',
        curated: true,
        argHint: '--api-only, --admin-only, --web-only, --no-api, --no-admin, --no-web'
    },
    {
        id: 'dev:admin',
        description: 'Start admin with Vite cache clearing',
        category: 'development',
        execution: { type: 'shell', command: 'node scripts/dev-admin.js' },
        source: 'root',
        mode: 'long-running',
        curated: true
    },
    {
        id: 'pgadmin:start',
        description: 'Start pgAdmin container',
        category: 'development',
        execution: { type: 'pnpm-root', script: 'pgadmin:start' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'pgadmin:stop',
        description: 'Stop pgAdmin container',
        category: 'development',
        execution: { type: 'pnpm-root', script: 'pgadmin:stop' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },

    // ── Database (13) ────────────────────────────────────────
    {
        id: 'db:start',
        description: 'Start PostgreSQL + Redis containers',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:start' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'db:stop',
        description: 'Stop database containers',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:stop' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'db:restart',
        description: 'Restart database containers',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:restart' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'db:reset',
        description: 'Drop volumes + recreate + migrate',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:reset' },
        source: 'root',
        mode: 'one-shot',
        curated: true,
        dangerous: true,
        dangerMessage:
            'DROP all database volumes, recreate containers, and run migrations. All data will be lost.'
    },
    {
        id: 'db:fresh',
        description: 'Drop + recreate + migrate + seed',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:fresh' },
        source: 'root',
        mode: 'one-shot',
        curated: true,
        dangerous: true,
        dangerMessage:
            'DROP all database volumes, recreate containers, run migrations, and seed. All data will be lost.'
    },
    {
        id: 'db:fresh-dev',
        description: 'Drop + recreate + push schema + seed',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:fresh-dev' },
        source: 'root',
        mode: 'one-shot',
        curated: true,
        dangerous: true,
        dangerMessage:
            'DROP all database volumes, recreate containers, push schema, and seed. All data will be lost.'
    },
    {
        id: 'db:logs',
        description: 'Stream PostgreSQL container logs',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:logs' },
        source: 'root',
        mode: 'long-running',
        curated: true
    },
    {
        id: 'db:migrate',
        description: 'Apply pending Drizzle migrations',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:migrate' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'db:migrate:prod',
        description: 'Run production migration with backup',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:migrate:prod' },
        source: 'root',
        mode: 'interactive',
        curated: true,
        dangerous: true,
        dangerMessage:
            'Run migrations against the PRODUCTION database. Make sure you have a backup.'
    },
    {
        id: 'db:generate',
        description: 'Generate migration from schema changes',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:generate' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'db:studio',
        description: 'Open Drizzle Studio',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:studio' },
        source: 'root',
        mode: 'long-running',
        curated: true
    },
    {
        id: 'db:seed',
        description: 'Reset + seed required + example data',
        category: 'database',
        execution: { type: 'pnpm-root', script: 'db:seed' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'db:push',
        description: 'Push schema directly (no migration)',
        category: 'database',
        execution: { type: 'pnpm-filter', filter: '@repo/db', script: 'db:push' },
        source: '@repo/db',
        mode: 'one-shot',
        curated: true
    },

    // ── Testing (5) ──────────────────────────────────────────
    {
        id: 'test',
        description: 'Run all tests (turbo, 4 concurrent)',
        category: 'testing',
        execution: { type: 'pnpm-root', script: 'test' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'test:watch',
        description: 'Run tests in watch mode',
        category: 'testing',
        execution: { type: 'pnpm-root', script: 'test:watch' },
        source: 'root',
        mode: 'long-running',
        curated: true
    },
    {
        id: 'test:coverage',
        description: 'Run tests with coverage report',
        category: 'testing',
        execution: { type: 'pnpm-root', script: 'test:coverage' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'api:test:e2e',
        description: 'Run API E2E tests (Vitest E2E config)',
        category: 'testing',
        execution: { type: 'pnpm-filter', filter: 'hospeda-api', script: 'test:e2e' },
        source: 'hospeda-api',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'api:test:e2e:watch',
        description: 'Run API E2E tests in watch mode',
        category: 'testing',
        execution: { type: 'pnpm-filter', filter: 'hospeda-api', script: 'test:e2e:watch' },
        source: 'hospeda-api',
        mode: 'long-running',
        curated: true
    },

    // ── Code Quality (7) ─────────────────────────────────────
    {
        id: 'lint',
        description: 'Run Biome linting (turbo)',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'lint' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'format',
        description: 'Run Biome formatting (turbo)',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'format' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'check',
        description: 'Biome check + auto-fix',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'check' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'typecheck',
        description: 'TypeScript validation (all packages)',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'typecheck' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'format:md',
        description: 'Format all markdown files',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'format:md' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'lint:md',
        description: 'Lint all markdown files',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'lint:md' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'lint:md:docs',
        description: 'Lint only docs/ markdown files',
        category: 'code-quality',
        execution: { type: 'pnpm-root', script: 'lint:md:docs' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },

    // ── Build (3) ────────────────────────────────────────────
    {
        id: 'build',
        description: 'Build all packages (turbo)',
        category: 'build',
        execution: { type: 'pnpm-root', script: 'build' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'build:api',
        description: 'Build API for production',
        category: 'build',
        execution: { type: 'pnpm-root', script: 'build:api' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'clean',
        description: 'Remove all build artifacts',
        category: 'build',
        execution: { type: 'pnpm-root', script: 'clean' },
        source: 'root',
        mode: 'one-shot',
        curated: true,
        dangerous: true,
        dangerMessage:
            'Remove all build artifacts (dist/, .output/, node_modules/.cache/) across the monorepo.'
    },

    // ── Environment (3) ──────────────────────────────────────
    {
        id: 'env:pull',
        description: 'Pull env vars from Vercel to local',
        category: 'environment',
        execution: { type: 'pnpm-root', script: 'env:pull' },
        source: 'root',
        mode: 'interactive',
        curated: true
    },
    {
        id: 'env:push',
        description: 'Push local env vars to Vercel',
        category: 'environment',
        execution: { type: 'pnpm-root', script: 'env:push' },
        source: 'root',
        mode: 'interactive',
        curated: true
    },
    {
        id: 'env:check',
        description: 'Validate env vars against registry',
        category: 'environment',
        execution: { type: 'pnpm-root', script: 'env:check' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },

    // ── Documentation (3) ────────────────────────────────────
    {
        id: 'docs:check-links',
        description: 'Validate internal links in markdown docs',
        category: 'documentation',
        execution: { type: 'pnpm-root', script: 'docs:check-links' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'docs:validate-examples',
        description: 'Validate TypeScript code blocks in docs',
        category: 'documentation',
        execution: { type: 'pnpm-root', script: 'docs:validate-examples' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'create-docs-structure',
        description: 'Generate documentation folder structure',
        category: 'documentation',
        execution: { type: 'shell', command: 'tsx scripts/create-docs-structure.ts' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },

    // ── Infrastructure (1) ───────────────────────────────────
    {
        id: 'setup-test-db',
        description: 'Initialize test database on port 5433',
        category: 'infrastructure',
        execution: { type: 'shell', command: 'tsx scripts/setup-test-db.ts' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    },

    // ── Package Tools (5) ────────────────────────────────────
    {
        id: 'seed',
        description: 'Interactive seeding CLI',
        category: 'package-tools',
        execution: { type: 'pnpm-filter', filter: '@repo/seed', script: 'seed' },
        source: '@repo/seed',
        mode: 'interactive',
        curated: true
    },
    {
        id: 'seed:required',
        description: 'Seed only system/required data',
        category: 'package-tools',
        execution: { type: 'pnpm-filter', filter: '@repo/seed', script: 'seed:required' },
        source: '@repo/seed',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'seed:example',
        description: 'Seed example/demo data',
        category: 'package-tools',
        execution: { type: 'pnpm-filter', filter: '@repo/seed', script: 'seed:example' },
        source: '@repo/seed',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'i18n:generate-types',
        description: 'Generate TS types from locale files',
        category: 'package-tools',
        execution: { type: 'pnpm-filter', filter: '@repo/i18n', script: 'generate-types' },
        source: '@repo/i18n',
        mode: 'one-shot',
        curated: true
    },
    {
        id: 'telemetry:report',
        description: 'Generate Claude Code telemetry report',
        category: 'package-tools',
        execution: { type: 'pnpm-root', script: 'telemetry:report' },
        source: 'root',
        mode: 'one-shot',
        curated: true
    }
] as const;

/**
 * Returns the frozen array of all curated CLI commands.
 * These are hand-picked commands with accurate descriptions and metadata.
 */
export function getCuratedCommands(): readonly CliCommand[] {
    return CURATED_COMMANDS;
}
