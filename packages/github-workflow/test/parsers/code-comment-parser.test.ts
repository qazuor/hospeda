/**
 * Tests for code comment parser
 *
 * @module parsers/code-comment-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    parseCodeComments,
    scanCodeComments,
    extractCommentMetadata,
    generateCommentId,
} from '../../src/parsers/code-comment-parser.js';
import type {
    CodeComment,
    CommentType,
    CodeCommentScanOptions,
} from '../../src/parsers/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures', 'code-samples');

describe('generateCommentId', () => {
    it('should generate unique IDs for different comments', () => {
        // Arrange & Act
        const id1 = generateCommentId({
            filePath: 'file1.ts',
            lineNumber: 10,
            type: 'TODO',
        });
        const id2 = generateCommentId({
            filePath: 'file1.ts',
            lineNumber: 20,
            type: 'TODO',
        });
        const id3 = generateCommentId({
            filePath: 'file2.ts',
            lineNumber: 10,
            type: 'TODO',
        });

        // Assert
        expect(id1).not.toBe(id2);
        expect(id1).not.toBe(id3);
        expect(id2).not.toBe(id3);
    });

    it('should generate consistent IDs for same location', () => {
        // Arrange & Act
        const id1 = generateCommentId({
            filePath: 'file1.ts',
            lineNumber: 10,
            type: 'TODO',
        });
        const id2 = generateCommentId({
            filePath: 'file1.ts',
            lineNumber: 10,
            type: 'TODO',
        });

        // Assert
        expect(id1).toBe(id2);
    });
});

describe('extractCommentMetadata', () => {
    it('should extract simple TODO without metadata', () => {
        // Arrange
        const content = 'Simple todo comment';

        // Act
        const result = extractCommentMetadata({
            content,
            type: 'TODO',
        });

        // Assert
        expect(result.content).toBe('Simple todo comment');
        expect(result.priority).toBeUndefined();
        expect(result.assignee).toBeUndefined();
        expect(result.labels).toBeUndefined();
    });

    it('should extract priority from parentheses', () => {
        // Arrange
        const testCases = [
            { input: '(high): Fix this bug', expected: 'high' },
            { input: '(P1): Critical issue', expected: 'P1' },
            { input: '(medium): Refactor code', expected: 'medium' },
        ];

        for (const { input, expected } of testCases) {
            // Act
            const result = extractCommentMetadata({
                content: input,
                type: 'TODO',
            });

            // Assert
            expect(result.priority).toBe(expected);
        }
    });

    it('should extract assignee from @username', () => {
        // Arrange
        const content = '(@username): Assigned task';

        // Act
        const result = extractCommentMetadata({
            content,
            type: 'TODO',
        });

        // Assert
        expect(result.assignee).toBe('username');
        expect(result.content).toBe('Assigned task');
    });

    it('should extract labels from square brackets', () => {
        // Arrange
        const testCases = [
            {
                input: '[refactor]: Improve code structure',
                expected: ['refactor'],
            },
            {
                input: '[security][performance]: Optimize query',
                expected: ['security', 'performance'],
            },
        ];

        for (const { input, expected } of testCases) {
            // Act
            const result = extractCommentMetadata({
                content: input,
                type: 'TODO',
            });

            // Assert
            expect(result.labels).toEqual(expected);
        }
    });

    it('should extract combined metadata', () => {
        // Arrange
        const content = '(P1)[@security](@john): Fix vulnerability';

        // Act
        const result = extractCommentMetadata({
            content,
            type: 'TODO',
        });

        // Assert
        expect(result.priority).toBe('P1');
        expect(result.labels).toEqual(['security']);
        expect(result.assignee).toBe('john');
        expect(result.content).toBe('Fix vulnerability');
    });

    it('should handle empty metadata gracefully', () => {
        // Arrange
        const testCases = ['(): Empty priority', '[]: Empty label', '(@): Empty assignee'];

        for (const content of testCases) {
            // Act
            const result = extractCommentMetadata({
                content,
                type: 'TODO',
            });

            // Assert
            expect(result.priority).toBeUndefined();
            expect(result.labels).toBeUndefined();
            expect(result.assignee).toBeUndefined();
        }
    });

    it('should handle TODO without colon', () => {
        // Arrange
        const content = 'Fix this issue';

        // Act
        const result = extractCommentMetadata({
            content,
            type: 'TODO',
        });

        // Assert
        expect(result.content).toBe('Fix this issue');
    });
});

describe('parseCodeComments', () => {
    it('should parse single-line TODO comments', () => {
        // Arrange
        const fileContent = `
// TODO: Simple todo comment
export function test() {}
`;
        const filePath = 'test.ts';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(1);
        expect(comments[0]?.type).toBe('TODO');
        expect(comments[0]?.content).toBe('Simple todo comment');
        expect(comments[0]?.lineNumber).toBe(2);
    });

    it('should parse multiple comment types', () => {
        // Arrange
        const fileContent = `
// TODO: Todo comment
// HACK: Hack comment
// DEBUG: Debug comment
`;
        const filePath = 'test.ts';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(3);
        expect(comments.map((c) => c.type)).toEqual(['TODO', 'HACK', 'DEBUG']);
    });

    it('should parse multi-line comments', () => {
        // Arrange
        const fileContent = `
/*
 * TODO: Multi-line todo
 * with additional context
 */
