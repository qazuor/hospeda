/**
 * Tests for label manager
 *
 * @module test/sync/label-manager
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../../src/core/github-client';
import type { Task } from '../../src/parsers/types';
import {
	DEFAULT_COLOR_SCHEME,
	LabelManager,
	generateLabelsForTask,
	type ColorScheme,
	type GenerateLabelsInput,
	type LabelDefinition
} from '../../src/sync/label-manager';

// Mock GitHubClient
const createMockGitHubClient = (): GitHubClient => {
	return {
		ensureLabelExists: vi.fn().mockResolvedValue(undefined)
	} as unknown as GitHubClient;
};

// Helper to create a basic Task
const createTask = (overrides?: Partial<Task>): Task => ({
	id: 'task-001',
	code: 'T-003-001',
	title: 'Test task',
	status: 'pending',
	level: 0,
	lineNumber: 10,
	...overrides
});

describe('label-manager', () => {
	describe('DEFAULT_COLOR_SCHEME', () => {
		it('should have all required color categories', () => {
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('universal');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('status');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('phase');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('planning');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('type');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('priority');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('difficulty');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('impact');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('commentType');
			expect(DEFAULT_COLOR_SCHEME).toHaveProperty('custom');
		});

		it('should have valid hex color codes', () => {
			const hexPattern = /^[0-9a-f]{6}$/i;

			expect(DEFAULT_COLOR_SCHEME.universal).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.phase).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.planning).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.custom).toMatch(hexPattern);

			// Check nested colors
			expect(DEFAULT_COLOR_SCHEME.status.pending).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.status.inProgress).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.status.completed).toMatch(hexPattern);

			expect(DEFAULT_COLOR_SCHEME.priority.low).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.priority.medium).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.priority.high).toMatch(hexPattern);
			expect(DEFAULT_COLOR_SCHEME.priority.critical).toMatch(hexPattern);
		});
	});

	describe('LabelManager', () => {
		let mockClient: GitHubClient;
		let labelManager: LabelManager;

		beforeEach(() => {
			mockClient = createMockGitHubClient();
			labelManager = new LabelManager({ githubClient: mockClient });
		});

		describe('constructor', () => {
			it('should create instance with default color scheme', () => {
				expect(labelManager).toBeInstanceOf(LabelManager);
			});

			it('should accept custom color scheme', () => {
				const customScheme: ColorScheme = {
					...DEFAULT_COLOR_SCHEME,
					universal: 'ff0000'
				};

				const manager = new LabelManager({
					githubClient: mockClient,
					colorScheme: customScheme
				});
				expect(manager).toBeInstanceOf(LabelManager);
			});
		});

		describe('warmup', () => {
			it('should create common labels on first call', async () => {
				await labelManager.warmup();

				expect(mockClient.ensureLabelExists).toHaveBeenCalled();
				// Should create universal label + status labels + type labels + comment labels
				const callCount = (mockClient.ensureLabelExists as ReturnType<typeof vi.fn>)
					.mock.calls.length;
				expect(callCount).toBeGreaterThan(5); // At least a few labels
			});

			it('should not duplicate labels on subsequent calls', async () => {
				await labelManager.warmup();
				const firstCallCount = (mockClient.ensureLabelExists as ReturnType<typeof vi.fn>)
					.mock.calls.length;

				vi.clearAllMocks();
				await labelManager.warmup();
				const secondCallCount = (mockClient.ensureLabelExists as ReturnType<typeof vi.fn>)
					.mock.calls.length;

				expect(secondCallCount).toBe(0); // Should not create again
			});
		});

		describe('generateForTask', () => {
			it('should always include universal label', () => {
				const input: GenerateLabelsInput = {
					task: createTask(),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('from:claude-code');
			});

			it('should add status label', () => {
				const pendingInput: GenerateLabelsInput = {
					task: createTask({ status: 'pending' }),
					planningCode: 'P-003'
				};
				expect(labelManager.generateForTask(pendingInput)).toContain('status:pending');

				const inProgressInput: GenerateLabelsInput = {
					task: createTask({ status: 'in_progress' }),
					planningCode: 'P-003'
				};
				expect(labelManager.generateForTask(inProgressInput)).toContain('status:in-progress');

				const completedInput: GenerateLabelsInput = {
					task: createTask({ status: 'completed' }),
					planningCode: 'P-003'
				};
				expect(labelManager.generateForTask(completedInput)).toContain('status:completed');
			});

			it('should add phase label when provided', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ phase: 3 }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('phase:3');
			});

			it('should add planning label when provided', () => {
				const input: GenerateLabelsInput = {
					task: createTask(),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('planning:P-003');
			});

			it('should add type label based on level', () => {
				const taskInput: GenerateLabelsInput = {
					task: createTask({ level: 0 }),
					planningCode: 'P-003'
				};
				expect(labelManager.generateForTask(taskInput)).toContain('type:task');

				const subtaskInput: GenerateLabelsInput = {
					task: createTask({ level: 1 }),
					planningCode: 'P-003'
				};
				expect(labelManager.generateForTask(subtaskInput)).toContain('type:subtask');

				const subSubtaskInput: GenerateLabelsInput = {
					task: createTask({ level: 2 }),
					planningCode: 'P-003'
				};
				expect(labelManager.generateForTask(subSubtaskInput)).toContain('type:sub-subtask');
			});

			it('should add intelligent suggestions based on title - security', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ title: 'Implement authentication security' }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('security');
			});

			it('should add intelligent suggestions based on title - performance', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ title: 'Optimize database queries' }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('performance');
			});

			it('should add intelligent suggestions based on title - testing', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ title: 'Add unit tests for service' }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('testing');
			});

			it('should add intelligent suggestions based on title - documentation', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ title: 'Write API documentation' }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('documentation');
			});

			it('should add intelligent suggestions based on title - refactoring', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ title: 'Refactor user model' }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('refactoring');
			});

			it('should add priority from estimate - critical (>=16h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 20 as any }), // estimate is number in implementation
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('priority:critical');
			});

			it('should add priority from estimate - high (>=8h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 10 as any }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('priority:high');
			});

			it('should add priority from estimate - medium (>=4h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 5 as any }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('priority:medium');
			});

			it('should add priority from estimate - low (<4h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 2 as any }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('priority:low');
			});

			it('should add difficulty from estimate - hard (>=8h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 10 as any }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('difficulty:hard');
			});

			it('should add difficulty from estimate - medium (>=4h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 5 as any }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('difficulty:medium');
			});

			it('should add difficulty from estimate - easy (<4h)', () => {
				const input: GenerateLabelsInput = {
					task: createTask({ estimate: 2 as any }),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('difficulty:easy');
			});

			it('should not duplicate labels', () => {
				const input: GenerateLabelsInput = {
					task: createTask({
						title: 'Security testing with tests',
						estimate: 10 as any
					}),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				// Check no duplicates
				const uniqueLabels = new Set(labels);
				expect(labels.length).toBe(uniqueLabels.size);
			});

			it('should generate comprehensive labels for complex task', () => {
				const input: GenerateLabelsInput = {
					task: createTask({
						title: 'Implement authentication security with documentation',
						status: 'in_progress',
						phase: 2,
						level: 0,
						estimate: 12 as any
					}),
					planningCode: 'P-003'
				};

				const labels = labelManager.generateForTask(input);

				expect(labels).toContain('from:claude-code');
				expect(labels).toContain('status:in-progress');
				expect(labels).toContain('phase:2');
				expect(labels).toContain('planning:P-003');
				expect(labels).toContain('type:task');
				expect(labels).toContain('security');
				expect(labels).toContain('documentation');
				expect(labels).toContain('priority:high');
				expect(labels).toContain('difficulty:hard');
			});
		});

		describe('generateForComment', () => {
			it('should generate labels for TODO comment', () => {
				const comment = {
					id: 'comment-1',
					type: 'TODO' as const,
					text: 'Implement user validation',
					filePath: 'src/user.ts',
					lineNumber: 10
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('from:claude-code');
				expect(labels).toContain('comment:todo');
			});

			it('should generate labels for HACK comment', () => {
				const comment = {
					id: 'comment-2',
					type: 'HACK' as const,
					text: 'Temporary workaround for API bug',
					filePath: 'src/api.ts',
					lineNumber: 50
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('from:claude-code');
				expect(labels).toContain('comment:hack');
			});

			it('should generate labels for DEBUG comment', () => {
				const comment = {
					id: 'comment-3',
					type: 'DEBUG' as const,
					text: 'Remove before production',
					filePath: 'src/debug.ts',
					lineNumber: 20
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('from:claude-code');
				expect(labels).toContain('comment:debug');
			});

			it('should add context-based labels - bug', () => {
				const comment = {
					id: 'comment-4',
					type: 'TODO' as const,
					text: 'Fix the bug in user validation',
					filePath: 'src/user.ts',
					lineNumber: 10
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('bug');
			});

			it('should add context-based labels - security', () => {
				const comment = {
					id: 'comment-5',
					type: 'TODO' as const,
					text: 'Add security validation for passwords',
					filePath: 'src/auth.ts',
					lineNumber: 30
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('security');
			});

			it('should add context-based labels - performance', () => {
				const comment = {
					id: 'comment-6',
					type: 'HACK' as const,
					text: 'Optimize this slow query',
					filePath: 'src/db.ts',
					lineNumber: 40
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('performance');
			});

			it('should add context-based labels - technical-debt', () => {
				const comment = {
					id: 'comment-7',
					type: 'HACK' as const,
					text: 'This is technical debt that needs refactoring',
					filePath: 'src/legacy.ts',
					lineNumber: 100
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('technical-debt');
			});

			it('should add context-based labels - temporary', () => {
				const comment = {
					id: 'comment-8',
					type: 'DEBUG' as const,
					text: 'Temporary logging for debugging',
					filePath: 'src/app.ts',
					lineNumber: 5
				};

				const labels = labelManager.generateForComment(comment);

				expect(labels).toContain('temporary');
			});
		});

		describe('ensureLabelsExist', () => {
			it('should create labels that do not exist', async () => {
				const labels = ['from:claude-code', 'status:pending', 'priority:high'];

				await labelManager.ensureLabelsExist(labels);

				expect(mockClient.ensureLabelExists).toHaveBeenCalledTimes(labels.length);
			});

			it('should handle empty label array', async () => {
				await labelManager.ensureLabelsExist([]);

				expect(mockClient.ensureLabelExists).not.toHaveBeenCalled();
			});

			it('should use correct colors for labels', async () => {
				await labelManager.ensureLabelsExist(['from:claude-code']);

				expect(mockClient.ensureLabelExists).toHaveBeenCalledWith(
					expect.objectContaining({
						name: 'from:claude-code',
						color: DEFAULT_COLOR_SCHEME.universal
					})
				);
			});

			it('should use correct colors for status labels', async () => {
				await labelManager.ensureLabelsExist(['status:pending']);

				expect(mockClient.ensureLabelExists).toHaveBeenCalledWith(
					expect.objectContaining({
						name: 'status:pending',
						color: DEFAULT_COLOR_SCHEME.status.pending
					})
				);
			});

			it('should use correct colors for priority labels', async () => {
				await labelManager.ensureLabelsExist(['priority:high']);

				expect(mockClient.ensureLabelExists).toHaveBeenCalledWith(
					expect.objectContaining({
						name: 'priority:high',
						color: DEFAULT_COLOR_SCHEME.priority.high
					})
				);
			});

			it('should use custom color for unknown labels', async () => {
				await labelManager.ensureLabelsExist(['custom-label']);

				expect(mockClient.ensureLabelExists).toHaveBeenCalledWith(
					expect.objectContaining({
						name: 'custom-label',
						color: DEFAULT_COLOR_SCHEME.custom
					})
				);
			});
		});
	});

	describe('generateLabelsForTask (legacy export)', () => {
		it('should always include from:claude-code label', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask(),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels).toContain('from:claude-code');
		});

		it('should add status label based on task status', () => {
			// Arrange - pending
			const pendingInput: GenerateLabelsInput = {
				task: createTask({ status: 'pending' }),
				planningCode: 'P-003'
			};

			// Act
			const pendingLabels = generateLabelsForTask(pendingInput);

			// Assert
			expect(pendingLabels).toContain('status:pending');

			// Arrange - in_progress
			const inProgressInput: GenerateLabelsInput = {
				task: createTask({ status: 'in_progress' }),
				planningCode: 'P-003'
			};

			// Act
			const inProgressLabels = generateLabelsForTask(inProgressInput);

			// Assert
			expect(inProgressLabels).toContain('status:in-progress');

			// Arrange - completed
			const completedInput: GenerateLabelsInput = {
				task: createTask({ status: 'completed' }),
				planningCode: 'P-003'
			};

			// Act
			const completedLabels = generateLabelsForTask(completedInput);

			// Assert
			expect(completedLabels).toContain('status:completed');
		});

		it('should add phase label if phase is specified', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask({ phase: 2 }),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels).toContain('phase:2');
		});

		it('should add planning label with planning code', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask(),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels).toContain('planning:P-003');
		});

		it('should add type:task for level 0 tasks', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask({ level: 0 }),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels).toContain('type:task');
		});

		it('should add type:subtask for level 1 tasks', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask({ level: 1 }),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels).toContain('type:subtask');
		});

		it('should generate all labels for a complete task', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask({
					status: 'in_progress',
					phase: 3,
					level: 0
				}),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels).toEqual(
				expect.arrayContaining([
					'from:claude-code',
					'status:in-progress',
					'phase:3',
					'planning:P-003',
					'type:task'
				])
			);
		});

		it('should not add phase label if phase is not specified', () => {
			// Arrange
			const input: GenerateLabelsInput = {
				task: createTask({ phase: undefined }),
				planningCode: 'P-003'
			};

			// Act
			const labels = generateLabelsForTask(input);

			// Assert
			expect(labels.some((l) => l.startsWith('phase:'))).toBe(false);
		});
	});
});
