/**
 * Tests for file operations
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    createBackup,
    ensureDirectory,
    readTrackingFile,
    writeTrackingFile
} from '../../src/tracking/file-operations';
import type { TrackingDatabase } from '../../src/tracking/types';

describe('tracking/file-operations', () => {
    let tempDir: string;

    beforeEach(async () => {
        // Create temp directory for each test
        tempDir = await mkdtemp(join(tmpdir(), 'tracking-test-'));
    });

    afterEach(async () => {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('readTrackingFile', () => {
        it('should read and parse valid tracking file', async () => {
            // Arrange
            const filePath = join(tempDir, 'tracking.json');
            const mockData: TrackingDatabase = {
                version: '1.0.0',
                records: [],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 0,
                    byStatus: {
                        pending: 0,
                        synced: 0,
                        updated: 0,
                        failed: 0
                    }
                }
            };

            // Write test data
            await writeTrackingFile(filePath, mockData);

            // Act
            const result = await readTrackingFile(filePath);

            // Assert
            expect(result).toEqual(mockData);
        });

        it('should return empty database for non-existent file', async () => {
            // Arrange
            const filePath = join(tempDir, 'non-existent.json');

            // Act
            const result = await readTrackingFile(filePath);

            // Assert
            expect(result.records).toEqual([]);
            expect(result.metadata.totalRecords).toBe(0);
        });

        it('should throw on invalid JSON', async () => {
            // Arrange
            const filePath = join(tempDir, 'invalid.json');
            const fs = await import('node:fs/promises');
            await fs.writeFile(filePath, 'invalid json{', 'utf-8');

            // Act & Assert
            await expect(readTrackingFile(filePath)).rejects.toThrow();
        });

        it('should throw on invalid schema', async () => {
            // Arrange
            const filePath = join(tempDir, 'invalid-schema.json');
            const fs = await import('node:fs/promises');
            await fs.writeFile(filePath, JSON.stringify({ invalid: 'schema' }), 'utf-8');

            // Act & Assert
            await expect(readTrackingFile(filePath)).rejects.toThrow();
        });
    });

    describe('writeTrackingFile', () => {
        it('should write tracking data to file', async () => {
            // Arrange
            const filePath = join(tempDir, 'tracking.json');
            const mockData: TrackingDatabase = {
                version: '1.0.0',
                records: [
                    {
                        id: 'track-001',
                        type: 'planning-task',
                        source: { sessionId: 'P-003' },
                        status: 'pending',
                        syncAttempts: 0,
                        createdAt: '2025-11-01T00:00:00.000Z',
                        modifiedAt: '2025-11-01T00:00:00.000Z'
                    }
                ],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 1,
                    byStatus: {
                        pending: 1,
                        synced: 0,
                        updated: 0,
                        failed: 0
                    }
                }
            };

            // Act
            await writeTrackingFile(filePath, mockData);

            // Assert
            const fs = await import('node:fs/promises');
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(mockData);
        });

        it('should create directory if it does not exist', async () => {
            // Arrange
            const nestedDir = join(tempDir, 'nested', 'dir');
            const filePath = join(nestedDir, 'tracking.json');
            const mockData: TrackingDatabase = {
                version: '1.0.0',
                records: [],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 0,
                    byStatus: {
                        pending: 0,
                        synced: 0,
                        updated: 0,
                        failed: 0
                    }
                }
            };

            // Act
            await writeTrackingFile(filePath, mockData);

            // Assert
            const fs = await import('node:fs/promises');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(JSON.parse(content)).toEqual(mockData);
        });

        it('should format JSON with indentation', async () => {
            // Arrange
            const filePath = join(tempDir, 'tracking.json');
            const mockData: TrackingDatabase = {
                version: '1.0.0',
                records: [],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 0,
                    byStatus: {
                        pending: 0,
                        synced: 0,
                        updated: 0,
                        failed: 0
                    }
                }
            };

            // Act
            await writeTrackingFile(filePath, mockData);

            // Assert
            const fs = await import('node:fs/promises');
            const content = await fs.readFile(filePath, 'utf-8');
            expect(content).toContain('\n'); // Should have newlines
            expect(content).toContain('  '); // Should have indentation
        });
    });

    describe('createBackup', () => {
        it('should create backup of existing file', async () => {
            // Arrange
            const filePath = join(tempDir, 'tracking.json');
            const mockData: TrackingDatabase = {
                version: '1.0.0',
                records: [],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 0,
                    byStatus: {
                        pending: 0,
                        synced: 0,
                        updated: 0,
                        failed: 0
                    }
                }
            };
            await writeTrackingFile(filePath, mockData);

            // Act
            const backupPath = await createBackup(filePath);

            // Assert
            expect(backupPath).toBe(`${filePath}.bak`);
            const fs = await import('node:fs/promises');
            const backupContent = await fs.readFile(backupPath, 'utf-8');
            const originalContent = await fs.readFile(filePath, 'utf-8');
            expect(backupContent).toBe(originalContent);
        });

        it('should return null for non-existent file', async () => {
            // Arrange
            const filePath = join(tempDir, 'non-existent.json');

            // Act
            const backupPath = await createBackup(filePath);

            // Assert
            expect(backupPath).toBeNull();
        });

        it('should overwrite existing backup', async () => {
            // Arrange
            const filePath = join(tempDir, 'tracking.json');
            const fs = await import('node:fs/promises');

            // Create original file
            await fs.writeFile(filePath, 'original content', 'utf-8');

            // Create first backup
            await createBackup(filePath);

            // Modify original
            await fs.writeFile(filePath, 'modified content', 'utf-8');

            // Act - Create second backup
            await createBackup(filePath);

            // Assert
            const backupContent = await fs.readFile(`${filePath}.bak`, 'utf-8');
            expect(backupContent).toBe('modified content');
        });
    });

    describe('ensureDirectory', () => {
        it('should create directory if it does not exist', async () => {
            // Arrange
            const dirPath = join(tempDir, 'new-directory');

            // Act
            await ensureDirectory(dirPath);

            // Assert
            const fs = await import('node:fs/promises');
            const stat = await fs.stat(dirPath);
            expect(stat.isDirectory()).toBe(true);
        });

        it('should not fail if directory already exists', async () => {
            // Arrange
            const dirPath = join(tempDir, 'existing-directory');
            const fs = await import('node:fs/promises');
            await fs.mkdir(dirPath);

            // Act & Assert
            await expect(ensureDirectory(dirPath)).resolves.not.toThrow();
        });

        it('should create nested directories', async () => {
            // Arrange
            const dirPath = join(tempDir, 'nested', 'directories', 'deep');

            // Act
            await ensureDirectory(dirPath);

            // Assert
            const fs = await import('node:fs/promises');
            const stat = await fs.stat(dirPath);
            expect(stat.isDirectory()).toBe(true);
        });
    });
});
