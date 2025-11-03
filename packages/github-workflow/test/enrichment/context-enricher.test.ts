/**
 * Tests for planning context enricher
 *
 * @module test/enrichment/context-enricher
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    enrichIssueWithContext,
    extractPlanningContext
} from '../../src/enrichment/context-enricher';

describe('context-enricher', () => {
    const testSessionPath = join(__dirname, '../fixtures/test-planning-session');

    beforeEach(() => {
        // Create test planning session
        if (!existsSync(testSessionPath)) {
            mkdirSync(testSessionPath, { recursive: true });
        }

        // Create PDR.md
        writeFileSync(
            join(testSessionPath, 'PDR.md'),
            `# PDR - Test Feature

## Overview
This is a test feature for authentication.

## User Stories
- As a user, I want to login with email
- As a user, I want to reset my password

## Acceptance Criteria
- Email validation works correctly
- Password reset sends email
- Login redirects to dashboard
`
        );

        // Create tech-analysis.md
        writeFileSync(
            join(testSessionPath, 'tech-analysis.md'),
            `# Technical Analysis - Test Feature

## Architecture Decisions
- Use JWT for authentication
- Implement rate limiting
- Store sessions in Redis

## Technical Requirements
- Database: PostgreSQL users table
- API: POST /api/auth/login endpoint
- Frontend: Login form component

## Dependencies
- @clerk/clerk-sdk-node
- jsonwebtoken
`
        );

        // Create TODOs.md
        writeFileSync(
            join(testSessionPath, 'TODOs.md'),
            `# TODOs - P-TEST

## [T-TEST-001] Implement login endpoint
**Estimate:** 3h

Create POST /api/auth/login endpoint

**Dependencies:** None

## [T-TEST-002] Create login form
**Estimate:** 2h

Build React login form component

**Dependencies:** T-TEST-001
`
        );
    });

    afterEach(() => {
        // Cleanup
        if (existsSync(testSessionPath)) {
            rmSync(testSessionPath, { recursive: true, force: true });
        }
    });

    describe('extractPlanningContext', () => {
        it('should extract context from planning session', async () => {
            // Arrange & Act
            const context = await extractPlanningContext(testSessionPath);

            // Assert
            expect(context.sessionPath).toBe(testSessionPath);
            expect(context.pdr).toBeDefined();
            expect(context.pdr.overview).toContain('test feature for authentication');
            expect(context.pdr.userStories).toHaveLength(2);
            expect(context.pdr.acceptanceCriteria).toHaveLength(3);
        });

        it('should extract technical decisions', async () => {
            // Arrange & Act
            const context = await extractPlanningContext(testSessionPath);

            // Assert
            expect(context.techAnalysis).toBeDefined();
            expect(context.techAnalysis.architectureDecisions).toHaveLength(3);
            expect(context.techAnalysis.architectureDecisions[0]).toContain('JWT');
            expect(context.techAnalysis.dependencies).toHaveLength(2);
        });

        it('should extract tasks information', async () => {
            // Arrange & Act
            const context = await extractPlanningContext(testSessionPath);

            // Assert
            expect(context.tasks).toBeDefined();
            expect(context.tasks).toHaveLength(2);
            expect(context.tasks[0].code).toBe('T-TEST-001');
            expect(context.tasks[0].title).toContain('login endpoint');
            expect(context.tasks[1].dependencies).toEqual(['T-TEST-001']);
        });

        it('should handle missing files gracefully', async () => {
            // Arrange - create session with only PDR
            const partialSessionPath = join(__dirname, '../fixtures/partial-session');
            mkdirSync(partialSessionPath, { recursive: true });
            writeFileSync(join(partialSessionPath, 'PDR.md'), '# PDR\n\n## Overview\nTest');

            // Act
            const context = await extractPlanningContext(partialSessionPath);

            // Assert
            expect(context.pdr).toBeDefined();
            expect(context.techAnalysis).toBeUndefined();
            expect(context.tasks).toEqual([]);

            // Cleanup
            rmSync(partialSessionPath, { recursive: true, force: true });
        });
    });

    describe('enrichIssueWithContext', () => {
        it('should enrich issue body with planning context', async () => {
            // Arrange
            const originalBody = '## Task Description\n\nImplement login endpoint';
            const taskCode = 'T-TEST-001';

            // Act
            const enrichedBody = await enrichIssueWithContext({
                body: originalBody,
                sessionPath: testSessionPath,
                taskCode
            });

            // Assert
            expect(enrichedBody).toContain(originalBody);
            expect(enrichedBody).toContain('## Planning Context');
            expect(enrichedBody).toContain('User Stories');
            expect(enrichedBody).toContain('Architecture Decisions');
            expect(enrichedBody).toContain('JWT');
        });

        it('should include relevant acceptance criteria', async () => {
            // Arrange
            const originalBody = '## Task\n\nCreate login form';
            const taskCode = 'T-TEST-002';

            // Act
            const enrichedBody = await enrichIssueWithContext({
                body: originalBody,
                sessionPath: testSessionPath,
                taskCode
            });

            // Assert
            expect(enrichedBody).toContain('Acceptance Criteria');
            expect(enrichedBody).toContain('Email validation');
        });

        it('should include task dependencies', async () => {
            // Arrange
            const originalBody = '## Task\n\nCreate login form';
            const taskCode = 'T-TEST-002';

            // Act
            const enrichedBody = await enrichIssueWithContext({
                body: originalBody,
                sessionPath: testSessionPath,
                taskCode
            });

            // Assert
            expect(enrichedBody).toContain('Dependencies');
            expect(enrichedBody).toContain('T-TEST-001');
        });

        it('should handle tasks without dependencies', async () => {
            // Arrange
            const originalBody = '## Task\n\nImplement endpoint';
            const taskCode = 'T-TEST-001';

            // Act
            const enrichedBody = await enrichIssueWithContext({
                body: originalBody,
                sessionPath: testSessionPath,
                taskCode
            });

            // Assert
            expect(enrichedBody).not.toContain('Dependencies');
        });

        it('should preserve original formatting', async () => {
            // Arrange
            const originalBody = '## Description\n\n- Item 1\n- Item 2\n\n**Bold text**';
            const taskCode = 'T-TEST-001';

            // Act
            const enrichedBody = await enrichIssueWithContext({
                body: originalBody,
                sessionPath: testSessionPath,
                taskCode
            });

            // Assert
            expect(enrichedBody).toContain('- Item 1');
            expect(enrichedBody).toContain('**Bold text**');
        });
    });
});
