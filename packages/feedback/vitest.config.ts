import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./test/setup.tsx'],
        pool: 'forks',
        poolOptions: {
            forks: {
                maxForks: 3
            }
        },
        include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 80,
                statements: 90
            },
            exclude: [
                'node_modules/',
                'dist/',
                'test/',
                '**/*.d.ts',
                '**/*.config.*',
                // Barrel re-export files: tests in this package import
                // directly from implementation files, so the barrels show
                // 0% line coverage even though every re-exported symbol
                // is covered through its source module.
                '**/index.ts',
                // UI primitives (Button, Input, Label, Select, Textarea)
                // are thin shadcn-style forwardRef wrappers exercised
                // indirectly through FeedbackForm tests, but never rendered
                // in isolation.
                'src/ui/',
                // Public schema entrypoints are tiny re-export shims.
                'src/schemas/server.ts',
                // useAutoCollect can't be exercised via renderHook under V8
                // coverage: it pulls collector.ts -> ua-parser-js, and the
                // instrumented module graph OOMs the forks worker (~4GB). Its
                // pure logic is covered directly via collectEnvironmentData in
                // test/hooks/useAutoCollect.test.ts.
                'src/hooks/useAutoCollect.ts'
            ]
        }
    }
});
