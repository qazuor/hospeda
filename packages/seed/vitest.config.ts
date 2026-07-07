import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        maxWorkers: 3,
        include: ['test/**/*.test.ts'],
        exclude: [
            'node_modules',
            'dist',
            // HOS-25: real-PostgreSQL data-migration tests run in the
            // integration carril (`vitest.integration.config.ts` + its
            // globalSetup), NOT the sharded unit job which has no database.
            // The unit job's bare `new Pool(HOSPEDA_DATABASE_URL)` bootstrap
            // would throw in `beforeAll` here. Excluded so nothing runs twice.
            'test/integration/**',
            'test/**/*.integration.test.ts'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 85,
                statements: 90
            },
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/**/index.ts',
                'src/cli.ts',
                // Seed scripts are end-to-end DB population scripts that
                // run against a real PostgreSQL instance via `pnpm db:seed`.
                // Their factories/normalizers cannot be exercised in unit
                // tests without a database; they're verified by the seed
                // integration tests under `test/integration/`.
                'src/example/**/*.seed.ts',
                'src/required/**/*.seed.ts',
                'src/test-users/**/*.seed.ts',
                // DB-dependent utilities that cannot run without a live
                // PostgreSQL connection. They're exercised through the
                // seed integration suite (`pnpm db:seed`).
                'src/utils/actor.ts',
                'src/utils/db.ts',
                'src/utils/dbReset.ts',
                'src/utils/relationBuilders.ts',
                'src/utils/serviceRelationBuilder.ts',
                'src/utils/superAdminLoader.ts',
                'src/utils/validateAllManifests.ts',
                'src/utils/validateManifestVsFolder.ts',
                // HOS-25: versioned data-migration runtime exercised ONLY by
                // the seed integration suite (real PostgreSQL — migration
                // runner, ledger, FK guard, safe-delete, baseline stamp, and
                // the ported billing-plan migrations). They cannot run without
                // a live DB, so they are excluded from unit coverage the same
                // way `src/required/**` and `src/utils/db.ts` are. The pure
                // helpers (context, discover, make, prodGate, status, types)
                // keep their unit coverage and are intentionally NOT excluded.
                'src/data-migrations/runner.ts',
                'src/data-migrations/ledger.ts',
                'src/data-migrations/baselineStamp.ts',
                'src/data-migrations/helpers/**',
                'src/data-migrations/000*.ts'
            ]
        }
    }
});
