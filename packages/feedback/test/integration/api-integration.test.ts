/**
 * API app integration tests for @repo/feedback.
 *
 * These are structural/contract tests that verify the feedback integration
 * wiring is in place without starting the Hono server or connecting to a DB.
 * All checks use `fs.readFileSync` / `existsSync` against actual source files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Absolute path to the monorepo root */
const ROOT = resolve(__dirname, '../../../../');

/** Resolve a path relative to the API app */
function apiPath(...segments: string[]): string {
    return resolve(ROOT, 'apps/api', ...segments);
}

// ---------------------------------------------------------------------------
// 1. Dependency declaration
// ---------------------------------------------------------------------------

describe('API app — package.json dependency', () => {
    it('should have @repo/feedback listed in dependencies', () => {
        // Arrange
        const pkgPath = apiPath('package.json');

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
// 2. Feedback route
// ---------------------------------------------------------------------------

describe('API app — feedback route', () => {
    it('should have a feedback route index at src/routes/feedback/index.ts', () => {
        // Assert — feedback submissions must be handled by a dedicated route group
        expect(existsSync(apiPath('src/routes/feedback/index.ts'))).toBe(true);
    });

    it('should have a feedback submit route at src/routes/feedback/submit.ts', () => {
        // Assert — the POST handler for feedback submission must exist
        expect(existsSync(apiPath('src/routes/feedback/submit.ts'))).toBe(true);
    });

    it('should export feedbackRoutes from the route index', () => {
        // Arrange
        const content = readFileSync(apiPath('src/routes/feedback/index.ts'), 'utf8');

        // Assert — named export following project convention (no default exports)
        expect(content).toContain('export');
        expect(content).toContain('feedbackRoutes');
    });

    it('should import the submit route inside the feedback route index', () => {
        // Arrange
        const content = readFileSync(apiPath('src/routes/feedback/index.ts'), 'utf8');

        // Assert — route index must wire up the actual submit handler
        expect(content).toContain('submitFeedbackRoute');
    });
});

// ---------------------------------------------------------------------------
// 3. Linear service
// ---------------------------------------------------------------------------

describe('API app — Linear feedback service', () => {
    it('should have the Linear service at src/services/feedback/linear.service.ts', () => {
        // Assert — business logic for creating Linear issues must exist
        expect(existsSync(apiPath('src/services/feedback/linear.service.ts'))).toBe(true);
    });

    it('should export LinearFeedbackService as a named class', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — named export, no default export (project convention)
        expect(content).toContain('export class LinearFeedbackService');
        expect(content).not.toContain('export default');
    });

    it('should import LinearClient from @linear/sdk', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — service must use the official Linear SDK, not raw HTTP
        expect(content).toContain('@linear/sdk');
        expect(content).toContain('LinearClient');
    });

    it('should import types or config from @repo/feedback', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — service must consume shared config so IDs stay in sync with the UI
        expect(content).toContain('@repo/feedback');
    });

    it('should expose a createIssue method', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — primary public API method for creating a Linear issue from a report
        expect(content).toContain('createIssue');
    });

    it('should expose an uploadFile method', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — attachments need to be uploaded before they can be embedded in issues
        expect(content).toContain('uploadFile');
    });

    it('should export LinearIssueResult interface', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — result type must be exported so the route handler can use it
        expect(content).toContain('LinearIssueResult');
    });

    it('should export CreateFeedbackIssueInput interface', () => {
        // Arrange
        const content = readFileSync(apiPath('src/services/feedback/linear.service.ts'), 'utf8');

        // Assert — input type must be exported so callers are fully typed
        expect(content).toContain('CreateFeedbackIssueInput');
    });
});

// ---------------------------------------------------------------------------
// 4. Retry utility (resilience)
// ---------------------------------------------------------------------------

describe('API app — feedback retry utility', () => {
    it('should have a retry utility at src/services/feedback/retry.ts', () => {
        // Assert — transient Linear API failures must be retried automatically
        expect(existsSync(apiPath('src/services/feedback/retry.ts'))).toBe(true);
    });
});
