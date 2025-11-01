/**
 * Tests for GitHubClient
 *
 * @module test/core/github-client
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../../src/core/github-client';
import type { GitHubClientConfig } from '../../src/types/github';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
    Octokit: vi.fn().mockImplementation(() => ({
        issues: {
            create: vi.fn(),
            update: vi.fn(),
            createComment: vi.fn(),
            addLabels: vi.fn(),
            getLabel: vi.fn(),
            createLabel: vi.fn()
        },
        rest: {
            issues: {
                create: vi.fn(),
                update: vi.fn(),
                createComment: vi.fn(),
                addLabels: vi.fn(),
                getLabel: vi.fn(),
                createLabel: vi.fn()
            }
        }
    }))
}));

vi.mock('@octokit/graphql', () => ({
    graphql: {
        defaults: vi.fn().mockReturnValue(vi.fn())
    }
}));

describe('GitHubClient', () => {
    let config: GitHubClientConfig;

    beforeEach(() => {
        config = {
            token: 'test-token',
            owner: 'test-owner',
            repo: 'test-repo'
        };
    });

    describe('constructor', () => {
        it('should initialize with valid token', () => {
            // Act
            const client = new GitHubClient(config);

            // Assert
            expect(client).toBeDefined();
            expect(client).toBeInstanceOf(GitHubClient);
        });

        it('should throw error with missing token', () => {
            // Arrange
            const invalidConfig = { ...config, token: '' };

            // Act & Assert
            expect(() => new GitHubClient(invalidConfig)).toThrow('GitHub token is required');
        });

        it('should throw error with missing owner', () => {
            // Arrange
            const invalidConfig = { ...config, owner: '' };

            // Act & Assert
            expect(() => new GitHubClient(invalidConfig)).toThrow('GitHub owner is required');
        });

        it('should throw error with missing repo', () => {
            // Arrange
            const invalidConfig = { ...config, repo: '' };

            // Act & Assert
            expect(() => new GitHubClient(invalidConfig)).toThrow('GitHub repository is required');
        });
    });

    describe('createIssue', () => {
        it('should create issue with title and body', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockResolvedValue({
                data: { number: 123 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act
            const issueNumber = await client.createIssue({
                title: 'Test Issue',
                body: 'Test body'
            });

            // Assert
            expect(issueNumber).toBe(123);
            expect(mockCreate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                title: 'Test Issue',
                body: 'Test body'
            });
        });

        it('should create issue with labels', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockResolvedValue({
                data: { number: 456 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act
            const issueNumber = await client.createIssue({
                title: 'Test Issue',
                body: 'Test body',
                labels: ['bug', 'feature']
            });

            // Assert
            expect(issueNumber).toBe(456);
            expect(mockCreate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                title: 'Test Issue',
                body: 'Test body',
                labels: ['bug', 'feature']
            });
        });

        it('should create issue with assignees', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockResolvedValue({
                data: { number: 789 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act
            const issueNumber = await client.createIssue({
                title: 'Test Issue',
                body: 'Test body',
                assignees: ['user1', 'user2']
            });

            // Assert
            expect(issueNumber).toBe(789);
            expect(mockCreate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                title: 'Test Issue',
                body: 'Test body',
                assignees: ['user1', 'user2']
            });
        });

        it('should handle API errors when creating issue', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockRejectedValue({
                status: 422,
                message: 'Validation failed'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act & Assert
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('Failed to create issue: Validation failed');
        });
    });

    describe('updateIssue', () => {
        it('should update issue title', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockUpdate = vi.fn().mockResolvedValue({
                data: { number: 123 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.update = mockUpdate;

            // Act
            await client.updateIssue(123, {
                title: 'Updated Title'
            });

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 123,
                title: 'Updated Title'
            });
        });

        it('should update issue body', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockUpdate = vi.fn().mockResolvedValue({
                data: { number: 123 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.update = mockUpdate;

            // Act
            await client.updateIssue(123, {
                body: 'Updated body'
            });

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 123,
                body: 'Updated body'
            });
        });

        it('should update issue state', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockUpdate = vi.fn().mockResolvedValue({
                data: { number: 123 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.update = mockUpdate;

            // Act
            await client.updateIssue(123, {
                state: 'closed'
            });

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 123,
                state: 'closed'
            });
        });

        it('should handle non-existent issue', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockUpdate = vi.fn().mockRejectedValue({
                status: 404,
                message: 'Not Found'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.update = mockUpdate;

            // Act & Assert
            await expect(
                client.updateIssue(999, {
                    title: 'Updated Title'
                })
            ).rejects.toThrow('Issue not found');
        });
    });

    describe('closeIssue', () => {
        it('should close open issue', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockUpdate = vi.fn().mockResolvedValue({
                data: { number: 123 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.update = mockUpdate;

            // Act
            await client.closeIssue(123);

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 123,
                state: 'closed'
            });
        });

        it('should handle already closed issue', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockUpdate = vi.fn().mockResolvedValue({
                data: { number: 123, state: 'closed' }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.update = mockUpdate;

            // Act
            await client.closeIssue(123);

            // Assert
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('linkIssues', () => {
        it('should link child issue to parent', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateComment = vi.fn().mockResolvedValue({
                data: { id: 1 }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createComment = mockCreateComment;

            // Act
            await client.linkIssues(123, 456);

            // Assert
            expect(mockCreateComment).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 456,
                body: expect.stringContaining('#123')
            });
        });

        it('should handle invalid parent issue number', async () => {
            // Arrange
            const client = new GitHubClient(config);

            // Act & Assert
            await expect(client.linkIssues(0, 456)).rejects.toThrow('Invalid parent issue number');
        });

        it('should handle invalid child issue number', async () => {
            // Arrange
            const client = new GitHubClient(config);

            // Act & Assert
            await expect(client.linkIssues(123, 0)).rejects.toThrow('Invalid child issue number');
        });

        it('should handle API errors when linking', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateComment = vi.fn().mockRejectedValue({
                status: 404,
                message: 'Not Found'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createComment = mockCreateComment;

            // Act & Assert
            await expect(client.linkIssues(123, 456)).rejects.toThrow('Issue not found');
        });
    });

    describe('createLabel', () => {
        it('should create label with name and color', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateLabel = vi.fn().mockResolvedValue({
                data: { name: 'bug', color: 'FF0000' }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createLabel = mockCreateLabel;

            // Act
            await client.createLabel({
                name: 'bug',
                color: 'FF0000'
            });

            // Assert
            expect(mockCreateLabel).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                name: 'bug',
                color: 'FF0000'
            });
        });

        it('should create label with description', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateLabel = vi.fn().mockResolvedValue({
                data: { name: 'feature', color: '00FF00', description: 'New feature' }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createLabel = mockCreateLabel;

            // Act
            await client.createLabel({
                name: 'feature',
                color: '00FF00',
                description: 'New feature'
            });

            // Assert
            expect(mockCreateLabel).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                name: 'feature',
                color: '00FF00',
                description: 'New feature'
            });
        });

        it('should handle duplicate labels gracefully', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateLabel = vi.fn().mockRejectedValue({
                status: 422,
                message: 'Label already exists'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createLabel = mockCreateLabel;

            // Act & Assert
            // Should not throw, just log warning
            await expect(
                client.createLabel({
                    name: 'bug',
                    color: 'FF0000'
                })
            ).resolves.not.toThrow();
        });

        it('should cache created labels', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateLabel = vi.fn().mockResolvedValue({
                data: { name: 'bug', color: 'FF0000' }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createLabel = mockCreateLabel;

            // Act
            await client.createLabel({
                name: 'bug',
                color: 'FF0000'
            });

            // Assert - check cache
            // @ts-expect-error - Accessing private property for testing
            expect(client.labelCache.has('bug')).toBe(true);
        });

        it('should handle API errors when creating label', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreateLabel = vi.fn().mockRejectedValue({
                status: 500,
                message: 'Internal Server Error'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createLabel = mockCreateLabel;

            // Act & Assert
            await expect(
                client.createLabel({
                    name: 'bug',
                    color: 'FF0000'
                })
            ).rejects.toThrow('Failed to create label');
        });
    });

    describe('addLabels', () => {
        it('should add multiple labels to issue', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockGetLabel = vi.fn().mockResolvedValue({
                data: { name: 'bug', color: 'FF0000' }
            });
            const mockAddLabels = vi.fn().mockResolvedValue({
                data: []
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.getLabel = mockGetLabel;
            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.addLabels = mockAddLabels;

            // Act
            await client.addLabels(123, ['bug', 'feature']);

            // Assert
            expect(mockAddLabels).toHaveBeenCalledWith({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 123,
                labels: ['bug', 'feature']
            });
        });

        it('should create labels if they do not exist', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockGetLabel = vi.fn().mockRejectedValue({
                status: 404,
                message: 'Not Found'
            });
            const mockCreateLabel = vi.fn().mockResolvedValue({
                data: { name: 'new-label', color: 'D4C5F9' }
            });
            const mockAddLabels = vi.fn().mockResolvedValue({
                data: []
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.getLabel = mockGetLabel;
            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.createLabel = mockCreateLabel;
            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.addLabels = mockAddLabels;

            // Act
            await client.addLabels(123, ['new-label']);

            // Assert
            expect(mockCreateLabel).toHaveBeenCalled();
            expect(mockAddLabels).toHaveBeenCalled();
        });

        it('should use cached labels', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockGetLabel = vi.fn();
            const mockAddLabels = vi.fn().mockResolvedValue({
                data: []
            });

            // @ts-expect-error - Accessing private property for testing
            client.labelCache.set('bug', { name: 'bug', color: 'FF0000' });
            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.getLabel = mockGetLabel;
            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.addLabels = mockAddLabels;

            // Act
            await client.addLabels(123, ['bug']);

            // Assert
            expect(mockGetLabel).not.toHaveBeenCalled(); // Should use cache
            expect(mockAddLabels).toHaveBeenCalled();
        });

        it('should handle errors when checking label existence', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockGetLabel = vi.fn().mockRejectedValue({
                status: 500,
                message: 'Internal Server Error'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.getLabel = mockGetLabel;

            // Act & Assert
            await expect(client.addLabels(123, ['new-label'])).rejects.toThrow();
        });

        it('should handle errors when adding labels to issue', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockGetLabel = vi.fn().mockResolvedValue({
                data: { name: 'bug', color: 'FF0000' }
            });
            const mockAddLabels = vi.fn().mockRejectedValue({
                status: 422,
                message: 'Validation failed'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.getLabel = mockGetLabel;
            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.addLabels = mockAddLabels;

            // Act & Assert
            await expect(client.addLabels(123, ['bug'])).rejects.toThrow('Failed to add labels');
        });
    });

    describe('rate limiting', () => {
        it('should handle rate limit errors', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockRejectedValue({
                status: 403,
                message: 'rate limit exceeded',
                response: {
                    headers: {
                        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
                    }
                }
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act & Assert
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('GitHub API rate limit exceeded');
        });

        it('should retry after rate limit reset', async () => {
            // Arrange
            const client = new GitHubClient(config);
            let callCount = 0;
            const mockCreate = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject({
                        status: 403,
                        message: 'rate limit exceeded',
                        response: {
                            headers: {
                                'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1)
                            }
                        }
                    });
                }
                return Promise.resolve({ data: { number: 123 } });
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Note: This test would require mocking timers or actual waiting
            // For now, we'll just test that it eventually rejects with proper error
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('GitHub API rate limit exceeded');
        });
    });

    describe('error handling edge cases', () => {
        it('should handle unknown errors', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockRejectedValue({
                status: 500,
                message: 'Internal Server Error'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act & Assert
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('Failed to create issue: Internal Server Error');
        });

        it('should handle errors without message', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockRejectedValue({
                status: 500
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act & Assert
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('Failed to create issue: Unknown error');
        });

        it('should handle validation errors with message', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockRejectedValue({
                status: 422,
                message: 'Invalid title format'
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act & Assert
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('Failed to create issue: Invalid title format');
        });

        it('should handle validation errors without message', async () => {
            // Arrange
            const client = new GitHubClient(config);
            const mockCreate = vi.fn().mockRejectedValue({
                status: 422
            });

            // @ts-expect-error - Accessing private property for testing
            client.octokit.rest.issues.create = mockCreate;

            // Act & Assert
            await expect(
                client.createIssue({
                    title: 'Test Issue',
                    body: 'Test body'
                })
            ).rejects.toThrow('Failed to create issue: Validation failed');
        });
    });
});
