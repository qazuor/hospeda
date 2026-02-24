import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        }
    }
});
