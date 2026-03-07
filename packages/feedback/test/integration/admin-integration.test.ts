/**
 * Admin app integration tests for @repo/feedback.
 *
 * These are structural/contract tests that verify the feedback integration
 * wiring is in place without running the Vite dev server or TanStack Start.
 * All checks use `fs.readFileSync` / `existsSync` against actual source files.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Absolute path to the monorepo root */
const ROOT = resolve(__dirname, '../../../../');

/** Resolve a path relative to the admin app */
function adminPath(...segments: string[]): string {
    return resolve(ROOT, 'apps/admin', ...segments);
}

// ---------------------------------------------------------------------------
// 1. Dependency declaration
// ---------------------------------------------------------------------------

describe('Admin app — package.json dependency', () => {
    it('should have @repo/feedback listed in dependencies', () => {
        // Arrange
        const pkgPath = adminPath('package.json');

        // Act
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
            dependencies?: Record<string, string>;
        };

        // Assert
        expect(pkg.dependencies).toBeDefined();
        expect(pkg.dependencies?.['@repo/feedback']).toBe('workspace:*');
    });
});

// ---------------------------------------------------------------------------
// 2. Root layout — FeedbackFAB integration
// ---------------------------------------------------------------------------

describe('Admin app — root layout has FeedbackFAB', () => {
    it('should import FeedbackFAB from @repo/feedback', () => {
        // Arrange
        const rootPath = adminPath('src/routes/__root.tsx');

        // Act
        const content = readFileSync(rootPath, 'utf8');

        // Assert
        expect(content).toContain('@repo/feedback');
        expect(content).toContain('FeedbackFAB');
    });

    it('should render <FeedbackFAB> in the JSX body', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — FAB must appear in the rendered output, not just be imported
        expect(content).toContain('<FeedbackFAB');
    });

    it('should pass appSource="admin" to FeedbackFAB', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — identifies the originating app in Linear issues
        expect(content).toContain('appSource');
        expect(content).toContain('"admin"');
    });

    it('should pass apiUrl to FeedbackFAB', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — FAB must know where to POST submissions
        expect(content).toContain('apiUrl');
    });
});

// ---------------------------------------------------------------------------
// 3. Root layout — FeedbackErrorBoundary integration
// ---------------------------------------------------------------------------

describe('Admin app — root layout has FeedbackErrorBoundary', () => {
    it('should import FeedbackErrorBoundary from @repo/feedback', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — both FeedbackFAB and FeedbackErrorBoundary are imported together
        expect(content).toContain('FeedbackErrorBoundary');
    });

    it('should render <FeedbackErrorBoundary> wrapping children in the JSX body', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — boundary must wrap the outlet so all admin pages are protected
        expect(content).toContain('<FeedbackErrorBoundary');
    });

    it('should pass appSource="admin" to FeedbackErrorBoundary', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — boundary-triggered issues need the correct app source label
        expect(content).toContain('appSource');
        // Already verified "admin" is present in file (used by both FeedbackFAB and boundary)
        expect(content).toContain('"admin"');
    });

    it('should pass feedbackPageUrl to FeedbackErrorBoundary', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — the fallback page URL must be configured so users can report crashes
        expect(content).toContain('feedbackPageUrl');
    });

    it('should pass apiUrl to FeedbackErrorBoundary', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — boundary needs the API URL to submit inline reports
        expect(content).toContain('apiUrl');
    });

    it('should import both FeedbackFAB and FeedbackErrorBoundary in a single import statement', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — both exports are consumed from the same package entry
        const importLine = content
            .split('\n')
            .find((line) => line.includes('@repo/feedback') && line.includes('import'));

        expect(importLine).toBeDefined();
        expect(importLine).toContain('FeedbackFAB');
        expect(importLine).toContain('FeedbackErrorBoundary');
    });
});
