import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: ['test/**/*.test.ts'],
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
                'src/utils/validateManifestVsFolder.ts'
            ]
        }
    }
});
