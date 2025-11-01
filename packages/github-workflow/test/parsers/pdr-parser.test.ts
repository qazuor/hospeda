/**
 * Tests for PDR parser
 *
 * @module test/parsers/pdr-parser
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePDR } from '../../src/parsers/pdr-parser';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/planning-sessions');

describe('PDRParser', () => {
    describe('parsePDR', () => {
        it('should extract planning code from session path', async () => {
            // Arrange
            const sessionPath = path.join(FIXTURES_DIR, 'P-003-valid');

            // Act
            const metadata = await parsePDR(sessionPath);

            // Assert
            expect(metadata.planningCode).toBe('P-003');
        });

        it('should extract feature name from PDR title', async () => {
            // Arrange
            const sessionPath = path.join(FIXTURES_DIR, 'P-003-valid');

            // Act
            const metadata = await parsePDR(sessionPath);

            // Assert
            expect(metadata.featureName).toContain('GitHub');
            expect(metadata.featureName).toContain('Synchronization');
        });

        it('should extract summary from Executive Summary section', async () => {
            // Arrange
            const sessionPath = path.join(FIXTURES_DIR, 'P-003-valid');

            // Act
            const metadata = await parsePDR(sessionPath);

            // Assert
            expect(metadata.summary).toBeTruthy();
            expect(metadata.summary.length).toBeGreaterThan(50);
        });

        it('should handle missing PDR.md file', async () => {
            // Arrange
            const sessionPath = path.join(FIXTURES_DIR, 'non-existent');

            // Act & Assert
            await expect(parsePDR(sessionPath)).rejects.toThrow();
        });

        it('should throw error for invalid session path format', async () => {
            // Arrange
            const sessionPath = '/invalid/path/without-planning-code';

            // Act & Assert
            await expect(parsePDR(sessionPath)).rejects.toThrow('Invalid planning session path');
        });

        it('should throw error for PDR without level-1 heading', async () => {
            // Arrange
            const sessionPath = path.join(FIXTURES_DIR, 'P-888-invalid');

            // Act & Assert
            await expect(parsePDR(sessionPath)).rejects.toThrow('Feature name not found in PDR');
        });

        it('should return empty summary if Executive Summary section missing', async () => {
            // Arrange
            const sessionPath = path.join(FIXTURES_DIR, 'P-777-no-summary');

            // Act
            const metadata = await parsePDR(sessionPath);

            // Assert
            expect(metadata.summary).toBe('');
        });
    });
});
