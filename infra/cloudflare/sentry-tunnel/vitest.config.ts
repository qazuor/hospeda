import { defineConfig } from 'vitest/config';

/**
 * Isolated Vitest config for the Sentry tunnel Worker.
 *
 * Kept local (not inheriting the repo-root config) so the Worker test runs in a
 * plain Node environment and is scoped to this package only.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.ts'],
        globals: false
    }
});
