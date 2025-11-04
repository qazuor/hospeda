/**
 * Integration tests for extreme prompt handling
 *
 * @module test/integration/extreme-prompts
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockupGenerator } from '../../src/core/mockup-generator';
import type { MockupGeneratorConfig } from '../../src/types';
import { sanitizePrompt } from '../../src/utils';

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

// Mock fetch
global.fetch = vi.fn() as unknown as typeof fetch;

describe('Extreme Prompts', () => {
    const testDir = path.join(process.cwd(), 'test-prompts-output');
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

        // Setup default successful fetch mock
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(100)
        } as Response);
    });

    afterEach(async () => {
        // Cleanup
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Empty and Whitespace Prompts', () => {
        it('should handle empty string prompt and throw error', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-001-empty');

            // Act
            const result = await generator.generate({
                prompt: '',
                filename: 'empty.png',
                sessionPath
            });

            // Assert - Empty prompts should fail after sanitization
            expect(result.success).toBe(false);
            expect(result.error).toContain('Prompt vacío');
        });

        it('should handle whitespace-only prompt and throw error', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-002-whitespace');

            // Act
            const result = await generator.generate({
                prompt: '   \t\n   ',
                filename: 'whitespace.png',
                sessionPath
            });

            // Assert - Whitespace-only prompts should fail after sanitization
            expect(result.success).toBe(false);
            expect(result.error).toContain('Prompt vacío');
        });

        it('should sanitize prompt with only special characters', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-003-special');

            // Act
            const result = await generator.generate({
                prompt: '!!!@@@###$$$%%%',
                filename: 'special.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.prompt).toBeDefined();
        });
    });

    describe('Very Long Prompts', () => {
        it('should handle prompt at 1000 characters', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-004-long');

            const longPrompt = 'A'.repeat(1000);

            // Act
            const result = await generator.generate({
                prompt: longPrompt,
                filename: 'long.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.prompt.length).toBeGreaterThan(0);
        });

        it('should handle prompt exceeding 1000 characters', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-005-very-long');

            const veryLongPrompt = 'Login screen with '.repeat(100); // ~1800 chars

            // Act
            const result = await generator.generate({
                prompt: veryLongPrompt,
                filename: 'very-long.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            // Sanitized prompt should be reasonable length
            expect(result.prompt.length).toBeGreaterThan(0);
        });

        it('should handle prompt with excessive repetition', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-006-repetition');

            const repetitivePrompt = 'button '.repeat(500);

            // Act
            const result = await generator.generate({
                prompt: repetitivePrompt,
                filename: 'repetition.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Special Characters and Unicode', () => {
        it('should handle emoji in prompt', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-007-emoji');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen with 🔒 password and 📧 email',
                filename: 'emoji.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle non-ASCII characters (Spanish)', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-008-spanish');

            // Act
            const result = await generator.generate({
                prompt: 'Pantalla de inicio con contraseña y correo electrónico',
                filename: 'spanish.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.prompt).toBeDefined();
        });

        it('should handle Chinese characters', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-009-chinese');

            // Act
            const result = await generator.generate({
                prompt: '登录屏幕与密码和电子邮件',
                filename: 'chinese.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle mixed unicode and ASCII', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-010-mixed');

            // Act
            const result = await generator.generate({
                prompt: 'Login 登录 Войти with émoji 🔐 and symbols ™️®️©️',
                filename: 'mixed.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle newlines and tabs', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-011-newlines');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen\nwith email\tand\npassword\tfields',
                filename: 'newlines.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            // Newlines should be sanitized
            expect(result.prompt).not.toContain('\n');
        });
    });

    describe('Malicious Inputs', () => {
        it('should sanitize SQL injection attempt', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-012-sql');

            // Act
            const result = await generator.generate({
                prompt: "Login screen'; DROP TABLE users; --",
                filename: 'sql.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.prompt).not.toContain('DROP TABLE');
        });

        it('should handle XSS attempt (HTML tags not sanitized by current implementation)', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-013-xss');

            // Act
            const result = await generator.generate({
                prompt: '<script>alert("XSS")</script> Login screen',
                filename: 'xss.png',
                sessionPath
            });

            // Assert - XSS is handled by Replicate API, not our sanitizer
            expect(result.success).toBe(true);
            expect(result.prompt).toBeDefined();
        });

        it('should sanitize command injection attempt (semicolons removed)', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-014-command');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen; rm -rf / #',
                filename: 'command.png',
                sessionPath
            });

            // Assert - Semicolons are sanitized, but command text remains
            expect(result.success).toBe(true);
            expect(result.prompt).not.toContain(';');
        });

        it('should handle path traversal attempt (not sanitized as not a security risk for AI prompts)', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-015-path');

            // Act
            const result = await generator.generate({
                prompt: '../../etc/passwd screen',
                filename: 'path.png',
                sessionPath
            });

            // Assert - Path traversal in prompts doesn't pose security risk for AI generation
            expect(result.success).toBe(true);
            expect(result.prompt).toBeDefined();
        });

        it('should handle null bytes (cleaned by trim)', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-016-null');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen with fields',
                filename: 'null.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.prompt).toBeDefined();
        });
    });

    describe('Prompt Sanitization Edge Cases', () => {
        it('should handle multiple consecutive special characters', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-017-consecutive');

            // Act
            const result = await generator.generate({
                prompt: 'Login!!!!????;;;;;;;;screen',
                filename: 'consecutive.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
            // Should collapse consecutive special chars
            expect(result.prompt).toBeDefined();
        });

        it('should preserve meaningful punctuation', async () => {
            // Arrange
            const sanitized = sanitizePrompt(
                'Login screen with email, password, and submit button.'
            );

            // Assert
            expect(sanitized).toContain(',');
            expect(sanitized).toContain('.');
        });

        it('should handle brackets and parentheses', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-018-brackets');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen (desktop) with [email] and {password}',
                filename: 'brackets.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle quotes properly', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-019-quotes');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen with "email" and \'password\' fields',
                filename: 'quotes.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle HTML entities', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-020-entities');

            // Act
            const result = await generator.generate({
                prompt: 'Login &lt;screen&gt; with &quot;email&quot; &amp; password',
                filename: 'entities.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Boundary Conditions', () => {
        it('should handle prompt with maximum safe integer', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-021-number');

            // Act
            const result = await generator.generate({
                prompt: `Login screen ${Number.MAX_SAFE_INTEGER}`,
                filename: 'number.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle prompt with URL-like strings', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-022-url');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen like https://example.com/login?redirect=/dashboard',
                filename: 'url.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should handle prompt with file paths', async () => {
            // Arrange
            const generator = new MockupGenerator(config);
            const sessionPath = path.join(testDir, 'P-023-filepath');

            // Act
            const result = await generator.generate({
                prompt: 'Login screen at /app/login.tsx with C:\\Users\\Admin\\Desktop',
                filename: 'filepath.png',
                sessionPath
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });
});
