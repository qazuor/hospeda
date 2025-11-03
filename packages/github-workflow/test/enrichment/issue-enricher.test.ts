/**
 * Tests for issue enricher
 *
 * @module test/enrichment/issue-enricher
 */

import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type IssueEnricherConfig,
    enrichIssue,
    isAlreadyEnriched
} from '../../src/enrichment/issue-enricher.js';
import type { GitHubIssue } from '../../src/types/github.js';

// Mock Octokit
const mockOctokit = {
    issues: {
        get: vi.fn(),
        update: vi.fn(),
        addLabels: vi.fn()
    }
};

vi.mock('@octokit/rest', () => ({
    Octokit: vi.fn(() => mockOctokit)
}));

describe('enrichIssue', () => {
    const fixturesDir = join(__dirname, '..', 'fixtures', 'P-001-test-session');

    const mockGitHubConfig: IssueEnricherConfig = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('successful enrichment', () => {
        it('should enrich a new issue successfully', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original issue description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue, body: 'Updated body' }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.enriched).toBe(true);
            expect(result.issueNumber).toBe(42);
            expect(result.message).toContain('enriched successfully');
            expect(result.details?.sessionId).toBe('P-001');

            // Verify API calls
            expect(mockOctokit.issues.get).toHaveBeenCalledWith({
                owner: mockGitHubConfig.owner,
                repo: mockGitHubConfig.repo,
                issue_number: 42
            });

            expect(mockOctokit.issues.update).toHaveBeenCalled();
            expect(mockOctokit.issues.addLabels).toHaveBeenCalled();
        });

        it('should not re-enrich an already enriched issue', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description\n\n---\n\n## 📋 Planning Context\n\nAlready enriched',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.enriched).toBe(false);
            expect(result.message).toContain('already enriched');

            // Verify NO update calls were made
            expect(mockOctokit.issues.update).not.toHaveBeenCalled();
            expect(mockOctokit.issues.addLabels).not.toHaveBeenCalled();
        });

        it('should enrich with specific task context', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original issue description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig,
                taskCode: 'T-001-001'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.enriched).toBe(true);
            expect(result.details?.taskCode).toBe('T-001-001');

            // Verify update was called with task-specific content
            const updateCall = mockOctokit.issues.update.mock.calls[0]?.[0];
            expect(updateCall.body).toContain('T-001-001');
        });

        it('should handle issue with null body', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: null,
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.enriched).toBe(true);

            // Verify the new body starts with the separator
            const updateCall = mockOctokit.issues.update.mock.calls[0]?.[0];
            expect(updateCall.body).toContain('## 📋 Planning Context');
        });

        it('should add appropriate labels', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [{ name: 'existing-label', color: '000000', description: null }],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.labelsAdded).toBeDefined();
            expect(result.details?.labelsAdded.length).toBeGreaterThan(0);

            // Verify labels were added
            expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith({
                owner: mockGitHubConfig.owner,
                repo: mockGitHubConfig.repo,
                issue_number: 42,
                labels: expect.arrayContaining(['planning-context'])
            });
        });
    });

    describe('dry-run mode', () => {
        it('should not make actual API calls in dry-run mode', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig,
                dryRun: true
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.enriched).toBe(true);
            expect(result.message).toContain('dry-run');

            // Verify get was called but update/addLabels were not
            expect(mockOctokit.issues.get).toHaveBeenCalled();
            expect(mockOctokit.issues.update).not.toHaveBeenCalled();
            expect(mockOctokit.issues.addLabels).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should handle issue not found', async () => {
            // Arrange
            mockOctokit.issues.get.mockRejectedValue({
                status: 404,
                message: 'Not Found'
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 999,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.enriched).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should handle invalid session path', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: '/non/existent/path',
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.enriched).toBe(false);
            expect(result.message).toContain('Failed');
        });

        it('should handle GitHub API errors during update', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockRejectedValue({
                status: 403,
                message: 'Forbidden'
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.enriched).toBe(false);
            expect(result.message).toContain('Failed');
        });

        it('should handle invalid task code', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig,
                taskCode: 'INVALID-TASK'
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.enriched).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should validate required inputs', async () => {
            // Act & Assert - Invalid issue number
            await expect(
                enrichIssue({
                    issueNumber: 0,
                    sessionPath: fixturesDir,
                    githubConfig: mockGitHubConfig
                })
            ).resolves.toMatchObject({
                success: false,
                enriched: false
            });

            // Act & Assert - Empty session path
            await expect(
                enrichIssue({
                    issueNumber: 42,
                    sessionPath: '',
                    githubConfig: mockGitHubConfig
                })
            ).resolves.toMatchObject({
                success: false,
                enriched: false
            });
        });
    });

    describe('enrichment content', () => {
        it('should include session information', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);

            // Verify enrichment content
            const updateCall = mockOctokit.issues.update.mock.calls[0]?.[0];
            expect(updateCall.body).toContain('## 📋 Planning Context');
            expect(updateCall.body).toContain('P-001');
            expect(updateCall.body).toContain('User Authentication System');
        });

        it('should include goals if available', async () => {
            // Arrange
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: 'Original description',
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);

            // Verify goals are included
            const updateCall = mockOctokit.issues.update.mock.calls[0]?.[0];
            expect(updateCall.body).toContain('## Goals');
        });

        it('should preserve original issue content', async () => {
            // Arrange
            const originalBody = 'Original issue description\n\nWith multiple paragraphs';
            const mockIssue: Partial<GitHubIssue> = {
                number: 42,
                title: 'Test Issue',
                body: originalBody,
                state: 'open',
                labels: [],
                html_url: 'https://github.com/test/repo/issues/42'
            };

            mockOctokit.issues.get.mockResolvedValue({
                data: mockIssue
            });

            mockOctokit.issues.update.mockResolvedValue({
                data: { ...mockIssue }
            });

            mockOctokit.issues.addLabels.mockResolvedValue({
                data: []
            });

            // Act
            const result = await enrichIssue({
                issueNumber: 42,
                sessionPath: fixturesDir,
                githubConfig: mockGitHubConfig
            });

            // Assert
            expect(result.success).toBe(true);

            // Verify original content is preserved
            const updateCall = mockOctokit.issues.update.mock.calls[0]?.[0];
            expect(updateCall.body).toContain(originalBody);
            expect(updateCall.body).toContain('---'); // Separator
            expect(updateCall.body).toContain('## 📋 Planning Context');
        });
    });
});

