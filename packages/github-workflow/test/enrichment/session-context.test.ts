/**
 * Tests for session context manager
 *
 * @module test/enrichment/session-context
 */

import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Module to test
import {
    detectSessionFromPath,
    loadSessionContext,
    validateSessionStructure
} from '../../src/enrichment/session-context.js';

// Mock file system
vi.mock('node:fs', () => ({
    existsSync: vi.fn()
}));

vi.mock('../../src/parsers/planning-session.js', () => ({
    parsePlanningSession: vi.fn()
}));

describe('session-context', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('detectSessionFromPath', () => {
        it('should detect session from path inside planning directory', () => {
            // Arrange
            const filePath = '/home/user/project/.claude/sessions/planning/P-001-feature/PDR.md';

            // Act
            const result = detectSessionFromPath({ filePath });

            // Assert
            expect(result.detected).toBe(true);
            expect(result.sessionPath).toBe(
                '/home/user/project/.claude/sessions/planning/P-001-feature'
            );
            expect(result.sessionId).toBe('P-001');
        });

        it('should detect session from nested file path', () => {
            // Arrange
            const filePath = '/project/.claude/sessions/planning/P-042-auth/docs/spec.md';

            // Act
            const result = detectSessionFromPath({ filePath });

            // Assert
            expect(result.detected).toBe(true);
            expect(result.sessionPath).toContain('P-042-auth');
            expect(result.sessionId).toBe('P-042');
        });

        it('should return not detected for non-planning path', () => {
            // Arrange
            const filePath = '/home/user/project/src/index.ts';

            // Act
            const result = detectSessionFromPath({ filePath });

            // Assert
            expect(result.detected).toBe(false);
            expect(result.sessionPath).toBeUndefined();
            expect(result.sessionId).toBeUndefined();
        });

        it('should handle paths without session code', () => {
            // Arrange
            const filePath = '/project/.claude/sessions/planning/random-folder/file.md';

            // Act
            const result = detectSessionFromPath({ filePath });

            // Assert
            expect(result.detected).toBe(false);
        });

        it('should extract session ID from directory name', () => {
            // Arrange
            const filePath = '/project/.claude/sessions/planning/P-999-big-feature/TODOs.md';

            // Act
            const result = detectSessionFromPath({ filePath });

            // Assert
            expect(result.sessionId).toBe('P-999');
        });
    });

    describe('validateSessionStructure', () => {
        it('should validate session with all required files', () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockReturnValue(true);

            // Act
            const result = validateSessionStructure({ sessionPath });

            // Assert
            expect(result.valid).toBe(true);
            expect(result.missingFiles).toHaveLength(0);
            expect(existsSync).toHaveBeenCalledWith(expect.stringContaining('PDR.md'));
            expect(existsSync).toHaveBeenCalledWith(expect.stringContaining('TODOs.md'));
        });

        it('should detect missing PDR.md', () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockImplementation((path) => {
                return !String(path).includes('PDR.md');
            });

            // Act
            const result = validateSessionStructure({ sessionPath });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.missingFiles).toContain('PDR.md');
        });

        it('should detect missing TODOs.md', () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockImplementation((path) => {
                return !String(path).includes('TODOs.md');
            });

            // Act
            const result = validateSessionStructure({ sessionPath });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.missingFiles).toContain('TODOs.md');
        });

        it('should detect missing tech-analysis.md', () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockImplementation((path) => {
                const pathStr = String(path);
                return !pathStr.includes('tech-analysis.md');
            });

            // Act
            const result = validateSessionStructure({ sessionPath });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.missingFiles).toContain('tech-analysis.md');
        });

        it('should detect all missing files', () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockReturnValue(false);

            // Act
            const result = validateSessionStructure({ sessionPath });

            // Assert
            expect(result.valid).toBe(false);
            expect(result.missingFiles).toContain('PDR.md');
            expect(result.missingFiles).toContain('tech-analysis.md');
            expect(result.missingFiles).toContain('TODOs.md');
        });
    });

    describe('loadSessionContext', () => {
        it('should load session context successfully', async () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            const mockSession = {
                metadata: {
                    planningCode: 'P-001',
                    title: 'Test Feature',
                    description: 'Test description',
                    complexity: 'Medium' as const,
                    impact: 'High' as const,
                    owner: 'test-user'
                },
                tasks: [],
                sessionPath
            };

            vi.mocked(existsSync).mockReturnValue(true);

            // Import and mock after existsSync is set
            const planningModule = await import('../../src/parsers/planning-session.js');
            vi.spyOn(planningModule, 'parsePlanningSession').mockResolvedValue(mockSession);

            // Clear cache before test
            const { clearSessionCache } = await import('../../src/enrichment/session-context.js');
            clearSessionCache();

            // Act
            const result = await loadSessionContext({ sessionPath });

            // Assert
            expect(result.success).toBe(true);
            expect(result.context).toBeDefined();
            expect(result.context?.sessionId).toBe('P-001');
            expect(result.context?.sessionPath).toBe(sessionPath);
            expect(result.context?.metadata.title).toBe('Test Feature');
        });

        it('should fail if session structure is invalid', async () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockReturnValue(false);

            // Clear cache before test
            const { clearSessionCache } = await import('../../src/enrichment/session-context.js');
            clearSessionCache();

            // Act
            const result = await loadSessionContext({ sessionPath });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid session structure');
        });

        it('should fail if session parsing fails', async () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-001-feature';
            vi.mocked(existsSync).mockReturnValue(true);

            // Import and mock to throw error
            const planningModule = await import('../../src/parsers/planning-session.js');
            vi.spyOn(planningModule, 'parsePlanningSession').mockRejectedValue(
                new Error('Parse error')
            );

            // Clear cache before test
            const { clearSessionCache } = await import('../../src/enrichment/session-context.js');
            clearSessionCache();

            // Act
            const result = await loadSessionContext({ sessionPath });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to parse session');
        });

        it('should cache loaded session context', async () => {
            // Arrange
            const sessionPath = '/project/.claude/sessions/planning/P-002-cache-test';
            const mockSession = {
                metadata: {
                    planningCode: 'P-002',
                    title: 'Test Feature',
                    description: 'Test',
                    complexity: 'Medium' as const,
                    impact: 'High' as const,
                    owner: 'test'
                },
                tasks: [],
                sessionPath
            };

            vi.mocked(existsSync).mockReturnValue(true);

            // Import and create spy
            const planningModule = await import('../../src/parsers/planning-session.js');
            const parseSpy = vi
                .spyOn(planningModule, 'parsePlanningSession')
                .mockResolvedValue(mockSession);

            // Clear cache before test
            const { clearSessionCache } = await import('../../src/enrichment/session-context.js');
            clearSessionCache();

            // Act
            const result1 = await loadSessionContext({ sessionPath });
            const result2 = await loadSessionContext({ sessionPath });

            // Assert
            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(parseSpy).toHaveBeenCalledTimes(1); // Cached
        });
    });
});
