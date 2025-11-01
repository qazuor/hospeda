/**
 * Tests for tracking validation schemas
 */

import { describe, expect, it } from 'vitest';
import {
    safeValidateTrackingDatabase,
    trackingDatabaseSchema,
    trackingRecordSchema,
    validateTrackingDatabase,
    validateTrackingRecord
} from '../../src/tracking/validation';

describe('tracking/validation', () => {
    describe('trackingRecordSchema', () => {
        it('should validate a complete tracking record', () => {
            // Arrange
            const validRecord = {
                id: 'track-001',
                type: 'planning-task' as const,
                source: {
                    sessionId: 'P-003',
                    taskId: 'T-003-001'
                },
                status: 'pending' as const,
                syncAttempts: 0,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(validRecord)).not.toThrow();
        });

        it('should validate a tracking record with GitHub mapping', () => {
            // Arrange
            const validRecord = {
                id: 'track-002',
                type: 'code-comment' as const,
                source: {
                    commentId: 'TODO-123',
                    filePath: 'src/example.ts',
                    lineNumber: 42
                },
                github: {
                    issueNumber: 100,
                    issueUrl: 'https://github.com/test/repo/issues/100',
                    createdAt: '2025-11-01T00:00:00.000Z',
                    updatedAt: '2025-11-01T01:00:00.000Z'
                },
                status: 'synced' as const,
                lastSyncedAt: '2025-11-01T01:00:00.000Z',
                syncAttempts: 1,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T01:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(validRecord)).not.toThrow();
        });

        it('should reject invalid record type', () => {
            // Arrange
            const invalidRecord = {
                id: 'track-003',
                type: 'invalid-type',
                source: {},
                status: 'pending',
                syncAttempts: 0,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(invalidRecord)).toThrow();
        });

        it('should reject invalid sync status', () => {
            // Arrange
            const invalidRecord = {
                id: 'track-004',
                type: 'planning-task',
                source: {},
                status: 'invalid-status',
                syncAttempts: 0,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(invalidRecord)).toThrow();
        });

        it('should reject negative syncAttempts', () => {
            // Arrange
            const invalidRecord = {
                id: 'track-005',
                type: 'planning-task',
                source: {},
                status: 'pending',
                syncAttempts: -1,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(invalidRecord)).toThrow();
        });

        it('should reject invalid datetime format', () => {
            // Arrange
            const invalidRecord = {
                id: 'track-006',
                type: 'planning-task',
                source: {},
                status: 'pending',
                syncAttempts: 0,
                createdAt: 'invalid-date',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(invalidRecord)).toThrow();
        });

        it('should reject negative line number', () => {
            // Arrange
            const invalidRecord = {
                id: 'track-007',
                type: 'code-comment',
                source: {
                    filePath: 'src/test.ts',
                    lineNumber: -5
                },
                status: 'pending',
                syncAttempts: 0,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act & Assert
            expect(() => trackingRecordSchema.parse(invalidRecord)).toThrow();
        });
    });

    describe('trackingDatabaseSchema', () => {
        it('should validate a complete tracking database', () => {
            // Arrange
            const validDatabase = {
                version: '1.0.0',
                records: [
                    {
                        id: 'track-001',
                        type: 'planning-task' as const,
                        source: { sessionId: 'P-003' },
                        status: 'pending' as const,
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

            // Act & Assert
            expect(() => trackingDatabaseSchema.parse(validDatabase)).not.toThrow();
        });

        it('should validate empty tracking database', () => {
            // Arrange
            const emptyDatabase = {
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

            // Act & Assert
            expect(() => trackingDatabaseSchema.parse(emptyDatabase)).not.toThrow();
        });

        it('should reject invalid version', () => {
            // Arrange
            const invalidDatabase = {
                version: 123, // Should be string
                records: [],
                metadata: {
                    lastSync: '2025-11-01T00:00:00.000Z',
                    totalRecords: 0,
                    byStatus: {}
                }
            };

            // Act & Assert
            expect(() => trackingDatabaseSchema.parse(invalidDatabase)).toThrow();
        });

        it('should reject missing metadata', () => {
            // Arrange
            const invalidDatabase = {
                version: '1.0.0',
                records: []
                // Missing metadata
            };

            // Act & Assert
            expect(() => trackingDatabaseSchema.parse(invalidDatabase)).toThrow();
        });
    });

    describe('validateTrackingDatabase', () => {
        it('should validate and return tracking database', () => {
            // Arrange
            const validDatabase = {
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
            const result = validateTrackingDatabase(validDatabase);

            // Assert
            expect(result).toEqual(validDatabase);
        });

        it('should throw on invalid database', () => {
            // Arrange
            const invalidDatabase = { invalid: 'data' };

            // Act & Assert
            expect(() => validateTrackingDatabase(invalidDatabase)).toThrow();
        });
    });

    describe('validateTrackingRecord', () => {
        it('should validate and return tracking record', () => {
            // Arrange
            const validRecord = {
                id: 'track-001',
                type: 'planning-task' as const,
                source: {},
                status: 'pending' as const,
                syncAttempts: 0,
                createdAt: '2025-11-01T00:00:00.000Z',
                modifiedAt: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = validateTrackingRecord(validRecord);

            // Assert
            expect(result).toEqual(validRecord);
        });

        it('should throw on invalid record', () => {
            // Arrange
            const invalidRecord = { invalid: 'data' };

            // Act & Assert
            expect(() => validateTrackingRecord(invalidRecord)).toThrow();
        });
    });

    describe('safeValidateTrackingDatabase', () => {
        it('should return success for valid database', () => {
            // Arrange
            const validDatabase = {
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
            const result = safeValidateTrackingDatabase(validDatabase);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual(validDatabase);
            expect(result.error).toBeUndefined();
        });

        it('should return error for invalid database', () => {
            // Arrange
            const invalidDatabase = { invalid: 'data' };

            // Act
            const result = safeValidateTrackingDatabase(invalidDatabase);

            // Assert
            expect(result.success).toBe(false);
            expect(result.data).toBeUndefined();
            expect(result.error).toBeDefined();
        });
    });
});