describe('isAlreadyEnriched', () => {
    it('should detect enriched issue', () => {
        // Arrange
        const enrichedBody = 'Original content\n\n---\n\n## 📋 Planning Context\n\nEnriched data';

        // Act
        const result = isAlreadyEnriched(enrichedBody);

        // Assert
        expect(result).toBe(true);
    });

    it('should detect non-enriched issue', () => {
        // Arrange
        const plainBody = 'Just a regular issue description';

        // Act
        const result = isAlreadyEnriched(plainBody);

        // Assert
        expect(result).toBe(false);
    });

    it('should handle null/empty body', () => {
        // Act & Assert
        expect(isAlreadyEnriched(null)).toBe(false);
        expect(isAlreadyEnriched('')).toBe(false);
        expect(isAlreadyEnriched('   ')).toBe(false);
    });

    it('should not be fooled by similar text', () => {
        // Arrange
        const fakeBody =
            'This mentions planning context but not the marker: Planning Context is important';

        // Act
        const result = isAlreadyEnriched(fakeBody);

        // Assert
        expect(result).toBe(false);
    });
});

describe('input validation', () => {
    const mockGitHubConfig: IssueEnricherConfig = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo'
    };

    const fixturesDir = join(__dirname, '..', 'fixtures', 'P-001-test-session');

    it('should reject empty GitHub token', async () => {
        // Act
        const result = await enrichIssue({
            issueNumber: 42,
            sessionPath: fixturesDir,
            githubConfig: {
                ...mockGitHubConfig,
                token: ''
            }
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('token is required');
    });

    it('should reject empty GitHub owner', async () => {
        // Act
        const result = await enrichIssue({
            issueNumber: 42,
            sessionPath: fixturesDir,
            githubConfig: {
                ...mockGitHubConfig,
                owner: ''
            }
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('owner is required');
    });

    it('should reject empty GitHub repo', async () => {
        // Act
        const result = await enrichIssue({
            issueNumber: 42,
            sessionPath: fixturesDir,
            githubConfig: {
                ...mockGitHubConfig,
                repo: ''
            }
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('repo is required');
    });

    it('should reject whitespace-only session path', async () => {
        // Act
        const result = await enrichIssue({
            issueNumber: 42,
            sessionPath: '   ',
            githubConfig: mockGitHubConfig
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('required');
    });

    it('should reject negative issue number', async () => {
        // Act
        const result = await enrichIssue({
            issueNumber: -1,
            sessionPath: fixturesDir,
            githubConfig: mockGitHubConfig
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('positive integer');
    });

    it('should handle unknown errors gracefully', async () => {
        // Arrange
        const mockIssue: Partial<GitHubIssue> = {
            number: 42,
            title: 'Test Issue',
            body: 'Original description',
            state: 'open',
            labels: [],
            html_url: 'https://github.com/test/repo/issues/42'
        };

        mockOctokit.issues.get.mockResolvedValue({
            data: mockIssue
        });

        // Throw error without status or message
        mockOctokit.issues.update.mockRejectedValue({});

        // Act
        const result = await enrichIssue({
            issueNumber: 42,
            sessionPath: fixturesDir,
            githubConfig: mockGitHubConfig
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown error');
    });
});
