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
// 2. Root layout — headless feedback host (SPEC-301 T-010: no visible FAB)
// ---------------------------------------------------------------------------

describe('Admin app — root layout uses the headless feedback host', () => {
    it('should NOT render the visible FeedbackFAB (removed in SPEC-301 T-010)', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — the always-visible floating button was removed for prod safety
        expect(content).not.toContain('<FeedbackFAB');
    });

    it('should mount the AdminFeedbackHeadlessHost instead', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — headless host keeps the Ctrl+Shift+F shortcut + feedback:open modal
        expect(content).toContain('AdminFeedbackHeadlessHost');
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

    it('should import FeedbackErrorBoundary from @repo/feedback without the removed FeedbackFAB', () => {
        // Arrange
        const content = readFileSync(adminPath('src/routes/__root.tsx'), 'utf8');

        // Assert — boundary still comes from the package; the FAB import is gone (T-010)
        const importLine = content
            .split('\n')
            .find((line) => line.includes('@repo/feedback') && line.includes('import'));

        expect(importLine).toBeDefined();
        expect(importLine).toContain('FeedbackErrorBoundary');
        expect(importLine).not.toContain('FeedbackFAB');
    });
});
