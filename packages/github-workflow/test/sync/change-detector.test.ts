/**
 * Tests for change detector
 *
 * @module test/sync/change-detector
 */

import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/parsers/types';
import { detectTaskChanges } from '../../src/sync/change-detector';
import type { TrackingRecord } from '../../src/tracking/types';

describe('change-detector', () => {
    describe('detectTaskChanges', () => {
        it('should detect no changes when task and record match', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Create auth',
                description: 'Add authentication',
                status: 'pending',
                estimate: '8h',
                assignee: 'dev1',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: {
                    sessionId: 'P-003',
                    taskId: 'task-001'
                },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z',
                github: {
                    issueNumber: 123,
                    issueUrl: 'https://github.com/org/repo/issues/123',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            };

            // Store current task data in tracking record
            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: task.title,
                description: task.description,
                status: task.status,
                estimate: task.estimate,
                assignee: task.assignee
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.titleChanged).toBe(false);
            expect(changes.descriptionChanged).toBe(false);
            expect(changes.statusChanged).toBe(false);
            expect(changes.estimateChanged).toBe(false);
            expect(changes.assigneeChanged).toBe(false);
            expect(changes.changedFields).toHaveLength(0);
        });

        it('should detect title change', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Create authentication (updated)',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: {
                    sessionId: 'P-003',
                    taskId: 'task-001'
                },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };

            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: 'Create authentication',
                status: 'pending'
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.titleChanged).toBe(true);
            expect(changes.changedFields).toContain('title');
        });

        it('should detect description change', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                description: 'Updated description',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'task-001' },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };

            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: 'Task',
                description: 'Original description',
                status: 'pending'
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.descriptionChanged).toBe(true);
            expect(changes.changedFields).toContain('description');
        });

        it('should detect status change', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'in_progress',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'task-001' },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };

            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: 'Task',
                status: 'pending'
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.statusChanged).toBe(true);
            expect(changes.changedFields).toContain('status');
        });

        it('should detect estimate change', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                estimate: '12h',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'task-001' },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };

            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: 'Task',
                status: 'pending',
                estimate: '8h'
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.estimateChanged).toBe(true);
            expect(changes.changedFields).toContain('estimate');
        });

        it('should detect assignee change', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                assignee: 'developer2',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'task-001' },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };

            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: 'Task',
                status: 'pending',
                assignee: 'developer1'
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.assigneeChanged).toBe(true);
            expect(changes.changedFields).toContain('assignee');
        });

        it('should detect multiple changes', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Updated task',
                description: 'New description',
                status: 'completed',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'task-001' },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };

            (record as unknown as { taskSnapshot?: unknown }).taskSnapshot = {
                title: 'Original task',
                description: 'Old description',
                status: 'pending'
            };

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert
            expect(changes.titleChanged).toBe(true);
            expect(changes.descriptionChanged).toBe(true);
            expect(changes.statusChanged).toBe(true);
            expect(changes.changedFields).toEqual(
                expect.arrayContaining(['title', 'description', 'status'])
            );
            expect(changes.changedFields).toHaveLength(3);
        });

        it('should handle missing taskSnapshot as no changes', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            const record: TrackingRecord = {
                id: 'track-001',
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'task-001' },
                status: 'synced',
                syncAttempts: 1,
                createdAt: '2024-01-01T00:00:00Z',
                modifiedAt: '2024-01-01T00:00:00Z'
            };
            // No taskSnapshot

            // Act
            const changes = detectTaskChanges({ task, trackingRecord: record });

            // Assert - should detect changes since we don't have baseline
            expect(changes.changedFields.length).toBeGreaterThan(0);
        });
    });
});
