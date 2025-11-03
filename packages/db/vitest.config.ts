import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            exclude: ['**/test/**/mocks/**', '**/*.d.ts']
        },
        ui: false,
        include: ['test/**/*.test.ts'],
        exclude: ['node_modules', 'dist', 'build']
        // setupFiles: ['src/test/setupTest.ts']
    }
});
