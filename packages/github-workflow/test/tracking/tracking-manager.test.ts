/**
 * Tests for tracking manager
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrackingManager } from '../../src/tracking/tracking-manager';
import type { CreateTrackingRecordInput } from '../../src/tracking/types';

describe('tracking/tracking-manager', () => {
    let tempDir: string;
    let trackingFile: string;
    let manager: TrackingManager;

    beforeEach(async () => {
        // Create temp directory for each test
        tempDir = await mkdtemp(join(tmpdir(), 'tracking-manager-test-'));
        trackingFile = join(tempDir, 'tracking.json');
        manager = new TrackingManager(trackingFile);
    });

    afterEach(async () => {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('initialization', () => {
        it('should initialize with empty database on first load', async () => {
            // Act
            await manager.load();
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(0);
            expect(stats.byStatus.pending).toBe(0);
        });

        it('should load existing database', async () => {
            // Arrange
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            };
            await manager.load();
            await manager.addRecord(input);
            await manager.save();

            // Create new manager instance
            const manager2 = new TrackingManager(trackingFile);

            // Act
            await manager2.load();
            const stats = await manager2.getStatistics();

            // Assert
            expect(stats.total).toBe(1);
        });
    });

    describe('addRecord', () => {
        it('should add a new tracking record', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            };

            // Act
            const record = await manager.addRecord(input);

            // Assert
            expect(record.id).toBeDefined();
            expect(record.type).toBe('planning-task');
            expect(record.source.sessionId).toBe('P-003');
            expect(record.createdAt).toBeDefined();
            expect(record.modifiedAt).toBeDefined();
        });

        it('should generate unique IDs for multiple records', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };

            // Act
            const record1 = await manager.addRecord(input);
            const record2 = await manager.addRecord(input);

            // Assert
            expect(record1.id).not.toBe(record2.id);
        });

        it('should update metadata after adding record', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };

            // Act
            await manager.addRecord(input);
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(1);
            expect(stats.byStatus.pending).toBe(1);
        });
    });

    describe('updateRecord', () => {
        it('should update an existing record', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);
            const originalModifiedAt = record.modifiedAt;

            // Small delay to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Act
            const updated = await manager.updateRecord(record.id, {
                status: 'synced',
                syncAttempts: 1
            });

            // Assert
            expect(updated.status).toBe('synced');
            expect(updated.syncAttempts).toBe(1);
            expect(updated.modifiedAt).not.toBe(originalModifiedAt);
            expect(new Date(updated.modifiedAt).getTime()).toBeGreaterThan(
                new Date(originalModifiedAt).getTime()
            );
        });

        it('should throw when updating non-existent record', async () => {
            // Arrange
            await manager.load();

            // Act & Assert
            await expect(
                manager.updateRecord('non-existent-id', { status: 'synced' })
            ).rejects.toThrow('Record not found');
        });

        it('should preserve other fields when updating', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);

            // Act
            const updated = await manager.updateRecord(record.id, { status: 'synced' });

            // Assert
            expect(updated.source.sessionId).toBe('P-003');
            expect(updated.source.taskId).toBe('T-003-001');
            expect(updated.createdAt).toBe(record.createdAt);
        });
    });

    describe('deleteRecord', () => {
        it('should delete an existing record', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);

            // Act
            const deleted = await manager.deleteRecord(record.id);

            // Assert
            expect(deleted).toBe(true);
            const found = await manager.findById(record.id);
            expect(found).toBeUndefined();
        });

        it('should return false when deleting non-existent record', async () => {
            // Arrange
            await manager.load();

            // Act
            const deleted = await manager.deleteRecord('non-existent-id');

            // Assert
            expect(deleted).toBe(false);
        });

        it('should update metadata after deleting record', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);

            // Act
            await manager.deleteRecord(record.id);
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(0);
        });
    });

    describe('findById', () => {
        it('should find record by ID', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);

            // Act
            const found = await manager.findById(record.id);

            // Assert
            expect(found).toBeDefined();
            expect(found?.id).toBe(record.id);
        });

        it('should return undefined for non-existent ID', async () => {
            // Arrange
            await manager.load();

            // Act
            const found = await manager.findById('non-existent-id');

            // Assert
            expect(found).toBeUndefined();
        });
    });

    describe('findByTaskId', () => {
        it('should find record by task ID', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            };
            await manager.addRecord(input);

            // Act
            const found = await manager.findByTaskId('T-003-001');

            // Assert
            expect(found).toBeDefined();
            expect(found?.source.taskId).toBe('T-003-001');
        });

        it('should return undefined for non-existent task ID', async () => {
            // Arrange
            await manager.load();

            // Act
            const found = await manager.findByTaskId('T-999-999');

            // Assert
            expect(found).toBeUndefined();
        });
    });

    describe('findByCommentId', () => {
        it('should find record by comment ID', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'code-comment',
                source: { commentId: 'TODO-123', filePath: 'src/test.ts' },
                status: 'pending',
                syncAttempts: 0
            };
            await manager.addRecord(input);

            // Act
            const found = await manager.findByCommentId('TODO-123');

            // Assert
            expect(found).toBeDefined();
            expect(found?.source.commentId).toBe('TODO-123');
        });

        it('should return undefined for non-existent comment ID', async () => {
            // Arrange
            await manager.load();

            // Act
            const found = await manager.findByCommentId('TODO-999');

            // Assert
            expect(found).toBeUndefined();
        });
    });

    describe('findByIssueNumber', () => {
        it('should find record by GitHub issue number', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);
            await manager.markAsSynced(record.id, 42, 'https://github.com/test/repo/issues/42');

            // Act
            const found = await manager.findByIssueNumber(42);

            // Assert
            expect(found).toBeDefined();
            expect(found?.github?.issueNumber).toBe(42);
        });

        it('should return undefined for non-existent issue number', async () => {
            // Arrange
            await manager.load();

            // Act
            const found = await manager.findByIssueNumber(999);

            // Assert
            expect(found).toBeUndefined();
        });
    });

    describe('getRecordsByStatus', () => {
        it('should return records with specific status', async () => {
            // Arrange
            await manager.load();
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-004' },
                status: 'synced',
                syncAttempts: 1
            });

            // Act
            const pending = await manager.getRecordsByStatus('pending');

            // Assert
            expect(pending).toHaveLength(1);
            expect(pending[0].status).toBe('pending');
        });

        it('should return empty array when no records match', async () => {
            // Arrange
            await manager.load();

            // Act
            const failed = await manager.getRecordsByStatus('failed');

            // Assert
            expect(failed).toHaveLength(0);
        });
    });

    describe('getRecordsBySession', () => {
        it('should return records for specific session', async () => {
            // Arrange
            await manager.load();
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            });
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-002' },
                status: 'pending',
                syncAttempts: 0
            });
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-004', taskId: 'T-004-001' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act
            const p003Records = await manager.getRecordsBySession('P-003');

            // Assert
            expect(p003Records).toHaveLength(2);
            expect(p003Records.every((r) => r.source.sessionId === 'P-003')).toBe(true);
        });

        it('should return empty array when no records match', async () => {
            // Arrange
            await manager.load();

            // Act
            const records = await manager.getRecordsBySession('P-999');

            // Assert
            expect(records).toHaveLength(0);
        });
    });

    describe('markAsSynced', () => {
        it('should mark record as synced with GitHub info', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);

            // Act
            const synced = await manager.markAsSynced(
                record.id,
                42,
                'https://github.com/test/repo/issues/42'
            );

            // Assert
            expect(synced.status).toBe('synced');
            expect(synced.github?.issueNumber).toBe(42);
            expect(synced.github?.issueUrl).toBe('https://github.com/test/repo/issues/42');
            expect(synced.lastSyncedAt).toBeDefined();
            expect(synced.syncAttempts).toBe(1);
        });

        it('should throw when marking non-existent record', async () => {
            // Arrange
            await manager.load();

            // Act & Assert
            await expect(
                manager.markAsSynced('non-existent', 42, 'https://github.com/test/repo/issues/42')
            ).rejects.toThrow('Record not found');
        });
    });

    describe('markAsFailed', () => {
        it('should mark record as failed with error message', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            };
            const record = await manager.addRecord(input);

            // Act
            const failed = await manager.markAsFailed(record.id, 'GitHub API error');

            // Assert
            expect(failed.status).toBe('failed');
            expect(failed.lastError).toBe('GitHub API error');
            expect(failed.syncAttempts).toBe(1);
        });

        it('should increment sync attempts', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 2
            };
            const record = await manager.addRecord(input);

            // Act
            const failed = await manager.markAsFailed(record.id, 'Error');

            // Assert
            expect(failed.syncAttempts).toBe(3);
        });
    });

    describe('resetPending', () => {
        it('should reset failed records to pending', async () => {
            // Arrange
            await manager.load();
            const input: CreateTrackingRecordInput = {
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'failed',
                syncAttempts: 3,
                lastError: 'Previous error'
            };
            const _record = await manager.addRecord(input);

            // Act
            const reset = await manager.resetPending();

            // Assert
            expect(reset).toHaveLength(1);
            expect(reset[0].status).toBe('pending');
            expect(reset[0].syncAttempts).toBe(0);
            expect(reset[0].lastError).toBeUndefined();
        });

        it('should not reset synced records', async () => {
            // Arrange
            await manager.load();
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'synced',
                syncAttempts: 1
            });

            // Act
            const reset = await manager.resetPending();

            // Assert
            expect(reset).toHaveLength(0);
        });
    });

    describe('getStatistics', () => {
        it('should return correct statistics', async () => {
            // Arrange
            await manager.load();
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'synced',
                syncAttempts: 1
            });
            await manager.addRecord({
                type: 'code-comment',
                source: { commentId: 'TODO-1' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(3);
            expect(stats.byStatus.pending).toBe(2);
            expect(stats.byStatus.synced).toBe(1);
            expect(stats.byType['planning-task']).toBe(2);
            expect(stats.byType['code-comment']).toBe(1);
            expect(stats.bySession['P-003']).toBe(2);
        });

        it('should return zero counts for empty database', async () => {
            // Arrange
            await manager.load();

            // Act
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(0);
            expect(stats.byStatus.pending).toBe(0);
        });
    });

    describe('save and persistence', () => {
        it('should persist records to file', async () => {
            // Arrange
            await manager.load();
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act
            await manager.save();

            // Create new manager and load
            const manager2 = new TrackingManager(trackingFile);
            await manager2.load();
            const stats = await manager2.getStatistics();

            // Assert
            expect(stats.total).toBe(1);
        });

        it('should create backup before saving', async () => {
            // Arrange
            const fs = await import('node:fs/promises');
            await manager.load();
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });
            await manager.save();

            // Modify and save again
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-004' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act
            await manager.save();

            // Assert
            const backupExists = await fs
                .access(`${trackingFile}.bak`)
                .then(() => true)
                .catch(() => false);
            expect(backupExists).toBe(true);
        });
    });
});
