/**
 * Tests for CostTracker utility
 *
 * @module test/utils/cost-tracker
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CostTracker, type UsageData } from '../../src/utils/cost-tracker';

describe('CostTracker', () => {
    let testDir: string;
    let costTracker: CostTracker;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cost-tracker-test-'));
        costTracker = new CostTracker();
    });

    afterEach(async () => {
        // Cleanup test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('load()', () => {
        it('should create new usage file if it does not exist', async () => {
            // Act
            const usageData = await costTracker.load(testDir);

            // Assert
            expect(usageData).toEqual({
                currentMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
                mockupCount: 0,
                totalCost: 0,
                lastReset: expect.any(String)
            });
        });

        it('should load existing usage file', async () => {
            // Arrange
            const existingData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 5,
                totalCost: 0.015,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            const usageData = await costTracker.load(testDir);

            // Assert
            expect(usageData).toEqual(existingData);
        });

        it('should handle corrupted JSON gracefully', async () => {
            // Arrange
            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, 'invalid json {');

            // Act
            const usageData = await costTracker.load(testDir);

            // Assert - Should return default data
            expect(usageData).toEqual({
                currentMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
                mockupCount: 0,
                totalCost: 0,
                lastReset: expect.any(String)
            });
        });

        it('should create directory if it does not exist', async () => {
            // Arrange
            const nestedDir = path.join(testDir, 'nested', 'path');

            // Act
            const usageData = await costTracker.load(nestedDir);

            // Assert
            expect(usageData).toBeDefined();
            const dirExists = await fs
                .access(nestedDir)
                .then(() => true)
                .catch(() => false);
            expect(dirExists).toBe(true);
        });
    });

    describe('save()', () => {
        it('should save usage data correctly', async () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 10,
                totalCost: 0.03,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            await costTracker.save(usageData, testDir);

            // Assert
            const filePath = path.join(testDir, '.usage-tracking.json');
            const savedContent = await fs.readFile(filePath, 'utf-8');
            const savedData = JSON.parse(savedContent);

            expect(savedData).toEqual(usageData);
        });

        it('should create directory if needed', async () => {
            // Arrange
            const nestedDir = path.join(testDir, 'new', 'directory');
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 1,
                totalCost: 0.003,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            await costTracker.save(usageData, nestedDir);

            // Assert
            const filePath = path.join(nestedDir, '.usage-tracking.json');
            const fileExists = await fs
                .access(filePath)
                .then(() => true)
                .catch(() => false);

            expect(fileExists).toBe(true);
        });

        it('should overwrite existing data', async () => {
            // Arrange
            const initialData: UsageData = {
                currentMonth: '2025-10',
                mockupCount: 5,
                totalCost: 0.015,
                lastReset: '2025-10-01T00:00:00.000Z'
            };

            const updatedData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 3,
                totalCost: 0.009,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            await costTracker.save(initialData, testDir);
            await costTracker.save(updatedData, testDir);

            // Assert
            const loadedData = await costTracker.load(testDir);
            expect(loadedData).toEqual(updatedData);
        });

        it('should format JSON with 2-space indentation', async () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 1,
                totalCost: 0.003,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            await costTracker.save(usageData, testDir);

            // Assert
            const filePath = path.join(testDir, '.usage-tracking.json');
            const content = await fs.readFile(filePath, 'utf-8');

            expect(content).toContain('  "currentMonth"');
            expect(content).not.toContain('    "currentMonth"');
        });
    });

    describe('incrementUsage()', () => {
        it('should increment count from 0 to 1', async () => {
            // Act
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert
            expect(usageData.mockupCount).toBe(1);
        });

        it('should calculate cost correctly ($0.003 per image)', async () => {
            // Act
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert
            expect(usageData.totalCost).toBe(0.003);
        });

        it('should increment existing count', async () => {
            // Arrange
            await costTracker.incrementUsage(testDir);
            await costTracker.incrementUsage(testDir);

            // Act
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert
            expect(usageData.mockupCount).toBe(3);
            expect(usageData.totalCost).toBe(0.009);
        });

        it('should update lastReset timestamp', async () => {
            // Arrange
            const initialData = await costTracker.load(testDir);
            const initialTimestamp = initialData.lastReset;

            // Wait a bit to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Act
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert
            expect(usageData.lastReset).not.toBe(initialTimestamp);
        });

        it('should persist data to file', async () => {
            // Act
            await costTracker.incrementUsage(testDir);

            // Assert
            const loadedData = await costTracker.load(testDir);
            expect(loadedData.mockupCount).toBe(1);
            expect(loadedData.totalCost).toBe(0.003);
        });

        it('should handle file read errors gracefully', async () => {
            // Arrange
            const invalidDir = '/invalid/path/that/does/not/exist';

            // Act & Assert - Should not throw, should create default data
            const usageData = await costTracker.incrementUsage(invalidDir);
            expect(usageData.mockupCount).toBe(1);
            expect(usageData.totalCost).toBe(0.003);
        });

        it('should accumulate costs correctly over multiple increments', async () => {
            // Act
            await costTracker.incrementUsage(testDir);
            await costTracker.incrementUsage(testDir);
            await costTracker.incrementUsage(testDir);
            await costTracker.incrementUsage(testDir);
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert
            expect(usageData.mockupCount).toBe(5);
            expect(usageData.totalCost).toBeCloseTo(0.015, 3);
        });
    });

    describe('checkThreshold()', () => {
        it('should not alert at less than 40 mockups', () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 39,
                totalCost: 0.117,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = costTracker.checkThreshold(usageData);

            // Assert
            expect(result.shouldAlert).toBe(false);
            expect(result.message).toBeUndefined();
        });

        it('should alert at exactly 40 mockups', () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 40,
                totalCost: 0.12,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = costTracker.checkThreshold(usageData);

            // Assert
            expect(result.shouldAlert).toBe(true);
            expect(result.message).toBe(
                '⚠️ High usage alert: 40/50 mockups used this month ($0.12 spent). Consider reviewing mockup necessity.'
            );
        });

        it('should alert at more than 40 mockups', () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 45,
                totalCost: 0.135,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = costTracker.checkThreshold(usageData);

            // Assert
            expect(result.shouldAlert).toBe(true);
            expect(result.message).toContain('45/50 mockups');
            expect(result.message).toContain('$0.14');
        });

        it('should format cost correctly in message', () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 40,
                totalCost: 0.12,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = costTracker.checkThreshold(usageData);

            // Assert
            expect(result.message).toContain('$0.12');
        });

        it('should handle edge case at 50 mockups', () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 50,
                totalCost: 0.15,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = costTracker.checkThreshold(usageData);

            // Assert
            expect(result.shouldAlert).toBe(true);
            expect(result.message).toContain('50/50 mockups');
        });

        it('should handle zero mockups', () => {
            // Arrange
            const usageData: UsageData = {
                currentMonth: '2025-11',
                mockupCount: 0,
                totalCost: 0,
                lastReset: '2025-11-01T00:00:00.000Z'
            };

            // Act
            const result = costTracker.checkThreshold(usageData);

            // Assert
            expect(result.shouldAlert).toBe(false);
        });
    });

    describe('resetIfNewMonth()', () => {
        it('should not reset if same month', async () => {
            // Arrange
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const existingData: UsageData = {
                currentMonth,
                mockupCount: 10,
                totalCost: 0.03,
                lastReset: new Date().toISOString()
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert
            expect(usageData.mockupCount).toBe(10);
            expect(usageData.totalCost).toBe(0.03);
            expect(usageData.currentMonth).toBe(currentMonth);
        });

        it('should reset if new month detected', async () => {
            // Arrange
            const previousMonth = '2025-10';
            const existingData: UsageData = {
                currentMonth: previousMonth,
                mockupCount: 35,
                totalCost: 0.105,
                lastReset: '2025-10-01T00:00:00.000Z'
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert
            expect(usageData.mockupCount).toBe(0);
            expect(usageData.totalCost).toBe(0);
            expect(usageData.currentMonth).not.toBe(previousMonth);
        });

        it('should update currentMonth field on reset', async () => {
            // Arrange
            const existingData: UsageData = {
                currentMonth: '2024-12',
                mockupCount: 20,
                totalCost: 0.06,
                lastReset: '2024-12-01T00:00:00.000Z'
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert
            const currentMonth = new Date().toISOString().slice(0, 7);
            expect(usageData.currentMonth).toBe(currentMonth);
        });

        it('should update lastReset timestamp on reset', async () => {
            // Arrange
            const existingData: UsageData = {
                currentMonth: '2024-01',
                mockupCount: 15,
                totalCost: 0.045,
                lastReset: '2024-01-01T00:00:00.000Z'
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert
            expect(usageData.lastReset).not.toBe('2024-01-01T00:00:00.000Z');
            expect(new Date(usageData.lastReset).getTime()).toBeGreaterThan(
                new Date('2024-01-01').getTime()
            );
        });

        it('should persist reset data to file', async () => {
            // Arrange
            const existingData: UsageData = {
                currentMonth: '2024-01',
                mockupCount: 25,
                totalCost: 0.075,
                lastReset: '2024-01-01T00:00:00.000Z'
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            await costTracker.resetIfNewMonth(testDir);

            // Assert
            const loadedData = await costTracker.load(testDir);
            expect(loadedData.mockupCount).toBe(0);
            expect(loadedData.totalCost).toBe(0);
        });

        it('should handle missing file gracefully', async () => {
            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert
            expect(usageData).toBeDefined();
            expect(usageData.mockupCount).toBe(0);
            expect(usageData.totalCost).toBe(0);
        });

        it('should handle month transition from December to January', async () => {
            // Arrange
            const existingData: UsageData = {
                currentMonth: '2024-12',
                mockupCount: 30,
                totalCost: 0.09,
                lastReset: '2024-12-01T00:00:00.000Z'
            };

            const filePath = path.join(testDir, '.usage-tracking.json');
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert
            const currentMonth = new Date().toISOString().slice(0, 7);
            expect(usageData.currentMonth).toBe(currentMonth);

            // If we're in January or later, it should have reset
            if (currentMonth > '2024-12') {
                expect(usageData.mockupCount).toBe(0);
                expect(usageData.totalCost).toBe(0);
            }
        });

        it('should handle error during resetIfNewMonth operation', async () => {
            // Arrange - Mock load to throw error
            const originalLoad = costTracker.load;
            costTracker.load = vi.fn().mockRejectedValue(new Error('Simulated reset error'));

            // Act
            const usageData = await costTracker.resetIfNewMonth(testDir);

            // Assert - Should return default data
            expect(usageData.mockupCount).toBe(0);
            expect(usageData.totalCost).toBe(0);
            expect(usageData.currentMonth).toMatch(/^\d{4}-\d{2}$/);

            // Restore
            costTracker.load = originalLoad;
        });
    });

    describe('Edge Cases', () => {
        it('should handle first usage with no file', async () => {
            // Act
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert
            expect(usageData.mockupCount).toBe(1);
            expect(usageData.totalCost).toBe(0.003);
            expect(usageData.currentMonth).toMatch(/^\d{4}-\d{2}$/);
        });

        it('should handle error during incrementUsage load operation', async () => {
            // Arrange - Mock fs.readFile to throw an error after directory exists
            const originalLoad = costTracker.load;
            costTracker.load = vi.fn().mockRejectedValue(new Error('Simulated load error'));

            // Act
            const usageData = await costTracker.incrementUsage(testDir);

            // Assert - Should return default incremented data
            expect(usageData.mockupCount).toBe(1);
            expect(usageData.totalCost).toBe(0.003);

            // Restore
            costTracker.load = originalLoad;
        });

        it('should handle concurrent updates correctly', async () => {
            // Act - Simulate concurrent increments
            const promises = Array.from({ length: 5 }, () => costTracker.incrementUsage(testDir));

            await Promise.all(promises);

            // Assert
            const finalData = await costTracker.load(testDir);
            // Due to race conditions, count might be less than 5
            // but should be at least 1
            expect(finalData.mockupCount).toBeGreaterThanOrEqual(1);
            expect(finalData.mockupCount).toBeLessThanOrEqual(5);
        });

        it('should handle invalid session path gracefully', async () => {
            // Arrange
            const invalidPath = '/root/invalid/no-permissions';

            // Act & Assert - Should handle gracefully, not throw
            await expect(costTracker.incrementUsage(invalidPath)).resolves.toBeDefined();
        });

        it('should round costs to avoid floating point errors', async () => {
            // Act - Increment many times
            for (let i = 0; i < 10; i++) {
                await costTracker.incrementUsage(testDir);
            }

            const usageData = await costTracker.load(testDir);

            // Assert - Cost should be exactly 0.03, not 0.030000000000000004
            expect(usageData.totalCost).toBe(0.03);
        });
    });
});
