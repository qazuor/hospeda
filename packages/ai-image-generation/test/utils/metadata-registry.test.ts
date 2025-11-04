/**
 * Unit tests for MetadataRegistry
 *
 * @module test/utils/metadata-registry
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MockupMetadata, Registry } from '../../src/types';
import { MetadataRegistry } from '../../src/utils/metadata-registry';

describe('MetadataRegistry', () => {
    const testDir = path.join(process.cwd(), 'test-registry-output');
    let registry: MetadataRegistry;

    beforeEach(async () => {
        registry = new MetadataRegistry();

        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore if doesn't exist
        }

        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Cleanup after tests
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('load', () => {
        it('should create new registry if file does not exist', async () => {
            // Act
            const data = await registry.load(testDir);

            // Assert
            expect(data.version).toBe('1.0.0');
            expect(data.mockups).toEqual([]);
            expect(data.totalCost).toBe(0);
            expect(data.lastUpdated).toBeDefined();
        });

        it('should load existing registry from file', async () => {
            // Arrange
            const existingRegistry: Registry = {
                version: '1.0.0',
                mockups: [
                    {
                        id: 'test-1',
                        filename: 'login-2025-11-04.png',
                        prompt: 'Login screen',
                        generatedAt: '2025-11-04T00:00:00Z',
                        cost: 0.003,
                        model: 'flux-schnell',
                        dimensions: { width: 1024, height: 768 },
                        references: ['PDR.md']
                    }
                ],
                totalCost: 0.003,
                lastUpdated: '2025-11-04T00:00:00Z'
            };

            await fs.mkdir(path.join(testDir, 'mockups'), { recursive: true });
            await fs.writeFile(
                path.join(testDir, 'mockups', '.registry.json'),
                JSON.stringify(existingRegistry, null, 2)
            );

            // Act
            const data = await registry.load(testDir);

            // Assert
            expect(data.mockups).toHaveLength(1);
            expect(data.mockups[0].filename).toBe('login-2025-11-04.png');
            expect(data.totalCost).toBe(0.003);
        });
    });

    describe('save', () => {
        it('should save registry to file with proper formatting', async () => {
            // Arrange
            const data: Registry = {
                version: '1.0.0',
                mockups: [],
                totalCost: 0,
                lastUpdated: new Date().toISOString()
            };

            // Act
            await registry.save(data, testDir);

            // Assert
            const savedContent = await fs.readFile(
                path.join(testDir, 'mockups', '.registry.json'),
                'utf-8'
            );

            const savedData = JSON.parse(savedContent);
            expect(savedData.version).toBe('1.0.0');
            expect(savedData.mockups).toEqual([]);

            // Check formatting (2-space indentation)
            expect(savedContent).toContain('  "version"');
        });

        it('should overwrite existing registry file', async () => {
            // Arrange
            const initialData: Registry = {
                version: '1.0.0',
                mockups: [],
                totalCost: 0,
                lastUpdated: '2025-11-04T00:00:00Z'
            };

            await registry.save(initialData, testDir);

            const updatedData: Registry = {
                version: '1.0.0',
                mockups: [
                    {
                        id: 'test-1',
                        filename: 'new.png',
                        prompt: 'New',
                        generatedAt: '2025-11-04T01:00:00Z',
                        cost: 0.003,
                        model: 'flux-schnell',
                        dimensions: { width: 1024, height: 768 },
                        references: []
                    }
                ],
                totalCost: 0.003,
                lastUpdated: '2025-11-04T01:00:00Z'
            };

            // Act
            await registry.save(updatedData, testDir);

            // Assert
            const data = await registry.load(testDir);
            expect(data.mockups).toHaveLength(1);
            expect(data.totalCost).toBe(0.003);
        });
    });

    describe('addMockup', () => {
        it('should add mockup to empty registry', async () => {
            // Arrange
            const mockup: Omit<MockupMetadata, 'id'> = {
                filename: 'dashboard-2025-11-04.png',
                prompt: 'Dashboard wireframe',
                generatedAt: '2025-11-04T01:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: []
            };

            // Act
            await registry.addMockup(mockup, testDir);

            // Assert
            const data = await registry.load(testDir);
            expect(data.mockups).toHaveLength(1);
            expect(data.mockups[0].filename).toBe('dashboard-2025-11-04.png');
            expect(data.mockups[0].id).toBeDefined();
            expect(data.totalCost).toBe(0.003);
        });

        it('should append mockup to existing registry', async () => {
            // Arrange
            const firstMockup: Omit<MockupMetadata, 'id'> = {
                filename: 'first.png',
                prompt: 'First',
                generatedAt: '2025-11-04T00:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: []
            };

            await registry.addMockup(firstMockup, testDir);

            const secondMockup: Omit<MockupMetadata, 'id'> = {
                filename: 'second.png',
                prompt: 'Second',
                generatedAt: '2025-11-04T01:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 375, height: 812 },
                references: []
            };

            // Act
            await registry.addMockup(secondMockup, testDir);

            // Assert
            const data = await registry.load(testDir);
            expect(data.mockups).toHaveLength(2);
            expect(data.totalCost).toBe(0.006);
        });

        it('should generate unique IDs for each mockup', async () => {
            // Arrange
            const mockup1: Omit<MockupMetadata, 'id'> = {
                filename: 'mockup1.png',
                prompt: 'Test 1',
                generatedAt: '2025-11-04T00:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: []
            };

            const mockup2: Omit<MockupMetadata, 'id'> = {
                filename: 'mockup2.png',
                prompt: 'Test 2',
                generatedAt: '2025-11-04T00:00:01Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: []
            };

            // Act
            await registry.addMockup(mockup1, testDir);
            await registry.addMockup(mockup2, testDir);

            // Assert
            const data = await registry.load(testDir);
            expect(data.mockups[0].id).not.toBe(data.mockups[1].id);
        });

        it('should update lastUpdated timestamp', async () => {
            // Arrange
            const mockup: Omit<MockupMetadata, 'id'> = {
                filename: 'test.png',
                prompt: 'Test',
                generatedAt: '2025-11-04T00:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: []
            };

            const before = new Date().toISOString();

            // Act
            await registry.addMockup(mockup, testDir);

            // Assert
            const data = await registry.load(testDir);
            expect(data.lastUpdated).toBeDefined();
            expect(new Date(data.lastUpdated).getTime()).toBeGreaterThanOrEqual(
                new Date(before).getTime()
            );
        });
    });

    describe('updateReferences', () => {
        it('should add reference to mockup', async () => {
            // Arrange
            const mockup: Omit<MockupMetadata, 'id'> = {
                filename: 'test.png',
                prompt: 'Test',
                generatedAt: '2025-11-04T00:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: []
            };

            await registry.addMockup(mockup, testDir);
            const data = await registry.load(testDir);
            const mockupId = data.mockups[0].id;

            // Act
            await registry.updateReferences(mockupId, 'PDR.md', testDir);

            // Assert
            const updated = await registry.load(testDir);
            expect(updated.mockups[0].references).toContain('PDR.md');
        });

        it('should not duplicate references', async () => {
            // Arrange
            const mockup: Omit<MockupMetadata, 'id'> = {
                filename: 'test.png',
                prompt: 'Test',
                generatedAt: '2025-11-04T00:00:00Z',
                cost: 0.003,
                model: 'flux-schnell',
                dimensions: { width: 1024, height: 768 },
                references: ['PDR.md']
            };

            await registry.addMockup(mockup, testDir);
            const data = await registry.load(testDir);
            const mockupId = data.mockups[0].id;

            // Act
            await registry.updateReferences(mockupId, 'PDR.md', testDir);

            // Assert
            const updated = await registry.load(testDir);
            expect(updated.mockups[0].references.filter((r) => r === 'PDR.md')).toHaveLength(1);
        });

        it('should handle non-existent mockup ID gracefully', async () => {
            // Arrange
            const nonExistentId = 'non-existent-id';

            // Act & Assert
            await expect(
                registry.updateReferences(nonExistentId, 'PDR.md', testDir)
            ).resolves.toBeUndefined();

            // Registry should still be valid
            const data = await registry.load(testDir);
            expect(data.mockups).toEqual([]);
        });
    });
});
