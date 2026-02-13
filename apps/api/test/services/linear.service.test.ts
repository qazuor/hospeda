import type { IssueLabel } from '@linear/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Hoisted mock objects that vi.mock factories can reference.
 * These are created before any vi.mock() hoisting occurs.
 */
const { mockEnv, mockClient, MockLinearClient, mockFetch } = vi.hoisted(() => {
    const client = {
        team: vi.fn(),
        fileUpload: vi.fn(),
        createIssue: vi.fn()
    };

    return {
        mockEnv: {
            HOSPEDA_LINEAR_API_KEY: 'test-api-key',
            HOSPEDA_LINEAR_TEAM_ID: 'test-team-id'
        } as Record<string, string | undefined>,
        mockClient: client,
        MockLinearClient: vi.fn(() => client),
        mockFetch: vi.fn()
    };
});

vi.mock('@linear/sdk', () => ({
    LinearClient: MockLinearClient
}));

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }))
}));

describe('linear.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mockEnv.HOSPEDA_LINEAR_API_KEY = 'test-api-key';
        mockEnv.HOSPEDA_LINEAR_TEAM_ID = 'test-team-id';
        global.fetch = mockFetch;
    });

    describe('getLinearLabels', () => {
        it('should return labels from Linear SDK', async () => {
            // Arrange
            const mockLabels: IssueLabel[] = [
                {
                    id: 'label-1',
                    name: 'Bug',
                    color: '#ff0000',
                    parent: Promise.resolve(null)
                } as unknown as IssueLabel,
                {
                    id: 'label-2',
                    name: 'Priority',
                    color: '#00ff00',
                    parent: Promise.resolve({ name: 'Category' } as unknown as IssueLabel)
                } as unknown as IssueLabel
            ];

            const mockTeam = {
                labels: vi.fn().mockResolvedValue({ nodes: mockLabels })
            };

            mockClient.team.mockResolvedValue(mockTeam as never);

            const { getLinearLabels } = await import('../../src/services/linear.service');

            // Act
            const result = await getLinearLabels();

            // Assert
            expect(result).toEqual({
                data: [
                    { id: 'label-1', name: 'Bug', color: '#ff0000', parentName: null },
                    { id: 'label-2', name: 'Priority', color: '#00ff00', parentName: 'Category' }
                ]
            });
            expect(mockClient.team).toHaveBeenCalledWith('test-team-id');
            expect(mockTeam.labels).toHaveBeenCalled();
        });

        it('should use cached results within 5 minutes', async () => {
            // Arrange
            const mockLabels: IssueLabel[] = [
                {
                    id: 'label-1',
                    name: 'Bug',
                    color: '#ff0000',
                    parent: Promise.resolve(null)
                } as unknown as IssueLabel
            ];

            const mockTeam = {
                labels: vi.fn().mockResolvedValue({ nodes: mockLabels })
            };

            mockClient.team.mockResolvedValue(mockTeam as never);

            const { getLinearLabels } = await import('../../src/services/linear.service');

            // Act
            const result1 = await getLinearLabels();
            const result2 = await getLinearLabels();

            // Assert
            expect(result1).toEqual(result2);
            expect(mockClient.team).toHaveBeenCalledTimes(1);
            expect(mockTeam.labels).toHaveBeenCalledTimes(1);
        });

        it('should throw when API key missing', async () => {
            // Arrange
            mockEnv.HOSPEDA_LINEAR_API_KEY = undefined;

            const { getLinearLabels } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(getLinearLabels()).rejects.toThrow('Linear integration not configured');
        });

        it('should throw when team ID missing', async () => {
            // Arrange
            mockEnv.HOSPEDA_LINEAR_TEAM_ID = undefined;

            const { getLinearLabels } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(getLinearLabels()).rejects.toThrow('not configured');
        });
    });

    describe('uploadFileToLinear', () => {
        it('should call fileUpload and PUT to presigned URL correctly', async () => {
            // Arrange
            const testBuffer = Buffer.from('test file content');
            const params = {
                buffer: testBuffer,
                mimeType: 'image/png',
                fileName: 'test.png',
                fileSize: testBuffer.length
            };

            const mockUploadPayload = {
                uploadFile: {
                    uploadUrl: 'https://s3.example.com/upload',
                    assetUrl: 'https://cdn.example.com/asset.png',
                    headers: [
                        { key: 'x-amz-acl', value: 'public-read' },
                        { key: 'Cache-Control', value: 'max-age=31536000' }
                    ]
                }
            };

            mockClient.fileUpload.mockResolvedValue(mockUploadPayload as never);
            mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

            const { uploadFileToLinear } = await import('../../src/services/linear.service');

            // Act
            const result = await uploadFileToLinear(params);

            // Assert
            expect(mockClient.fileUpload).toHaveBeenCalledWith(
                'image/png',
                'test.png',
                testBuffer.length
            );

            expect(mockFetch).toHaveBeenCalledWith(
                'https://s3.example.com/upload',
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        'Content-Type': 'image/png',
                        'Content-Length': testBuffer.length.toString(),
                        'x-amz-acl': 'public-read',
                        'Cache-Control': 'max-age=31536000'
                    }),
                    body: testBuffer
                })
            );

            expect(result).toEqual({ assetUrl: 'https://cdn.example.com/asset.png' });
        });

        it('should throw when upload fails', async () => {
            // Arrange
            const testBuffer = Buffer.from('test');
            const params = {
                buffer: testBuffer,
                mimeType: 'image/png',
                fileName: 'test.png',
                fileSize: testBuffer.length
            };

            mockClient.fileUpload.mockResolvedValue({
                uploadFile: {
                    uploadUrl: 'https://s3.example.com/upload',
                    assetUrl: 'https://cdn.example.com/asset.png',
                    headers: []
                }
            } as never);

            mockFetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });

            const { uploadFileToLinear } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(uploadFileToLinear(params)).rejects.toThrow(
                'Failed to upload file to storage: 403 Forbidden'
            );
        });

        it('should throw when Linear returns no upload URL', async () => {
            // Arrange
            const testBuffer = Buffer.from('test');
            const params = {
                buffer: testBuffer,
                mimeType: 'image/png',
                fileName: 'test.png',
                fileSize: testBuffer.length
            };

            mockClient.fileUpload.mockResolvedValue(null as never);

            const { uploadFileToLinear } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(uploadFileToLinear(params)).rejects.toThrow(
                'Failed to get upload URL from Linear'
            );
        });
    });

    describe('createLinearBugReport', () => {
        it('should create issue with correct params', async () => {
            // Arrange
            const params = {
                title: 'Test Bug Report',
                markdownBody: '## Description\n\nThis is a test bug',
                priority: 1,
                labelIds: ['label-1', 'label-2']
            };

            const mockIssue = {
                id: 'issue-123',
                url: 'https://linear.app/team/issue/TEST-123',
                identifier: 'TEST-123'
            };

            mockClient.createIssue.mockResolvedValue({
                issue: Promise.resolve(mockIssue)
            } as never);

            const { createLinearBugReport } = await import('../../src/services/linear.service');

            // Act
            const result = await createLinearBugReport(params);

            // Assert
            expect(mockClient.createIssue).toHaveBeenCalledWith({
                teamId: 'test-team-id',
                title: 'Test Bug Report',
                description: '## Description\n\nThis is a test bug',
                priority: 1,
                labelIds: ['label-1', 'label-2']
            });

            expect(result).toEqual({
                issueId: 'issue-123',
                issueUrl: 'https://linear.app/team/issue/TEST-123',
                identifier: 'TEST-123'
            });
        });

        it('should return issueId, issueUrl, identifier', async () => {
            // Arrange
            const params = {
                title: 'Another Bug',
                markdownBody: 'Content',
                priority: 2,
                labelIds: []
            };

            mockClient.createIssue.mockResolvedValue({
                issue: Promise.resolve({
                    id: 'issue-456',
                    url: 'https://linear.app/team/issue/TEST-456',
                    identifier: 'TEST-456'
                })
            } as never);

            const { createLinearBugReport } = await import('../../src/services/linear.service');

            // Act
            const result = await createLinearBugReport(params);

            // Assert
            expect(result).toHaveProperty('issueId');
            expect(result).toHaveProperty('issueUrl');
            expect(result).toHaveProperty('identifier');
            expect(result.issueId).toBe('issue-456');
            expect(result.issueUrl).toBe('https://linear.app/team/issue/TEST-456');
            expect(result.identifier).toBe('TEST-456');
        });

        it('should throw when API key missing', async () => {
            // Arrange
            mockEnv.HOSPEDA_LINEAR_API_KEY = undefined;

            const { createLinearBugReport } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(
                createLinearBugReport({
                    title: 'Bug',
                    markdownBody: 'Description',
                    priority: 1,
                    labelIds: []
                })
            ).rejects.toThrow('Linear integration not configured');
        });

        it('should throw when team ID missing', async () => {
            // Arrange
            mockEnv.HOSPEDA_LINEAR_TEAM_ID = undefined;

            const { createLinearBugReport } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(
                createLinearBugReport({
                    title: 'Bug',
                    markdownBody: 'Description',
                    priority: 1,
                    labelIds: []
                })
            ).rejects.toThrow('not configured');
        });

        it('should throw when issue creation returns no issue', async () => {
            // Arrange
            mockClient.createIssue.mockResolvedValue({
                issue: Promise.resolve(null)
            } as never);

            const { createLinearBugReport } = await import('../../src/services/linear.service');

            // Act & Assert
            await expect(
                createLinearBugReport({
                    title: 'Bug',
                    markdownBody: 'Description',
                    priority: 1,
                    labelIds: []
                })
            ).rejects.toThrow('Issue creation returned no issue object');
        });
    });
});