`;
        const filePath = 'test.ts';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(1);
        expect(comments[0]?.type).toBe('TODO');
        expect(comments[0]?.content).toContain('Multi-line todo');
        expect(comments[0]?.content).toContain('with additional context');
    });

    it('should ignore TODOs in string literals', () => {
        // Arrange
        const fileContent = `
const str = "TODO: this is in a string";
// TODO: this is a real comment
const str2 = 'HACK: also in string';
`;
        const filePath = 'test.ts';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(1);
        expect(comments[0]?.content).toBe('this is a real comment');
    });

    it('should handle JSX/TSX comments', () => {
        // Arrange
        const fileContent = `
export function Component() {
    return (
        <div>
            {/* TODO: Add proper component */}
            <button>Click</button>
        </div>
    );
}
`;
        const filePath = 'test.tsx';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(1);
        expect(comments[0]?.type).toBe('TODO');
    });

    it('should parse comments with metadata', () => {
        // Arrange
        const fileContent = `
// TODO(high): High priority
// TODO(@user): Assigned
// TODO[label]: Labeled
// TODO(P1)[@security](@john): Complex
`;
        const filePath = 'test.ts';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(4);
        expect(comments[0]?.priority).toBe('high');
        expect(comments[1]?.assignee).toBe('user');
        expect(comments[2]?.labels).toEqual(['label']);
        expect(comments[3]?.priority).toBe('P1');
        expect(comments[3]?.labels).toEqual(['security']);
        expect(comments[3]?.assignee).toBe('john');
    });

    it('should handle empty file', () => {
        // Arrange
        const fileContent = '';
        const filePath = 'empty.ts';

        // Act
        const comments = parseCodeComments({ fileContent, filePath });

        // Assert
        expect(comments).toHaveLength(0);
    });

    it('should filter by comment types', () => {
        // Arrange
        const fileContent = `
// TODO: Todo comment
// HACK: Hack comment
// DEBUG: Debug comment
`;
        const filePath = 'test.ts';

        // Act
        const comments = parseCodeComments({
            fileContent,
            filePath,
            commentTypes: ['TODO', 'HACK'],
        });

        // Assert
        expect(comments).toHaveLength(2);
        expect(comments.map((c) => c.type)).toEqual(['TODO', 'HACK']);
    });
});

describe('scanCodeComments', () => {
    it('should scan directory for code comments', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: fixturesDir,
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        expect(result.filesScanned).toBeGreaterThan(0);
        expect(result.commentsFound).toBeGreaterThan(0);
        expect(result.comments.length).toBe(result.commentsFound);
    });

    it('should group comments by type', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: fixturesDir,
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        expect(result.byType.TODO).toBeDefined();
        expect(result.byType.HACK).toBeDefined();
        expect(result.byType.DEBUG).toBeDefined();
        expect(Array.isArray(result.byType.TODO)).toBe(true);
    });

    it('should group comments by file', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: fixturesDir,
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        const files = Object.keys(result.byFile);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            expect(Array.isArray(result.byFile[file])).toBe(true);
        }
    });

    it('should respect include patterns', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: fixturesDir,
            include: ['**/*.ts'],
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        for (const comment of result.comments) {
            expect(comment.filePath).toMatch(/\.ts$/);
        }
    });

    it('should respect exclude patterns', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: fixturesDir,
            exclude: ['**/*.tsx'],
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        for (const comment of result.comments) {
            expect(comment.filePath).not.toMatch(/\.tsx$/);
        }
    });

    it('should filter by comment types', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: fixturesDir,
            commentTypes: ['TODO'],
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        for (const comment of result.comments) {
            expect(comment.type).toBe('TODO');
        }
    });

    it('should handle non-existent directory', async () => {
        // Arrange
        const options: CodeCommentScanOptions = {
            baseDir: '/non/existent/path',
        };

        // Act
        const result = await scanCodeComments(options);

        // Assert
        expect(result.filesScanned).toBe(0);
        expect(result.commentsFound).toBe(0);
        expect(result.comments).toHaveLength(0);
    });
});
