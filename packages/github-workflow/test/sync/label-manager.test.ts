/**
 * Tests for label manager
 *
 * @module test/sync/label-manager
 */

import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/parsers/types';
import { generateLabelsForTask } from '../../src/sync/label-manager';

describe('label-manager', () => {
    describe('generateLabelsForTask', () => {
        it('should always include from:claude-code label', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Simple task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            const planningCode = 'P-003';

            // Act
            const labels = generateLabelsForTask({ task, planningCode });

            // Assert
            expect(labels).toContain('from:claude-code');
        });

        it('should add status label based on task status', () => {
            // Arrange - pending
            const pendingTask: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            // Act
            const pendingLabels = generateLabelsForTask({
                task: pendingTask,
                planningCode: 'P-003'
            });

            // Assert
            expect(pendingLabels).toContain('status:pending');

            // Arrange - in_progress
            const inProgressTask: Task = {
                ...pendingTask,
                status: 'in_progress'
            };

            // Act
            const inProgressLabels = generateLabelsForTask({
                task: inProgressTask,
                planningCode: 'P-003'
            });

            // Assert
            expect(inProgressLabels).toContain('status:in-progress');

            // Arrange - completed
            const completedTask: Task = {
                ...pendingTask,
                status: 'completed'
            };

            // Act
            const completedLabels = generateLabelsForTask({
                task: completedTask,
                planningCode: 'P-003'
            });

            // Assert
            expect(completedLabels).toContain('status:completed');
        });

        it('should add phase label if phase is specified', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                phase: 2,
                level: 0,
                lineNumber: 5
            };

            // Act
            const labels = generateLabelsForTask({ task, planningCode: 'P-003' });

            // Assert
            expect(labels).toContain('phase:2');
        });

        it('should add planning label with planning code', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            // Act
            const labels = generateLabelsForTask({ task, planningCode: 'P-003' });

            // Assert
            expect(labels).toContain('planning:P-003');
        });

        it('should add type:task for level 0 tasks', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            // Act
            const labels = generateLabelsForTask({ task, planningCode: 'P-003' });

            // Assert
            expect(labels).toContain('type:task');
        });

        it('should add type:subtask for level > 0 tasks', () => {
            // Arrange
            const task: Task = {
                id: 'task-002',
                code: 'T-003-002',
                title: 'Subtask',
                status: 'pending',
                level: 1,
                lineNumber: 10
            };

            // Act
            const labels = generateLabelsForTask({ task, planningCode: 'P-003' });

            // Assert
            expect(labels).toContain('type:subtask');
        });

        it('should generate all labels for a complete task', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'in_progress',
                phase: 3,
                level: 0,
                lineNumber: 5
            };

            // Act
            const labels = generateLabelsForTask({ task, planningCode: 'P-003' });

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
            expect(labels).toHaveLength(5);
        });

        it('should not add phase label if phase is not specified', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            // Act
            const labels = generateLabelsForTask({ task, planningCode: 'P-003' });

            // Assert
            expect(labels.some((l) => l.startsWith('phase:'))).toBe(false);
        });
    });
});
