/**
 * Web app integration tests for @repo/feedback.
 *
 * These are structural/contract tests that verify the feedback integration
 * wiring is in place without running Astro or the browser. All checks are
 * done via `fs.readFileSync` / `existsSync` against the actual source files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Absolute path to the monorepo root */
const ROOT = resolve(__dirname, '../../../../');

/** Resolve a path relative to the web app */
function webPath(...segments: string[]): string {
    return resolve(ROOT, 'apps/web', ...segments);
}

// ---------------------------------------------------------------------------
// 1. Dependency declaration
// ---------------------------------------------------------------------------

describe('Web app — package.json dependency', () => {
    it('should have @repo/feedback listed in dependencies', () => {
        // Arrange
        const pkgPath = webPath('package.json');

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
// 2. BaseLayout — FeedbackFAB integration
// ---------------------------------------------------------------------------

describe('Web app — BaseLayout has FeedbackFAB', () => {
    it('should import FeedbackFAB from @repo/feedback', () => {
        // Arrange
        const layoutPath = webPath('src/layouts/BaseLayout.astro');

        // Act
        const content = readFileSync(layoutPath, 'utf8');

        // Assert
        expect(content).toContain('@repo/feedback');
        expect(content).toContain('FeedbackFAB');
    });

    it('should mount FeedbackFAB with client:idle directive', () => {
        // Arrange
        const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');

        // Assert — FAB is deferred so it does not block the main thread
        expect(content).toContain('client:idle');
    });

    it('should pass appSource="web" to FeedbackFAB', () => {
        // Arrange
        const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');

        // Assert — identifies the originating app in Linear issues
        expect(content).toContain('appSource');
        expect(content).toContain('"web"');
    });

    it('should pass apiUrl to FeedbackFAB', () => {
        // Arrange
        const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');

        // Assert — FAB must know where to POST submissions
        expect(content).toContain('apiUrl');
    });
});

// ---------------------------------------------------------------------------
// 3. Standalone feedback page
// ---------------------------------------------------------------------------

describe('Web app — standalone feedback page', () => {
    it('should exist at src/pages/[lang]/feedback.astro', () => {
        // Assert — crash-resistant fallback page used by the error boundary
        expect(existsSync(webPath('src/pages/[lang]/feedback.astro'))).toBe(true);
    });

    it('should import FeedbackForm from @repo/feedback', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback.astro'), 'utf8');

        // Assert
        expect(content).toContain('@repo/feedback');
        expect(content).toContain('FeedbackForm');
    });

    it('should mount FeedbackForm with client:load directive', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback.astro'), 'utf8');

        // Assert — form must be interactive immediately on this dedicated page
        expect(content).toContain('client:load');
    });

    it('should pass appSource="standalone" to FeedbackForm', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback.astro'), 'utf8');

        // Assert — standalone source distinguishes fallback-page submissions in Linear
        expect(content).toContain('appSource');
        expect(content).toContain('"standalone"');
    });

    it('should include a noindex robots meta tag', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback.astro'), 'utf8');

        // Assert — utility page must not be indexed by search engines
        expect(content).toContain('noindex');
    });
});

// ---------------------------------------------------------------------------
// 4. FeedbackIslandWrapper component
// ---------------------------------------------------------------------------

describe('Web app — FeedbackIslandWrapper component', () => {
    it('should exist at src/components/feedback/FeedbackIslandWrapper.tsx', () => {
        // Assert — wrapper must be available for protecting interactive islands
        expect(existsSync(webPath('src/components/feedback/FeedbackIslandWrapper.tsx'))).toBe(true);
    });

    it('should import FeedbackErrorBoundary from @repo/feedback', () => {
        // Arrange
        const content = readFileSync(
            webPath('src/components/feedback/FeedbackIslandWrapper.tsx'),
            'utf8'
        );

        // Assert — wrapper must delegate to the package error boundary
        expect(content).toContain('@repo/feedback');
        expect(content).toContain('FeedbackErrorBoundary');
    });

    it('should use a named export (no default export)', () => {
        // Arrange
        const content = readFileSync(
            webPath('src/components/feedback/FeedbackIslandWrapper.tsx'),
            'utf8'
        );

        // Assert — project convention: named exports only
        expect(content).toContain('export function FeedbackIslandWrapper');
        expect(content).not.toContain('export default');
    });

    it('should pass appSource="web" to FeedbackErrorBoundary', () => {
        // Arrange
        const content = readFileSync(
            webPath('src/components/feedback/FeedbackIslandWrapper.tsx'),
            'utf8'
        );

        // Assert — source must be set so boundary-triggered issues are tagged correctly
        expect(content).toContain('appSource');
        expect(content).toContain('"web"');
    });

    it('should point feedbackPageUrl to the standalone feedback page', () => {
        // Arrange
        const content = readFileSync(
            webPath('src/components/feedback/FeedbackIslandWrapper.tsx'),
            'utf8'
        );

        // Assert — users who experience a boundary crash need a working link to report
        expect(content).toContain('feedbackPageUrl');
        expect(content).toContain('/feedback');
    });
});
