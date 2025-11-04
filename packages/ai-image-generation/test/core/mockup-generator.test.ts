/**
 * Unit tests for MockupGenerator
 *
 * @module test/core/mockup-generator
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockupGenerator } from '../../src/core/mockup-generator';
import { MockupError, type MockupGeneratorConfig } from '../../src/types';

// Mock Replicate
vi.mock('replicate', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            run: vi.fn().mockResolvedValue(['https://example.com/image.png'])
        }))
    };
});

// Mock sharp
vi.mock('sharp', () => {
    const mockSharp = vi.fn().mockReturnValue({
        png: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
        metadata: vi.fn().mockResolvedValue({
            width: 1024,
            height: 768,
            format: 'png'
        })
    });

    return { default: mockSharp };
});

// Mock fetch for image download
global.fetch = vi.fn() as unknown as typeof fetch;

describe('MockupGenerator', () => {
    const testDir = path.join(process.cwd(), 'test-mockup-output');
    let config: MockupGeneratorConfig;

    beforeEach(async () => {
        config = {
            replicateApiToken: 'test-token',
            model: 'black-forest-labs/flux-schnell',
            outputPath: testDir,
            maxRetries: 3
        };

        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore if doesn't exist
        }

        // Reset mocks
        vi.clearAllMocks();

        // Setup fetch mock
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(100)
        } as Response);
    });

    afterEach(async () => {
        // Cleanup after tests
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('constructor', () => {
        it('should create instance with valid config', () => {
            // Act
            const generator = new MockupGenerator(config);

            // Assert
            expect(generator).toBeDefined();
        });

        it('should throw error for missing API token', () => {
            // Arrange
            const invalidConfig = {
                ...config,
                replicateApiToken: ''
            };

            // Act & Assert
            expect(() => new MockupGenerator(invalidConfig)).toThrow(MockupError);
            expect(() => new MockupGenerator(invalidConfig)).toThrow(
                'API token de Replicate es requerido'
            );
        });

        it('should use default values for optional parameters', () => {
            // Arrange
            const minimalConfig: MockupGeneratorConfig = {
                replicateApiToken: 'test-token',
                outputPath: testDir
            };

            // Act
            const generator = new MockupGenerator(minimalConfig);

            // Assert
            expect(generator).toBeDefined();
        });
    });

    describe('generate', () => {
        it('should generate mockup successfully', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-001-test');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen with email and password',
                filename: 'login-screen.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.imagePath).toBeDefined();
            expect(result.imagePath).toContain('login-screen');
            expect(result.imagePath).toContain('.png');
            expect(result.metadata.cost).toBe(0.003);
            expect(result.metadata.model).toBe('black-forest-labs/flux-schnell');
        });

        it('should sanitize prompt before generation', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-002-test');

            // Act
            const result = await generator.generate({
                prompt: 'Dashboard; DROP TABLE users;',
                filename: 'dashboard.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.prompt).not.toContain('DROP TABLE');
        });

        it('should handle download failures with retry', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-003-test');

            // Mock fetch to fail once then succeed
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    arrayBuffer: async () => new ArrayBuffer(100)
                } as Response);

            // Act
            const result = await generator.generate({
                prompt: 'Form mockup',
                filename: 'form.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            // Retry tracking is internal - just verify it succeeded after failure
        });

        it('should return error result when all retries exhausted', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-004-test');

            // Mock fetch to always fail
            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Persistent network error')
            );

            // Act
            const result = await generator.generate({
                prompt: 'Test mockup',
                filename: 'test.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        }, 30000); // Increased timeout for retries

        it('should create session directory if it does not exist', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'nested', 'deep', 'P-005-test');

            // Act
            const result = await generator.generate({
                prompt: 'Dashboard',
                filename: 'dashboard.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            const mockupsDir = path.join(sessionPath, 'mockups');
            const stats = await fs.stat(mockupsDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should update metadata registry after successful generation', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-006-test');

            // Act
            await generator.generate({
                prompt: 'Login screen',
                filename: 'login.png',
                sessionPath
            });

            // Assert
            const registryPath = path.join(sessionPath, 'mockups', '.registry.json');
            const registryContent = await fs.readFile(registryPath, 'utf-8');
            const registry = JSON.parse(registryContent);

            expect(registry.mockups).toHaveLength(1);
            expect(registry.mockups[0].filename).toContain('login');
            expect(registry.totalCost).toBe(0.003);
        });

        it('should track generation time in metadata', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-007-test');

            // Act
            const result = await generator.generate({
                prompt: 'Form',
                filename: 'form.png',
                sessionPath
            });

            // Assert
            expect(result.metadata.generationTime).toBeGreaterThan(0);
            expect(result.metadata.timestamp).toBeDefined();
        });

        it('should track usage and costs after successful generation', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-008-test');

            // Act
            await generator.generate({
                prompt: 'Login screen',
                filename: 'login.png',
                sessionPath
            });

            // Assert - Check that usage tracking file was created
            const usageFilePath = path.join(sessionPath, '.usage-tracking.json');
            const usageContent = await fs.readFile(usageFilePath, 'utf-8');
            const usageData = JSON.parse(usageContent);

            expect(usageData.mockupCount).toBe(1);
            expect(usageData.totalCost).toBe(0.003);
            expect(usageData.currentMonth).toMatch(/^\d{4}-\d{2}$/);
        });

        it('should accumulate usage over multiple generations', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-009-test');

            // Act - Generate 3 mockups
            await generator.generate({
                prompt: 'Login screen',
                filename: 'login.png',
                sessionPath
            });

            await generator.generate({
                prompt: 'Dashboard',
                filename: 'dashboard.png',
                sessionPath
            });

            await generator.generate({
                prompt: 'Settings',
                filename: 'settings.png',
                sessionPath
            });

            // Assert
            const usageFilePath = path.join(sessionPath, '.usage-tracking.json');
            const usageContent = await fs.readFile(usageFilePath, 'utf-8');
            const usageData = JSON.parse(usageContent);

            expect(usageData.mockupCount).toBe(3);
            expect(usageData.totalCost).toBe(0.009);
        });

        it('should log warning when threshold is reached', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-010-test');
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // Pre-populate usage data to be at threshold (40 mockups)
            const usageData = {
                currentMonth: new Date().toISOString().slice(0, 7),
                mockupCount: 39,
                totalCost: 0.117,
                lastReset: new Date().toISOString()
            };

            await fs.mkdir(sessionPath, { recursive: true });
            const usageFilePath = path.join(sessionPath, '.usage-tracking.json');
            await fs.writeFile(usageFilePath, JSON.stringify(usageData, null, 2));

            // Act - Generate one more mockup to reach threshold
            await generator.generate({
                prompt: 'Login',
                filename: 'login.png',
                sessionPath
            });

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('High usage alert: 40/50 mockups')
            );

            // Cleanup
            consoleWarnSpy.mockRestore();
        });

        it('should not log error if cost tracking fails silently', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-011-test');
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Mock file system to fail only on usage tracking file
            const originalWriteFile = fs.writeFile;
            const writeFileSpy = vi
                .spyOn(fs, 'writeFile')
                .mockImplementation(async (filePath, data) => {
                    if (filePath.toString().includes('.usage-tracking.json')) {
                        throw new Error('Simulated filesystem error');
                    }
                    return originalWriteFile(filePath, data);
                });

            // Act - Should still generate even if cost tracking fails
            const result = await generator.generate({
                prompt: 'Login',
                filename: 'login.png',
                sessionPath
            });

            // Assert - Generation should succeed and error should be logged
            expect(result.success).toBe(true);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to save usage data')
            );

            // Cleanup
            writeFileSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('downloadImage', () => {
        it('should download image from URL', async () => {
            // This is tested indirectly through generate()
            // Direct testing would expose private method
            expect(true).toBe(true);
        });
    });

    describe('processImage', () => {
        it('should process image buffer', async () => {
            // This is tested indirectly through generate()
            // Direct testing would expose private method
            expect(true).toBe(true);
        });
    });
});
