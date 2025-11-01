/**
 * Tests for /planning:generate-todos command
 *
 * @module test/commands/generate-command
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module to test
import {
    type GenerateCommandOptions,
    executeGenerateCommand
} from '../../src/commands/generate-command.js';

// Mock dependencies
vi.mock('../../src/enrichment/session-context.js', () => ({
    detectSessionFromPath: vi.fn(),
    loadSessionContext: vi.fn()
}));

vi.mock('../../src/parsers/todos-parser.js', () => ({
    updateTodosWithLinks: vi.fn()
}));

describe('generate-command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('executeGenerateCommand', () => {
        it('should generate TODOs from session', async () => {
            // Arrange
            const options: GenerateCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature'
            };

            const { loadSessionContext } = await import('../../src/enrichment/session-context.js');
            vi.mocked(loadSessionContext).mockResolvedValue({
                success: true,
                context: {
                    sessionId: 'P-001',
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                    metadata: {
                        planningCode: 'P-001',
                        title: 'Test Feature',
                        description: 'Test',
                        complexity: 'Medium',
                        impact: 'High',
                        owner: 'test'
                    },
                    tasks: [
                        {
                            id: 'task-1',
                            code: 'T-001-001',
                            title: 'Task 1',
                            description: 'Description 1',
                            level: 0,
                            estimate: 2,
                            status: 'pending'
                        }
                    ]
                }
            });

            const { updateTodosWithLinks } = await import('../../src/parsers/todos-parser.js');
            vi.mocked(updateTodosWithLinks).mockResolvedValue();

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Generated');
            expect(result.details).toMatchObject({
                sessionId: 'P-001',
                totalTasks: 1
            });
        });

        it('should auto-detect session from current path', async () => {
            // Arrange
            const options: GenerateCommandOptions = {
                currentPath: '/project/.claude/sessions/planning/P-001-feature/PDR.md'
            };

            const { detectSessionFromPath, loadSessionContext } = await import(
                '../../src/enrichment/session-context.js'
            );
            vi.mocked(detectSessionFromPath).mockReturnValue({
                detected: true,
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                sessionId: 'P-001'
            });

            vi.mocked(loadSessionContext).mockResolvedValue({
                success: true,
                context: {
                    sessionId: 'P-001',
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                    metadata: {
                        planningCode: 'P-001',
                        title: 'Test',
                        description: 'Test',
                        complexity: 'Low',
                        impact: 'Low',
                        owner: 'test'
                    },
                    tasks: []
                }
            });

            const { updateTodosWithLinks } = await import('../../src/parsers/todos-parser.js');
            vi.mocked(updateTodosWithLinks).mockResolvedValue();

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(detectSessionFromPath).toHaveBeenCalledWith({
                filePath: options.currentPath
            });
        });

        it('should fail if no session path provided', async () => {
            // Arrange
            const options: GenerateCommandOptions = {};

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('No session path');
        });

        it('should fail if session detection fails from current path', async () => {
            // Arrange
            const options: GenerateCommandOptions = {
                currentPath: '/project/src/index.ts' // Not in planning session
            };

            const { detectSessionFromPath } = await import(
                '../../src/enrichment/session-context.js'
            );
            vi.mocked(detectSessionFromPath).mockReturnValue({
                detected: false
            });

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Could not detect session');
        });

        it('should fail if session loading fails', async () => {
            // Arrange
            const options: GenerateCommandOptions = {
                sessionPath: '/invalid/path'
            };

            const { loadSessionContext } = await import('../../src/enrichment/session-context.js');
            vi.mocked(loadSessionContext).mockResolvedValue({
                success: false,
                error: 'Session not found'
            });

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Session not found');
        });

        it('should write TODOs to custom output directory', async () => {
            // Arrange
            const options: GenerateCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                outputDir: '.linear-todos'
            };

            const { loadSessionContext } = await import('../../src/enrichment/session-context.js');
            vi.mocked(loadSessionContext).mockResolvedValue({
                success: true,
                context: {
                    sessionId: 'P-001',
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                    metadata: {
                        planningCode: 'P-001',
                        title: 'Test',
                        description: 'Test',
                        complexity: 'Low',
                        impact: 'Low',
                        owner: 'test'
                    },
                    tasks: []
                }
            });

            const { updateTodosWithLinks } = await import('../../src/parsers/todos-parser.js');
            vi.mocked(updateTodosWithLinks).mockResolvedValue();

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details).toMatchObject({
                outputDir: '.linear-todos'
            });
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            const options: GenerateCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature'
            };

            const { loadSessionContext } = await import('../../src/enrichment/session-context.js');
            vi.mocked(loadSessionContext).mockRejectedValue(new Error('Parse error'));

            // Act
            const result = await executeGenerateCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Parse error');
        });
    });
});
