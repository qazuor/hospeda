/**
 * Minimal Vitest config to run the root-level shared config tests standalone.
 *
 * The root vitest.config.ts uses `test.projects` to register workspace members,
 * so the root-level test file vitest.shared.config.test.ts is not covered by
 * any project. This config is used to run it in isolation:
 *
 *   pnpm exec vitest run --config vitest.shared.config.test-runner.ts
 *
 * No workspace, no plugin loading, no tsconfig-paths — just vitest/node.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['vitest.shared.config.test.ts'],
        environment: 'node'
    }
});
