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

// NOTE: BaseLayout-mounted FeedbackFAB was removed during the SPEC-096 web app
// re-architecture. The feedback FAB is now opened via custom event from
// ErrorBanner/Sentry boundaries on demand. Re-enable these tests when the FAB
// is re-mounted globally (or replace them with a check at the new mount point).
// CI guard requires `describe.skipIf(...)`. Set FEEDBACK_FAB_REMOUNTED=true
// when the FAB is restored to the global BaseLayout mount point to re-enable.
describe.skipIf(process.env.FEEDBACK_FAB_REMOUNTED !== 'true')(
    'Web app — BaseLayout has FeedbackFAB (deferred)',
    () => {
        it('should import FeedbackFAB from @repo/feedback', () => {
            const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');
            expect(content).toContain('FeedbackFAB');
        });

        it('should mount FeedbackFAB with client:only directive', () => {
            const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');
            expect(content).toContain('client:only');
        });

        it('should pass appSource="web" to FeedbackFAB', () => {
            const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');
            expect(content).toContain('appSource');
        });

        it('should pass apiUrl to FeedbackFAB', () => {
            const content = readFileSync(webPath('src/layouts/BaseLayout.astro'), 'utf8');
            expect(content).toContain('apiUrl');
        });
    }
);

// ---------------------------------------------------------------------------
// 3. Standalone feedback page
// ---------------------------------------------------------------------------

describe('Web app — standalone feedback page', () => {
    it('should exist at src/pages/[lang]/feedback/index.astro', () => {
        // Assert — crash-resistant fallback page used by the error boundary
        expect(existsSync(webPath('src/pages/[lang]/feedback/index.astro'))).toBe(true);
    });

    it('should import FeedbackForm from @repo/feedback', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback/index.astro'), 'utf8');

        // Assert
        expect(content).toContain('@repo/feedback');
        expect(content).toContain('FeedbackForm');
    });

    it('should mount FeedbackForm with a client directive (client:load or client:only)', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback/index.astro'), 'utf8');

        // Assert — form must be hydrated on the client; either directive works
        // (client:load: hydrate immediately; client:only: skip SSR entirely).
        expect(content).toMatch(/client:(load|only)/);
    });

    it('should pass an appSource prop to FeedbackForm', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback/index.astro'), 'utf8');

        // Assert — the form must always identify the originating app for
        // downstream routing (Linear, analytics). Specific value may evolve.
        expect(content).toContain('appSource');
    });

    it('should include a noindex robots meta tag', () => {
        // Arrange
        const content = readFileSync(webPath('src/pages/[lang]/feedback/index.astro'), 'utf8');

        // Assert — utility page must not be indexed by search engines
        expect(content).toContain('noindex');
    });
});

// ---------------------------------------------------------------------------
// 4. FeedbackIslandWrapper component
// ---------------------------------------------------------------------------

// NOTE: FeedbackIslandWrapper component is not currently used in apps/web.
// Re-enable these tests if it's re-introduced for protecting interactive
// islands with FeedbackErrorBoundary.
// CI guard requires `describe.skipIf(...)`. Set FEEDBACK_ISLAND_WRAPPER_ENABLED=true
// when the wrapper is reintroduced for protecting interactive islands.
describe.skipIf(process.env.FEEDBACK_ISLAND_WRAPPER_ENABLED !== 'true')(
    'Web app — FeedbackIslandWrapper component (deferred)',
    () => {
        it('should exist at src/components/feedback/FeedbackIslandWrapper.tsx', () => {
            // Assert — wrapper must be available for protecting interactive islands
            expect(existsSync(webPath('src/components/feedback/FeedbackIslandWrapper.tsx'))).toBe(
                true
            );
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
    }
);
