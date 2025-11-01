/**
 * Tests for issue builder
 *
 * @module test/sync/issue-builder
 */

import { describe, expect, it } from 'vitest';
import type { PlanningMetadata, Task } from '../../src/parsers/types';
import { buildIssueBody, buildIssueTitle } from '../../src/sync/issue-builder';

describe('issue-builder', () => {
    describe('buildIssueTitle', () => {
        it('should build title with task code and title', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Create user authentication',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            // Act
            const title = buildIssueTitle({ task });

            // Assert
            expect(title).toBe('[T-003-001] Create user authentication');
        });

        it('should handle long titles', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'This is a very long title that exceeds normal length for demonstration',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            // Act
            const title = buildIssueTitle({ task });

            // Assert
            expect(title).toContain('[T-003-001]');
            expect(title).toContain('This is a very long title');
        });
    });

    describe('buildIssueBody', () => {
        it('should build complete issue body with all metadata', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Create user authentication',
                description: 'Implement JWT-based authentication',
                status: 'pending',
                estimate: '8h',
                phase: 2,
                assignee: 'developer1',
                level: 0,
                lineNumber: 5
            };

            const metadata: PlanningMetadata = {
                planningCode: 'P-003',
                featureName: 'User Authentication',
                summary: 'Add user authentication to the platform'
            };

            const sessionPath = '.claude/sessions/planning/P-003-user-auth';

            // Act
            const body = buildIssueBody({ task, metadata, sessionPath });

            // Assert
            expect(body).toContain('## Task: Create user authentication');
            expect(body).toContain('**Planning Code:** P-003');
            expect(body).toContain('**Task Code:** T-003-001');
            expect(body).toContain('**Feature:** User Authentication');
            expect(body).toContain('### Description');
            expect(body).toContain('Implement JWT-based authentication');
            expect(body).toContain('**Status:** pending');
            expect(body).toContain('**Estimate:** 8h');
            expect(body).toContain('**Phase:** 2');
            expect(body).toContain('**Assignee:** @developer1');
            expect(body).toContain('**Summary:** Add user authentication to the platform');
            expect(body).toContain('**Session Path:**');
            expect(body).toContain('*Auto-generated from planning session by @repo/github-workflow*');
        });

        it('should handle task without optional fields', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Simple task',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            const metadata: PlanningMetadata = {
                planningCode: 'P-003',
                featureName: 'Feature Name',
                summary: 'Feature summary'
            };

            const sessionPath = '.claude/sessions/planning/P-003-feature';

            // Act
            const body = buildIssueBody({ task, metadata, sessionPath });

            // Assert
            expect(body).toContain('## Task: Simple task');
            expect(body).toContain('**Status:** pending');
            expect(body).toContain('**Estimate:** Not estimated');
            expect(body).toContain('**Phase:** Not specified');
            expect(body).toContain('**Assignee:** Unassigned');
            expect(body).not.toContain('### Description');
        });

        it('should format multi-line descriptions correctly', () => {
            // Arrange
            const task: Task = {
                id: 'task-001',
                code: 'T-003-001',
                title: 'Complex task',
                description: 'Line 1\nLine 2\nLine 3',
                status: 'pending',
                level: 0,
                lineNumber: 5
            };

            const metadata: PlanningMetadata = {
                planningCode: 'P-003',
                featureName: 'Feature',
                summary: 'Summary'
            };

            const sessionPath = '.claude/sessions/planning/P-003';

            // Act
            const body = buildIssueBody({ task, metadata, sessionPath });

            // Assert
            expect(body).toContain('### Description');
            expect(body).toContain('Line 1\nLine 2\nLine 3');
        });
    });
});
