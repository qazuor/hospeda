import path from 'node:path';
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
                maxForks: 1 // integration tests are sequential -- share one DB connection pool
            }
        },
        include: ['test/integration/**/*.integration.test.ts'],
        setupFiles: [path.resolve(__dirname, 'test/integration/setup.ts')],
        testTimeout: 30000 // 30 s -- DB operations can be slow in CI
    }
});
