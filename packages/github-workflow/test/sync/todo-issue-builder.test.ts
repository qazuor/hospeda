/**
 * Tests for TODO issue builder
 *
 * Validates issue title and body generation for code comments
 */

import { describe, expect, it } from 'vitest';
import type { CodeComment } from '../../src/parsers/types.js';
import { buildTodoIssueBody, buildTodoIssueTitle } from '../../src/sync/todo-issue-builder.js';

describe('buildTodoIssueTitle', () => {
    it('should build title for TODO comment', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Implement user authentication',
            filePath: 'src/auth/user.ts',
            lineNumber: 42
        };

        // Act
        const title = buildTodoIssueTitle({ comment });

        // Assert
        expect(title).toBe('[TODO] src/auth/user.ts:42');
    });

    it('should build title for HACK comment', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-456',
            type: 'HACK',
            content: 'Temporary workaround for API bug',
            filePath: 'src/api/client.ts',
            lineNumber: 100
        };

        // Act
        const title = buildTodoIssueTitle({ comment });

        // Assert
        expect(title).toBe('[HACK] src/api/client.ts:100');
    });

    it('should build title for DEBUG comment', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-789',
            type: 'DEBUG',
            content: 'Remove console.log before production',
            filePath: 'src/utils/logger.ts',
            lineNumber: 15
        };

        // Act
        const title = buildTodoIssueTitle({ comment });

        // Assert
        expect(title).toBe('[DEBUG] src/utils/logger.ts:15');
    });
});

describe('buildTodoIssueBody', () => {
    it('should build body for simple TODO without metadata', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Implement user authentication',
            filePath: 'src/auth/user.ts',
            lineNumber: 42
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('## TODO: Implement user authentication');
        expect(body).toContain('**Type:** TODO');
        expect(body).toContain('**File:** src/auth/user.ts');
        expect(body).toContain('**Line:** 42');
        expect(body).toContain('### Code Context');
        expect(body).toContain('```typescript');
        expect(body).toContain('// Line 42');
        expect(body).toContain('Implement user authentication');
        expect(body).toContain('```');
        expect(body).toContain('### Source');
        expect(body).toContain('- **Repository:** hospeda/main');
        expect(body).toContain('- **File:** `src/auth/user.ts`');
        expect(body).toContain(
            '- **Line:** [42](https://github.com/hospeda/main/blob/main/src/auth/user.ts#L42)'
        );
        expect(body).toContain('*Auto-generated from code comment by @repo/github-workflow*');
    });

    it('should build body for TODO with priority', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix security vulnerability',
            filePath: 'src/security/validator.ts',
            lineNumber: 50,
            priority: 'high'
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('## TODO: Fix security vulnerability');
        expect(body).toContain('### Details');
        expect(body).toContain('- **Priority:** high');
        expect(body).not.toContain('- **Assignee:**');
        expect(body).not.toContain('- **Labels:**');
    });

    it('should build body for TODO with assignee', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Update documentation',
            filePath: 'docs/api.md',
            lineNumber: 10,
            assignee: 'john'
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('### Details');
        expect(body).toContain('- **Assignee:** @john');
        expect(body).not.toContain('- **Priority:**');
    });

    it('should build body for TODO with labels', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Refactor legacy code',
            filePath: 'src/legacy/old-module.ts',
            lineNumber: 200,
            labels: ['refactor', 'technical-debt']
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('### Details');
        expect(body).toContain('- **Labels:** refactor, technical-debt');
    });

    it('should build body for TODO with all metadata', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Optimize database query',
            filePath: 'src/db/queries.ts',
            lineNumber: 75,
            priority: 'P1',
            assignee: 'maria',
            labels: ['performance', 'database']
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('## TODO: Optimize database query');
        expect(body).toContain('### Details');
        expect(body).toContain('- **Priority:** P1');
        expect(body).toContain('- **Assignee:** @maria');
        expect(body).toContain('- **Labels:** performance, database');
        expect(body).toContain('**Type:** TODO');
        expect(body).toContain('**File:** src/db/queries.ts');
        expect(body).toContain('**Line:** 75');
    });

    it('should build body for HACK comment', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-456',
            type: 'HACK',
            content: 'Quick fix for production bug',
            filePath: 'src/api/endpoints.ts',
            lineNumber: 150,
            priority: 'high'
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('## HACK: Quick fix for production bug');
        expect(body).toContain('**Type:** HACK');
    });

    it('should build body for DEBUG comment', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-789',
            type: 'DEBUG',
            content: 'Remove before release',
            filePath: 'src/utils/debug.ts',
            lineNumber: 5
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('## DEBUG: Remove before release');
        expect(body).toContain('**Type:** DEBUG');
    });

    it('should handle long file paths', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Test comment',
            filePath: 'packages/github-workflow/src/sync/very/deeply/nested/file.ts',
            lineNumber: 1
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain(
            '**File:** packages/github-workflow/src/sync/very/deeply/nested/file.ts'
        );
        expect(body).toContain(
            '[1](https://github.com/hospeda/main/blob/main/packages/github-workflow/src/sync/very/deeply/nested/file.ts#L1)'
        );
    });

    it('should handle multi-line comment content in code block', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'First line Second line Third line',
            filePath: 'src/test.ts',
            lineNumber: 10
        };

        const owner = 'hospeda';
        const repo = 'main';

        // Act
        const body = buildTodoIssueBody({ comment, owner, repo });

        // Assert
        expect(body).toContain('### Code Context');
        expect(body).toContain('```typescript');
        expect(body).toContain('// Line 10');
        expect(body).toContain('First line Second line Third line');
    });
});
