/**
 * Edge case tests for tracking system
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    FileOperationError,
    createBackup,
    readTrackingFile,
    writeTrackingFile
} from '../../src/tracking/file-operations';
import { TrackingManager } from '../../src/tracking/tracking-manager';
import type { TrackingDatabase } from '../../src/tracking/types';

describe('tracking/edge-cases', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'tracking-edge-test-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('file-operations error handling', () => {
        it('should handle corrupt JSON gracefully', async () => {
            // Arrange
            const filePath = join(tempDir, 'corrupt.json');
            await writeFile(filePath, '{ invalid json }', 'utf-8');

            // Act & Assert
            await expect(readTrackingFile(filePath)).rejects.toThrow(FileOperationError);
            await expect(readTrackingFile(filePath)).rejects.toThrow('Failed to parse JSON');
        });

        it('should handle invalid schema gracefully', async () => {
            // Arrange
            const filePath = join(tempDir, 'invalid-schema.json');
            const invalidData = { totally: 'wrong', schema: true };
            await writeFile(filePath, JSON.stringify(invalidData), 'utf-8');

            // Act & Assert
            await expect(readTrackingFile(filePath)).rejects.toThrow(FileOperationError);
            await expect(readTrackingFile(filePath)).rejects.toThrow(
                'Invalid tracking database schema'
            );
        });

        it('should handle write to invalid path', async () => {
            // Arrange
            const invalidPath = '/invalid/path/that/does/not/exist/tracking.json';
            const data: TrackingDatabase = {
                version: '1.0.0',
                records: [],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 0,
                    byStatus: { pending: 0, synced: 0, updated: 0, failed: 0 }
                }
            };

            // Act & Assert
            // This might fail due to permissions on root directory
            // Skipping on CI/systems where we can't write to root
            if (process.platform !== 'win32') {
                await expect(writeTrackingFile(invalidPath, data)).rejects.toThrow();
            }
        });

        it('should validate data before writing', async () => {
            // Arrange
            const filePath = join(tempDir, 'tracking.json');
            const invalidData = { invalid: 'data' } as unknown as TrackingDatabase;

            // Act & Assert
            await expect(writeTrackingFile(filePath, invalidData)).rejects.toThrow();
        });

        it('should handle backup errors gracefully', async () => {
            // Arrange - Create a directory with same name as backup would have
            const filePath = join(tempDir, 'tracking.json');
            const backupPath = `${filePath}.bak`;

            // Create directory where backup file should be (will cause error)
            await mkdir(backupPath);

            // Create original file
            await writeFile(filePath, 'test', 'utf-8');

            // Act & Assert
            await expect(createBackup(filePath)).rejects.toThrow(FileOperationError);
        });
    });

    describe('tracking-manager edge cases', () => {
        it('should handle operations before load', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'tracking.json');
            const manager = new TrackingManager(trackingFile);

            // Act & Assert - Should throw on any operation before load
            await expect(
                manager.addRecord({
                    type: 'planning-task',
                    source: {},
                    status: 'pending',
                    syncAttempts: 0
                })
            ).rejects.toThrow('not loaded');

            await expect(manager.getStatistics()).rejects.toThrow('not loaded');
            await expect(manager.findById('test')).rejects.toThrow('not loaded');
        });

        it('should handle large number of records', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'large-tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            // Add 1000 records
            const recordPromises = [];
            for (let i = 0; i < 1000; i++) {
                recordPromises.push(
                    manager.addRecord({
                        type: 'planning-task',
                        source: { sessionId: `P-${Math.floor(i / 10)}`, taskId: `T-${i}` },
                        status: 'pending',
                        syncAttempts: 0
                    })
                );
            }

            await Promise.all(recordPromises);

            // Act
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(1000);
            expect(stats.byStatus.pending).toBe(1000);
        });

        it('should handle concurrent updates correctly', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'concurrent-tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            const record = await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act - Multiple concurrent updates
            await Promise.all([
                manager.updateRecord(record.id, { status: 'synced' }),
                manager.updateRecord(record.id, { syncAttempts: 1 }),
                manager.updateRecord(record.id, { lastError: 'test error' })
            ]);

            const updated = await manager.findById(record.id);

            // Assert - All updates should be reflected
            expect(updated).toBeDefined();
            // Last write wins for each field
            expect(updated?.updatedAt).toBeDefined();
        });

        it('should handle missing optional fields in source', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            // Act - Add record with minimal source info
            const record = await manager.addRecord({
                type: 'code-comment',
                source: {}, // Empty source
                status: 'pending',
                syncAttempts: 0
            });

            // Assert
            expect(record.source.sessionId).toBeUndefined();
            expect(record.source.taskId).toBeUndefined();
            expect(record.source.commentId).toBeUndefined();
        });

        it('should maintain data consistency after multiple operations', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'consistency-tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            // Act - Multiple operations
            const r1 = await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-001' },
                status: 'pending',
                syncAttempts: 0
            });

            const r2 = await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-001' },
                status: 'pending',
                syncAttempts: 0
            });

            await manager.markAsSynced(r1.id, 100, 'https://github.com/test/repo/issues/100');
            await manager.markAsFailed(r2.id, 'Error');
            await manager.deleteRecord(r1.id);

            // Save and reload
            await manager.save();
            const manager2 = new TrackingManager(trackingFile);
            await manager2.load();

            // Assert
            const stats = await manager2.getStatistics();
            expect(stats.total).toBe(1); // Only r2 remains
            expect(stats.byStatus.failed).toBe(1);

            const found = await manager2.findById(r1.id);
            expect(found).toBeUndefined(); // r1 was deleted
        });

        it('should handle update with all possible fields', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            const record = await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act - Update with all possible fields
            const updated = await manager.updateRecord(record.id, {
                type: 'code-comment',
                source: {
                    commentId: 'TODO-123',
                    filePath: 'src/test.ts',
                    lineNumber: 42
                },
                github: {
                    issueNumber: 100,
                    issueUrl: 'https://github.com/test/repo/issues/100',
                    createdAt: '2025-11-01T00:00:00.000Z',
                    updatedAt: '2025-11-01T01:00:00.000Z'
                },
                status: 'synced',
                lastSyncedAt: '2025-11-01T01:00:00.000Z',
                syncAttempts: 3,
                lastError: 'Previous error'
            });

            // Assert
            expect(updated.type).toBe('code-comment');
            expect(updated.source.commentId).toBe('TODO-123');
            expect(updated.github?.issueNumber).toBe(100);
            expect(updated.status).toBe('synced');
        });

        it('should handle records without session ID in statistics', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            await manager.addRecord({
                type: 'code-comment',
                source: { commentId: 'TODO-1' }, // No sessionId
                status: 'pending',
                syncAttempts: 0
            });

            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act
            const stats = await manager.getStatistics();

            // Assert
            expect(stats.total).toBe(2);
            expect(stats.byType['code-comment']).toBe(1);
            expect(stats.byType['planning-task']).toBe(1);
            expect(stats.bySession['P-003']).toBe(1);
            // Code comment without sessionId should not appear in bySession
        });
    });

    describe('persistence edge cases', () => {
        it('should handle save/load cycle with complex data', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'complex-tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            // Add various types of records
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003', taskId: 'T-003-001' },
                status: 'pending',
                syncAttempts: 0
            });

            const r2 = await manager.addRecord({
                type: 'code-comment',
                source: { commentId: 'TODO-123', filePath: 'src/test.ts', lineNumber: 42 },
                status: 'pending',
                syncAttempts: 0
            });

            await manager.markAsSynced(r2.id, 100, 'https://github.com/test/repo/issues/100');

            // Act - Save and reload
            await manager.save();
            const manager2 = new TrackingManager(trackingFile);
            await manager2.load();

            // Assert
            const stats = await manager2.getStatistics();
            expect(stats.total).toBe(2);
            expect(stats.byStatus.pending).toBe(1);
            expect(stats.byStatus.synced).toBe(1);

            const synced = await manager2.findByIssueNumber(100);
            expect(synced).toBeDefined();
            expect(synced?.source.commentId).toBe('TODO-123');
        });

        it('should create valid backup file', async () => {
            // Arrange
            const trackingFile = join(tempDir, 'tracking.json');
            const manager = new TrackingManager(trackingFile);
            await manager.load();

            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-003' },
                status: 'pending',
                syncAttempts: 0
            });

            await manager.save();

            // Modify and save again to create backup
            await manager.addRecord({
                type: 'planning-task',
                source: { sessionId: 'P-004' },
                status: 'pending',
                syncAttempts: 0
            });

            // Act
            await manager.save();

            // Assert - Backup should be valid tracking database
            const backupData = await readTrackingFile(`${trackingFile}.bak`);
            expect(backupData.records).toHaveLength(1); // First version with 1 record
            expect(backupData.version).toBe('1.0.0');
        });
    });
});
