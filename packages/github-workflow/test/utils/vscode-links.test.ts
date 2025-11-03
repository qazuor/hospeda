/**
 * Tests for VSCode links utility
 *
 * @module test/utils/vscode-links
 */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    createVSCodeFileLink,
    createVSCodeSessionLinks,
    formatVSCodeLink
} from '../../src/utils/vscode-links';

describe('VSCodeLinks', () => {
    describe('formatVSCodeLink', () => {
        it('should format basic file link', () => {
            // Arrange
            const filePath = '/home/user/project/src/file.ts';

            // Act
            const link = formatVSCodeLink(filePath);

            // Assert
            expect(link).toBe('vscode://file/home/user/project/src/file.ts');
        });

        it('should format link with line number', () => {
            // Arrange
            const filePath = '/home/user/project/src/file.ts';
            const line = 42;

            // Act
            const link = formatVSCodeLink(filePath, line);

            // Assert
            expect(link).toBe('vscode://file/home/user/project/src/file.ts:42');
        });

        it('should format link with line and column', () => {
            // Arrange
            const filePath = '/home/user/project/src/file.ts';
            const line = 42;
            const column = 10;

            // Act
            const link = formatVSCodeLink(filePath, line, column);

            // Assert
            expect(link).toBe('vscode://file/home/user/project/src/file.ts:42:10');
        });

        it('should handle Windows paths', () => {
            // Arrange
            const filePath = 'C:\\Users\\user\\project\\src\\file.ts';

            // Act
            const link = formatVSCodeLink(filePath);

            // Assert
            expect(link).toBe('vscode://file/C:/Users/user/project/src/file.ts');
        });

        it('should handle relative paths by converting to absolute', () => {
            // Arrange
            const filePath = './src/file.ts';

            // Act
            const link = formatVSCodeLink(filePath);

            // Assert
            const absolutePath = resolve(filePath);
            expect(link).toBe(`vscode://file${absolutePath}`);
        });
    });

    describe('createVSCodeFileLink', () => {
        it('should create markdown link for file', () => {
            // Arrange
            const filePath = '/home/user/project/src/file.ts';
            const linkText = 'file.ts';

            // Act
            const markdownLink = createVSCodeFileLink({
                filePath,
                linkText
            });

            // Assert
            expect(markdownLink).toBe('[file.ts](vscode://file/home/user/project/src/file.ts)');
        });

        it('should create markdown link with line number', () => {
            // Arrange
            const filePath = '/home/user/project/PDR.md';
            const linkText = 'PDR.md';
            const line = 10;

            // Act
            const markdownLink = createVSCodeFileLink({
                filePath,
                linkText,
                line
            });

            // Assert
            expect(markdownLink).toBe('[PDR.md](vscode://file/home/user/project/PDR.md:10)');
        });

        it('should create markdown link with line and column', () => {
            // Arrange
            const filePath = '/home/user/project/tech-analysis.md';
            const linkText = 'Architecture Overview';
            const line = 42;
            const column = 5;

            // Act
            const markdownLink = createVSCodeFileLink({
                filePath,
                linkText,
                line,
                column
            });

            // Assert
            expect(markdownLink).toBe(
                '[Architecture Overview](vscode://file/home/user/project/tech-analysis.md:42:5)'
            );
        });

        it('should use filename as default link text', () => {
            // Arrange
            const filePath = '/home/user/project/src/models/user.model.ts';

            // Act
            const markdownLink = createVSCodeFileLink({
                filePath
            });

            // Assert
            expect(markdownLink).toBe(
                '[user.model.ts](vscode://file/home/user/project/src/models/user.model.ts)'
            );
        });
    });

    describe('createVSCodeSessionLinks', () => {
        it('should create links for all planning session files', () => {
            // Arrange
            const sessionPath = '/home/user/project/.claude/sessions/planning/P-001-feature';

            // Act
            const links = createVSCodeSessionLinks(sessionPath);

            // Assert
            expect(links).toHaveProperty('pdr');
            expect(links).toHaveProperty('techAnalysis');
            expect(links).toHaveProperty('todos');

            expect(links.pdr).toContain('[PDR.md]');
            expect(links.pdr).toContain('vscode://file');
            expect(links.pdr).toContain('PDR.md');

            expect(links.techAnalysis).toContain('[tech-analysis.md]');
            expect(links.techAnalysis).toContain('vscode://file');
            expect(links.techAnalysis).toContain('tech-analysis.md');

            expect(links.todos).toContain('[TODOs.md]');
            expect(links.todos).toContain('vscode://file');
            expect(links.todos).toContain('TODOs.md');
        });

        it('should use absolute paths for session files', () => {
            // Arrange
            const sessionPath = '.claude/sessions/planning/P-001-feature';

            // Act
            const links = createVSCodeSessionLinks(sessionPath);

            // Assert
            const absoluteSessionPath = resolve(sessionPath);
            expect(links.pdr).toContain(absoluteSessionPath);
            expect(links.techAnalysis).toContain(absoluteSessionPath);
            expect(links.todos).toContain(absoluteSessionPath);
        });

        it('should create formatted markdown section', () => {
            // Arrange
            const sessionPath = '/home/user/project/.claude/sessions/planning/P-001-feature';

            // Act
            const links = createVSCodeSessionLinks(sessionPath);
            const section = links.formatted;

            // Assert
            expect(section).toContain('**Planning Files**');
            expect(section).toContain('- PDR:');
            expect(section).toContain('- Technical Analysis:');
            expect(section).toContain('- Tasks:');
            expect(section).toContain('[PDR.md]');
            expect(section).toContain('[tech-analysis.md]');
            expect(section).toContain('[TODOs.md]');
        });
    });
});
