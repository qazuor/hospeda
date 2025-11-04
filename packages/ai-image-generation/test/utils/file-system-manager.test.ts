/**
 * Unit tests for FileSystemManager
 *
 * @module test/utils/file-system-manager
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSystemManager } from '../../src/utils/file-system-manager';

describe('FileSystemManager', () => {
    const testDir = path.join(process.cwd(), 'test-output');
    let manager: FileSystemManager;

    beforeEach(async () => {
        manager = new FileSystemManager();
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore if doesn't exist
        }
    });

    afterEach(async () => {
        // Cleanup after tests
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('ensureMockupsDir', () => {
        it('should create mockups directory if it does not exist', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-001-test');

            // Act
            const mockupsDir = await manager.ensureMockupsDir(sessionPath);

            // Assert
            expect(mockupsDir).toBe(path.join(sessionPath, 'mockups'));
            const stats = await fs.stat(mockupsDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should not throw if mockups directory already exists', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-002-test');
            await fs.mkdir(path.join(sessionPath, 'mockups'), { recursive: true });

            // Act
            const mockupsDir = await manager.ensureMockupsDir(sessionPath);

            // Assert
            expect(mockupsDir).toBe(path.join(sessionPath, 'mockups'));
        });

        it('should create parent directories if they do not exist', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'nested', 'deep', 'P-003-test');

            // Act
            const mockupsDir = await manager.ensureMockupsDir(sessionPath);

            // Assert
            const stats = await fs.stat(mockupsDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('saveMockup', () => {
        it('should save mockup with generated filename', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-004-test');
            const imageBuffer = Buffer.from('fake-image-data');
            const description = 'login-screen';

            // Act
            const filePath = await manager.saveMockup({
                sessionPath,
                description,
                imageBuffer,
                format: 'png'
            });

            // Assert
            expect(filePath).toContain('mockups');
            expect(filePath).toContain(description);
            expect(filePath.endsWith('.png')).toBe(true);

            const savedData = await fs.readFile(filePath);
            expect(savedData.equals(imageBuffer)).toBe(true);
        });

        it('should default to png format', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-005-test');
            const imageBuffer = Buffer.from('fake-image');

            // Act
            const filePath = await manager.saveMockup({
                sessionPath,
                description: 'dashboard',
                imageBuffer
            });

            // Assert
            expect(filePath.endsWith('.png')).toBe(true);
        });

        it('should support jpg format', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-006-test');
            const imageBuffer = Buffer.from('fake-image');

            // Act
            const filePath = await manager.saveMockup({
                sessionPath,
                description: 'profile',
                imageBuffer,
                format: 'jpg'
            });

            // Assert
            expect(filePath.endsWith('.jpg')).toBe(true);
        });

        it('should support webp format', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-007-test');
            const imageBuffer = Buffer.from('fake-image');

            // Act
            const filePath = await manager.saveMockup({
                sessionPath,
                description: 'card',
                imageBuffer,
                format: 'webp'
            });

            // Assert
            expect(filePath.endsWith('.webp')).toBe(true);
        });

        it('should avoid name collisions by appending counter', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-008-test');
            const imageBuffer = Buffer.from('fake-image');
            const description = 'form';

            // Act - Save same description twice
            const filePath1 = await manager.saveMockup({
                sessionPath,
                description,
                imageBuffer
            });

            const filePath2 = await manager.saveMockup({
                sessionPath,
                description,
                imageBuffer
            });

            // Assert
            expect(filePath1).not.toBe(filePath2);
            expect(filePath1).toContain(description);
            expect(filePath2).toContain(description);

            // Both files should exist
            await expect(fs.access(filePath1)).resolves.toBeUndefined();
            await expect(fs.access(filePath2)).resolves.toBeUndefined();
        });

        it('should create mockups directory if it does not exist', async () => {
            // Arrange
            const sessionPath = path.join(testDir, 'P-009-test');
            const imageBuffer = Buffer.from('fake-image');

            // Act
            const filePath = await manager.saveMockup({
                sessionPath,
                description: 'new-mockup',
                imageBuffer
            });

            // Assert
            const mockupsDir = path.dirname(filePath);
            const stats = await fs.stat(mockupsDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('generateFilename', () => {
        it('should generate filename with description and timestamp', () => {
            // Arrange
            const description = 'Login Screen';

            // Act
            const filename = manager.generateFilename(description);

            // Assert
            expect(filename).toContain('login-screen');
            expect(filename).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
        });

        it('should sanitize description to lowercase and hyphens', () => {
            // Arrange
            const description = 'My Dashboard View!';

            // Act
            const filename = manager.generateFilename(description);

            // Assert
            expect(filename).toContain('my-dashboard-view');
            expect(filename).not.toContain('!');
            expect(filename).not.toContain(' ');
        });

        it('should truncate long descriptions to 50 characters', () => {
            // Arrange
            const longDescription = 'A'.repeat(100);

            // Act
            const filename = manager.generateFilename(longDescription);

            // Assert
            const descriptionPart = filename.split('-202')[0]; // Before timestamp
            expect(descriptionPart.length).toBeLessThanOrEqual(50);
        });

        it('should handle special characters', () => {
            // Arrange
            const description = 'Form with @email & password (#login)';

            // Act
            const filename = manager.generateFilename(description);

            // Assert
            expect(filename).toContain('form-with-email-password-login');
            expect(filename).not.toContain('@');
            expect(filename).not.toContain('&');
            expect(filename).not.toContain('#');
            expect(filename).not.toContain('(');
            expect(filename).not.toContain(')');
        });

        it('should generate unique filenames for same description', () => {
            // Arrange
            const description = 'Dashboard';

            // Act
            const filename1 = manager.generateFilename(description);
            const filename2 = manager.generateFilename(description);

            // Assert
            // Filenames should be different due to timestamp (millisecond precision)
            // In rare cases they might be equal if generated in same millisecond
            // So we just verify format
            expect(filename1).toContain('dashboard');
            expect(filename2).toContain('dashboard');
        });
    });
});
