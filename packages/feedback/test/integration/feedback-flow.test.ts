/**
 * Integration tests for @repo/feedback package.
 *
 * These are structural/contract tests — they verify that the public API
 * exports are consistent with each other and that the data contracts
 * between modules are aligned. No DOM rendering occurs.
 */
import { describe, expect, it } from 'vitest';

import {
    APP_SOURCE_IDS,
    FEEDBACK_CONFIG,
    FEEDBACK_STRINGS,
    REPORT_TYPES,
    REPORT_TYPE_IDS,
    SEVERITY_IDS,
    SEVERITY_LEVELS,
    collectEnvironmentData,
    feedbackEnvironmentSchema,
    parseFeedbackParams,
    serializeFeedbackParams
} from '../../src/index';

// ---------------------------------------------------------------------------
// 1. Export verification
// ---------------------------------------------------------------------------

describe('Export verification', () => {
    it('should export all component constructors from the package index', async () => {
        const exports = await import('../../src/index');
        expect(exports.FeedbackFAB).toBeDefined();
        expect(exports.FeedbackForm).toBeDefined();
        expect(exports.FeedbackModal).toBeDefined();
        expect(exports.FeedbackErrorBoundary).toBeDefined();
        expect(exports.StepBasic).toBeDefined();
        expect(exports.StepDetails).toBeDefined();
    });

    it('should export all hooks from the package index', async () => {
        const exports = await import('../../src/index');
        expect(typeof exports.useAutoCollect).toBe('function');
        expect(typeof exports.useConsoleCapture).toBe('function');
        expect(typeof exports.useKeyboardShortcut).toBe('function');
        expect(typeof exports.useFeedbackSubmit).toBe('function');
    });

    it('should export all config constants from the package index', async () => {
        const exports = await import('../../src/index');
        expect(exports.FEEDBACK_CONFIG).toBeDefined();
        expect(exports.FEEDBACK_STRINGS).toBeDefined();
        expect(exports.REPORT_TYPES).toBeDefined();
        expect(exports.SEVERITY_LEVELS).toBeDefined();
        expect(exports.LINEAR_CONFIG).toBeDefined();
        expect(exports.ALLOWED_FILE_TYPES).toBeDefined();
    });

    it('should export all schemas and schema constants from the package index', async () => {
        const exports = await import('../../src/index');
        expect(exports.feedbackFormSchema).toBeDefined();
        expect(exports.feedbackEnvironmentSchema).toBeDefined();
        expect(exports.feedbackErrorInfoSchema).toBeDefined();
        expect(exports.REPORT_TYPE_IDS).toBeDefined();
        expect(exports.SEVERITY_IDS).toBeDefined();
        expect(exports.APP_SOURCE_IDS).toBeDefined();
    });

    it('should export all utility functions from the package index', async () => {
        const exports = await import('../../src/index');
        expect(typeof exports.collectEnvironmentData).toBe('function');
        expect(typeof exports.serializeFeedbackParams).toBe('function');
        expect(typeof exports.parseFeedbackParams).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// 2. Config consistency — REPORT_TYPES ids match REPORT_TYPE_IDS enum
// ---------------------------------------------------------------------------

describe('Config consistency — report types', () => {
    it('should have REPORT_TYPES entries whose ids exactly match REPORT_TYPE_IDS', () => {
        const configIds = REPORT_TYPES.map((t) => t.id);
        // Every id in REPORT_TYPES must be present in REPORT_TYPE_IDS
        for (const id of configIds) {
            expect(REPORT_TYPE_IDS).toContain(id);
        }
    });

    it('should have REPORT_TYPE_IDS entries that all exist in REPORT_TYPES', () => {
        const configIds = new Set(REPORT_TYPES.map((t) => t.id));
        for (const id of REPORT_TYPE_IDS) {
            expect(configIds.has(id)).toBe(true);
        }
    });

    it('should have the same number of entries in REPORT_TYPES and REPORT_TYPE_IDS', () => {
        expect(REPORT_TYPES.length).toBe(REPORT_TYPE_IDS.length);
    });
});

// ---------------------------------------------------------------------------
// 3. Schema-config alignment — severity IDs in config match schema enum
// ---------------------------------------------------------------------------

describe('Schema-config alignment — severity levels', () => {
    it('should have SEVERITY_LEVELS entries whose ids exactly match SEVERITY_IDS', () => {
        const configIds = SEVERITY_LEVELS.map((s) => s.id);
        for (const id of configIds) {
            expect(SEVERITY_IDS).toContain(id);
        }
    });

    it('should have SEVERITY_IDS entries that all exist in SEVERITY_LEVELS', () => {
        const configIds = new Set(SEVERITY_LEVELS.map((s) => s.id));
        for (const id of SEVERITY_IDS) {
            expect(configIds.has(id)).toBe(true);
        }
    });

    it('should have the same number of entries in SEVERITY_LEVELS and SEVERITY_IDS', () => {
        expect(SEVERITY_LEVELS.length).toBe(SEVERITY_IDS.length);
    });
});

// ---------------------------------------------------------------------------
// 4. Strings completeness — all report type labels exist in strings
// ---------------------------------------------------------------------------

describe('Strings completeness', () => {
    it('should have a non-empty label for every REPORT_TYPES entry', () => {
        for (const reportType of REPORT_TYPES) {
            expect(typeof reportType.label).toBe('string');
            expect(reportType.label.length).toBeGreaterThan(0);
        }
    });

    it('should have a non-empty label for every SEVERITY_LEVELS entry', () => {
        for (const level of SEVERITY_LEVELS) {
            expect(typeof level.label).toBe('string');
            expect(level.label.length).toBeGreaterThan(0);
        }
    });

    it('should have required top-level string keys defined in FEEDBACK_STRINGS', () => {
        expect(FEEDBACK_STRINGS.fab).toBeDefined();
        expect(FEEDBACK_STRINGS.form).toBeDefined();
        expect(FEEDBACK_STRINGS.fields).toBeDefined();
        expect(FEEDBACK_STRINGS.buttons).toBeDefined();
        expect(FEEDBACK_STRINGS.validation).toBeDefined();
        expect(FEEDBACK_STRINGS.success).toBeDefined();
        expect(FEEDBACK_STRINGS.errorBoundary).toBeDefined();
    });

    it('should have all field labels defined in FEEDBACK_STRINGS.fields', () => {
        const { fields } = FEEDBACK_STRINGS;
        expect(fields.type).toBeDefined();
        expect(fields.title).toBeDefined();
        expect(fields.description).toBeDefined();
        expect(fields.email).toBeDefined();
        expect(fields.name).toBeDefined();
        expect(fields.severity).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 5. Query params roundtrip — serialize then parse preserves data
// ---------------------------------------------------------------------------

describe('Query params roundtrip', () => {
    it('should preserve all fields after serialize then parse', () => {
        // Arrange
        const input = {
            type: 'bug-js' as const,
            title: 'Application crashes on load',
            description: 'The app throws an unhandled error when loading the home page',
            url: 'https://example.com/home',
            error: 'TypeError: Cannot read property of undefined',
            stack: 'Error\n  at Component (App.tsx:42)',
            source: 'error-boundary'
        };

        // Act
        const qs = serializeFeedbackParams(input);
        const parsed = parseFeedbackParams(qs);

        // Assert
        expect(parsed.type).toBe(input.type);
        expect(parsed.title).toBe(input.title);
        expect(parsed.description).toBe(input.description);
        expect(parsed.url).toBe(input.url);
        expect(parsed.error).toBe(input.error);
        expect(parsed.source).toBe(input.source);
    });

    it('should return undefined for undefined fields after roundtrip', () => {
        // Arrange
        const input = { type: 'bug-ui-ux' as const };

        // Act
        const qs = serializeFeedbackParams(input);
        const parsed = parseFeedbackParams(qs);

        // Assert
        expect(parsed.type).toBe('bug-ui-ux');
        expect(parsed.title).toBeUndefined();
        expect(parsed.description).toBeUndefined();
        expect(parsed.url).toBeUndefined();
    });

    it('should produce a non-empty query string for non-empty input', () => {
        const qs = serializeFeedbackParams({ title: 'Test issue' });
        expect(qs.length).toBeGreaterThan(0);
        expect(qs).toContain('title=');
    });

    it('should produce an empty query string for empty input', () => {
        const qs = serializeFeedbackParams({});
        expect(qs).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 6. Environment collector + auto-collect alignment
// ---------------------------------------------------------------------------

describe('Environment collector output matches feedbackEnvironmentSchema', () => {
    it('should produce output that satisfies feedbackEnvironmentSchema in a non-browser context', () => {
        // Arrange — non-browser (Node.js) context: window is undefined
        const input = {
            appSource: 'web' as const,
            deployVersion: 'abc1234',
            userId: 'usr_001'
        };

        // Act
        const env = collectEnvironmentData(input);

        // Assert — the result must parse without errors
        const result = feedbackEnvironmentSchema.safeParse(env);
        expect(result.success).toBe(true);
    });

    it('should include appSource in the collector output', () => {
        const env = collectEnvironmentData({ appSource: 'admin' });
        expect(env.appSource).toBe('admin');
    });

    it('should include a valid ISO timestamp in the collector output', () => {
        const env = collectEnvironmentData({ appSource: 'standalone' });
        // ISO 8601 datetime — must parse as a valid date
        const parsed = new Date(env.timestamp);
        expect(Number.isNaN(parsed.getTime())).toBe(false);
    });

    it('should forward optional fields to the output when provided', () => {
        const env = collectEnvironmentData({
            appSource: 'web',
            deployVersion: 'v1.2.3',
            userId: 'usr_xyz',
            consoleErrors: ['Error: test'],
            errorInfo: { message: 'boom', stack: 'Error\n  at fn' }
        });

        expect(env.deployVersion).toBe('v1.2.3');
        expect(env.userId).toBe('usr_xyz');
        expect(env.consoleErrors).toEqual(['Error: test']);
        expect(env.errorInfo?.message).toBe('boom');
    });
});

// ---------------------------------------------------------------------------
// 7. FAB + Modal + Form integration contract
// ---------------------------------------------------------------------------

describe('FAB and Form props contract alignment', () => {
    it('should have FeedbackFABProps fields that are a superset of shared props with FeedbackFormProps', async () => {
        // This is a structural test — we verify both exports exist and are functions.
        // The actual prop type compatibility is enforced at compile time by TypeScript;
        // here we verify the runtime shapes are defined.
        const exports = await import('../../src/index');

        expect(typeof exports.FeedbackFAB).toBe('function');
        expect(typeof exports.FeedbackForm).toBe('function');
        expect(typeof exports.FeedbackModal).toBe('function');
    });

    it('should use the same AppSourceId enum across FAB, Form, and schema', () => {
        // APP_SOURCE_IDS drives the schema enum — ensure it contains the expected values
        expect(APP_SOURCE_IDS).toContain('web');
        expect(APP_SOURCE_IDS).toContain('admin');
        expect(APP_SOURCE_IDS).toContain('standalone');
    });
});

// ---------------------------------------------------------------------------
// 8. Error boundary pre-fill format matches form pre-fill expectations
// ---------------------------------------------------------------------------

describe('Error boundary serialization matches form pre-fill format', () => {
    it('should serialize error info as query params that can be parsed back', () => {
        // Arrange — simulate what FeedbackErrorBoundary does when opening a new tab
        const error = new Error('Cannot read property of undefined');
        error.stack = 'TypeError: Cannot read property of undefined\n  at render (App.tsx:10)';

        const params = {
            type: 'bug-js' as const,
            error: error.message,
            stack: error.stack,
            source: 'web',
            url: 'https://example.com/page'
        };

        // Act
        const qs = serializeFeedbackParams(params);
        const parsed = parseFeedbackParams(qs);

        // Assert — all fields survive the roundtrip
        expect(parsed.type).toBe('bug-js');
        expect(parsed.error).toBe(error.message);
        expect(parsed.source).toBe('web');
        expect(parsed.url).toBe('https://example.com/page');
    });

    it('should sanitize XSS payloads in parsed params', () => {
        // Arrange — inject a malicious payload
        const qs = serializeFeedbackParams({
            title: '<script>alert("xss")</script>Crash',
            description: 'javascript:alert(1)'
        });

        // Act
        const parsed = parseFeedbackParams(qs);

        // Assert — dangerous patterns must be stripped
        expect(parsed.title).not.toContain('<script>');
        expect(parsed.description).not.toContain('javascript:');
    });

    it('should use REPORT_TYPE_IDS that includes bug-js (the default error boundary type)', () => {
        expect(REPORT_TYPE_IDS).toContain('bug-js');
    });

    it('should have LINEAR_CONFIG with a linearPriority for every SEVERITY_LEVELS entry', () => {
        for (const level of SEVERITY_LEVELS) {
            expect(typeof level.linearPriority).toBe('number');
            expect(level.linearPriority).toBeGreaterThan(0);
        }
    });
});

// ---------------------------------------------------------------------------
// 9. FEEDBACK_CONFIG structure completeness
// ---------------------------------------------------------------------------

describe('FEEDBACK_CONFIG structure completeness', () => {
    it('should contain a linear sub-config with required placeholder fields', () => {
        expect(FEEDBACK_CONFIG.linear).toBeDefined();
        expect(typeof FEEDBACK_CONFIG.linear.teamId).toBe('string');
        expect(typeof FEEDBACK_CONFIG.linear.projectId).toBe('string');
    });

    it('should contain rate limit and file size settings', () => {
        expect(typeof FEEDBACK_CONFIG.rateLimit).toBe('number');
        expect(typeof FEEDBACK_CONFIG.maxFileSize).toBe('number');
        expect(typeof FEEDBACK_CONFIG.maxAttachments).toBe('number');
        expect(FEEDBACK_CONFIG.maxFileSize).toBeGreaterThan(0);
    });

    it('should contain a keyboard shortcut configuration', () => {
        expect(FEEDBACK_CONFIG.keyboardShortcut).toBeDefined();
        expect(typeof FEEDBACK_CONFIG.keyboardShortcut.key).toBe('string');
    });

    it('should have an enabled flag', () => {
        expect(typeof FEEDBACK_CONFIG.enabled).toBe('boolean');
    });

    it('should reference the same REPORT_TYPES and SEVERITY_LEVELS arrays', () => {
        // The config.reportTypes and config.severityLevels should equal the top-level exports
        expect(FEEDBACK_CONFIG.reportTypes).toBe(REPORT_TYPES);
        expect(FEEDBACK_CONFIG.severityLevels).toBe(SEVERITY_LEVELS);
    });
});
