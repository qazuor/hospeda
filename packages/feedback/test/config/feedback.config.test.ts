import { describe, expect, it } from 'vitest';
import {
    ALLOWED_FILE_TYPES,
    FEEDBACK_CONFIG,
    LINEAR_CONFIG,
    REPORT_TYPES,
    SEVERITY_LEVELS
} from '../../src/config/feedback.config.js';

describe('REPORT_TYPES', () => {
    it('should have exactly 6 entries', () => {
        // Arrange / Act
        const count = REPORT_TYPES.length;

        // Assert
        expect(count).toBe(6);
    });

    it('should contain all expected ids', () => {
        // Arrange
        const expectedIds = [
            'bug-js',
            'bug-ui-ux',
            'bug-content',
            'feature-request',
            'improvement',
            'other'
        ];

        // Act
        const actualIds = REPORT_TYPES.map((t) => t.id);

        // Assert
        expect(actualIds).toEqual(expectedIds);
    });

    it('should have non-empty label on every entry', () => {
        for (const type of REPORT_TYPES) {
            expect(type.label.length).toBeGreaterThan(0);
        }
    });

    it('should have a linearLabelId placeholder on every entry', () => {
        for (const type of REPORT_TYPES) {
            expect(type.linearLabelId).toMatch(/^PLACEHOLDER_/);
        }
    });
});

describe('SEVERITY_LEVELS', () => {
    it('should have exactly 4 entries', () => {
        expect(SEVERITY_LEVELS.length).toBe(4);
    });

    it('should map to linearPriority values 1 through 4', () => {
        // Arrange
        const priorities = SEVERITY_LEVELS.map((s) => s.linearPriority).sort();

        // Assert
        expect(priorities).toEqual([1, 2, 3, 4]);
    });

    it('should assign linearPriority 1 to critical', () => {
        // Arrange / Act
        const critical = SEVERITY_LEVELS.find((s) => s.id === 'critical');

        // Assert
        expect(critical?.linearPriority).toBe(1);
    });

    it('should assign linearPriority 2 to high', () => {
        const high = SEVERITY_LEVELS.find((s) => s.id === 'high');
        expect(high?.linearPriority).toBe(2);
    });

    it('should assign linearPriority 3 to medium', () => {
        const medium = SEVERITY_LEVELS.find((s) => s.id === 'medium');
        expect(medium?.linearPriority).toBe(3);
    });

    it('should assign linearPriority 4 to low', () => {
        const low = SEVERITY_LEVELS.find((s) => s.id === 'low');
        expect(low?.linearPriority).toBe(4);
    });

    it('should have a non-empty description on every entry', () => {
        for (const level of SEVERITY_LEVELS) {
            expect(level.description.length).toBeGreaterThan(0);
        }
    });
});

describe('LINEAR_CONFIG', () => {
    it('should have teamId, projectId, and defaultStateId', () => {
        expect(LINEAR_CONFIG).toHaveProperty('teamId');
        expect(LINEAR_CONFIG).toHaveProperty('projectId');
        expect(LINEAR_CONFIG).toHaveProperty('defaultStateId');
    });

    it('should have source labels for web, admin, and standalone', () => {
        expect(LINEAR_CONFIG.labels.source).toHaveProperty('web');
        expect(LINEAR_CONFIG.labels.source).toHaveProperty('admin');
        expect(LINEAR_CONFIG.labels.source).toHaveProperty('standalone');
    });

    it('should have an environment beta label', () => {
        expect(LINEAR_CONFIG.labels.environment).toHaveProperty('beta');
    });
});

describe('ALLOWED_FILE_TYPES', () => {
    it('should include image/png, image/jpeg, image/webp, and image/gif', () => {
        expect(ALLOWED_FILE_TYPES).toContain('image/png');
        expect(ALLOWED_FILE_TYPES).toContain('image/jpeg');
        expect(ALLOWED_FILE_TYPES).toContain('image/webp');
        expect(ALLOWED_FILE_TYPES).toContain('image/gif');
    });
});

describe('FEEDBACK_CONFIG', () => {
    it('should contain all expected top-level keys', () => {
        const expectedKeys = [
            'linear',
            'reportTypes',
            'severityLevels',
            'fallbackEmail',
            'rateLimit',
            'linearMaxRetries',
            'maxFileSize',
            'maxAttachments',
            'allowedFileTypes',
            'keyboardShortcut',
            'enabled'
        ];

        for (const key of expectedKeys) {
            expect(FEEDBACK_CONFIG).toHaveProperty(key);
        }
    });

    it('should set rateLimit to 30', () => {
        expect(FEEDBACK_CONFIG.rateLimit).toBe(30);
    });

    it('should set maxFileSize to 10485760 (10MB)', () => {
        expect(FEEDBACK_CONFIG.maxFileSize).toBe(10_485_760);
    });

    it('should set maxAttachments to 5', () => {
        expect(FEEDBACK_CONFIG.maxAttachments).toBe(5);
    });

    it('should set linearMaxRetries to 3', () => {
        expect(FEEDBACK_CONFIG.linearMaxRetries).toBe(3);
    });

    it('should set fallbackEmail to feedback@hospeda.com', () => {
        expect(FEEDBACK_CONFIG.fallbackEmail).toBe('feedback@hospeda.com');
    });

    it('should set enabled to true', () => {
        expect(FEEDBACK_CONFIG.enabled).toBe(true);
    });

    it('should define keyboard shortcut with key f, ctrl true, shift true', () => {
        expect(FEEDBACK_CONFIG.keyboardShortcut).toEqual({ key: 'f', ctrl: true, shift: true });
    });

    it('should reference the same REPORT_TYPES array', () => {
        expect(FEEDBACK_CONFIG.reportTypes).toBe(REPORT_TYPES);
    });

    it('should reference the same SEVERITY_LEVELS array', () => {
        expect(FEEDBACK_CONFIG.severityLevels).toBe(SEVERITY_LEVELS);
    });

    it('should reference the same LINEAR_CONFIG object', () => {
        expect(FEEDBACK_CONFIG.linear).toBe(LINEAR_CONFIG);
    });
});
