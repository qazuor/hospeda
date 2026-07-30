import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        pool: 'forks',
        maxWorkers: 3,
        include: ['test/**/*.test.ts', 'src/**/*.test.ts']
    }
});
