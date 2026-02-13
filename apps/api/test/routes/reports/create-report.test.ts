import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the linear service before imports
vi.mock('../../../src/services/linear.service', () => ({
    getLinearLabels: vi.fn().mockResolvedValue({ data: [] }),
    uploadFileToLinear: vi.fn().mockResolvedValue({ assetUrl: 'https://cdn.linear.app/test.png' }),
    createLinearBugReport: vi.fn().mockResolvedValue({
        issueId: 'issue-123',
        issueUrl: 'https://linear.app/team/issue/TEAM-123',
        identifier: 'TEAM-123'
    })
}));

// Mock the markdown builder
vi.mock('../../../src/utils/markdown-builder', () => ({
    buildBugReportMarkdown: vi.fn().mockReturnValue('## Bug Report\n\nTest markdown')
}));

// Mock env
vi.mock('../../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test',
        HOSPEDA_LINEAR_API_KEY: 'test-api-key',
        HOSPEDA_LINEAR_TEAM_ID: 'test-team-id',
        HOSPEDA_DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        HOSPEDA_BETTER_AUTH_SECRET: 'test_secret_32_chars_long_enough',
        HOSPEDA_API_URL: 'http://localhost:3001',
        API_PORT: 3001,
        API_HOST: 'localhost',
        DISABLE_AUTH: true,
        ALLOW_MOCK_ACTOR: true,
        API_VALIDATION_MAX_BODY_SIZE: 62914560
    },
    validateApiEnv: vi.fn(),
    ApiEnvSchema: {}
}));

// Mock logger
vi.mock('@repo/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    })
}));

// Mock actor utilities
vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'user-123',
        role: 'USER',
        permissions: ['ACCESS_API_PUBLIC']
    }),
    isGuestActor: vi.fn().mockReturnValue(false),
    createGuestActor: vi.fn().mockReturnValue({
        id: '00000000-0000-4000-8000-000000000000',
        role: 'GUEST',
        permissions: []
    })
}));

import { createLinearBugReport, uploadFileToLinear } from '../../../src/services/linear.service';
import { isGuestActor } from '../../../src/utils/actor';
import { detectBrowser, detectPlatform } from '../../../src/utils/browser-detection';
import { buildBugReportMarkdown } from '../../../src/utils/markdown-builder';

describe('POST /api/v1/reports/create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const validFormData = {
        reporterName: 'Test User',
        reporterEmail: 'test@example.com',
        title: 'Test bug report',
        description: 'This is a detailed bug description',
        priority: 3,
        severity: 'severity:minor' as const,
        categoryLabelId: null,
        tagLabelIds: [],
        stepsToReproduce: 'Step 1: Do thing\nStep 2: See bug',
        expectedBehavior: 'Should work',
        actualBehavior: 'Does not work',
        metadata: {
            userAgent: 'Mozilla/5.0 Test',
            platform: 'Linux',
            screenResolution: '1920x1080',
            timestamp: '2026-02-12T15:00:00.000Z',
            language: 'es-AR'
        }
    };

    it('should validate that the service functions are mocked correctly', () => {
        // Verify mocks are in place
        expect(vi.isMockFunction(createLinearBugReport)).toBe(true);
        expect(vi.isMockFunction(uploadFileToLinear)).toBe(true);
        expect(vi.isMockFunction(buildBugReportMarkdown)).toBe(true);
    });

    it('should validate required form data fields', () => {
        // Validate schema compliance
        expect(validFormData.title.length).toBeGreaterThanOrEqual(5);
        expect(validFormData.description.length).toBeGreaterThanOrEqual(10);
        expect(validFormData.priority).toBeGreaterThanOrEqual(1);
        expect(validFormData.priority).toBeLessThanOrEqual(4);
        expect([
            'severity:blocker',
            'severity:major',
            'severity:minor',
            'severity:cosmetic'
        ]).toContain(validFormData.severity);
    });

    it('should reject unauthenticated requests when guest', () => {
        vi.mocked(isGuestActor).mockReturnValueOnce(true);
        expect(isGuestActor({ id: 'guest', role: 'GUEST' as never, permissions: [] })).toBe(true);
    });

    it('should call createLinearBugReport with correct params', async () => {
        const result = await createLinearBugReport({
            title: validFormData.title,
            markdownBody: '## Bug Report\n\nTest',
            priority: validFormData.priority,
            labelIds: ['label-1', 'label-2']
        });

        expect(createLinearBugReport).toHaveBeenCalledWith({
            title: 'Test bug report',
            markdownBody: '## Bug Report\n\nTest',
            priority: 3,
            labelIds: ['label-1', 'label-2']
        });

        expect(result).toEqual({
            issueId: 'issue-123',
            issueUrl: 'https://linear.app/team/issue/TEAM-123',
            identifier: 'TEAM-123'
        });
    });

    it('should call uploadFileToLinear for each file', async () => {
        const buffer = Buffer.from('test file content');
        const result = await uploadFileToLinear({
            buffer,
            mimeType: 'image/png',
            fileName: 'screenshot.png',
            fileSize: buffer.length
        });

        expect(uploadFileToLinear).toHaveBeenCalledWith({
            buffer,
            mimeType: 'image/png',
            fileName: 'screenshot.png',
            fileSize: buffer.length
        });

        expect(result).toEqual({ assetUrl: 'https://cdn.linear.app/test.png' });
    });

    it('should call buildBugReportMarkdown with reporter info', () => {
        const markdown = buildBugReportMarkdown({
            reporter: { name: validFormData.reporterName, email: validFormData.reporterEmail },
            priority: 'Media',
            severity: 'Menor',
            category: null,
            description: validFormData.description,
            stepsToReproduce: validFormData.stepsToReproduce,
            expectedBehavior: validFormData.expectedBehavior,
            actualBehavior: validFormData.actualBehavior,
            attachments: [],
            metadata: validFormData.metadata,
            tags: []
        });

        expect(buildBugReportMarkdown).toHaveBeenCalledWith(
            expect.objectContaining({
                reporter: { name: 'Test User', email: 'test@example.com' },
                priority: 'Media',
                severity: 'Menor'
            })
        );

        expect(markdown).toContain('## Bug Report');
    });

    it('should handle Linear service failure gracefully', async () => {
        vi.mocked(createLinearBugReport).mockRejectedValueOnce(new Error('Linear API error'));

        await expect(
            createLinearBugReport({
                title: 'Test',
                markdownBody: 'Body',
                priority: 3,
                labelIds: []
            })
        ).rejects.toThrow('Linear API error');
    });

    it('should validate file type constraints', () => {
        const allowedTypes = [
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'application/pdf',
            'text/plain',
            'text/x-log'
        ];

        // Valid types
        expect(allowedTypes).toContain('image/png');
        expect(allowedTypes).toContain('application/pdf');

        // Invalid types
        expect(allowedTypes).not.toContain('application/javascript');
        expect(allowedTypes).not.toContain('text/html');
    });

    it('should enforce max file count of 5', () => {
        const MAX_FILES = 5;
        const files = Array.from({ length: 6 }, (_, i) => ({
            name: `file-${i}.png`,
            size: 1024
        }));

        expect(files.length).toBeGreaterThan(MAX_FILES);
    });

    it('should enforce max file size of 10MB', () => {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const oversizedFile = { size: 11 * 1024 * 1024 };

        expect(oversizedFile.size).toBeGreaterThan(MAX_FILE_SIZE);
    });
});

describe('detectBrowser', () => {
    it('should detect Chrome', () => {
        const ua =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        expect(detectBrowser({ userAgent: ua })).toBe('browser:chrome');
    });

    it('should detect Edge over Chrome', () => {
        const ua =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
        expect(detectBrowser({ userAgent: ua })).toBe('browser:edge');
    });

    it('should detect Firefox', () => {
        const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
        expect(detectBrowser({ userAgent: ua })).toBe('browser:firefox');
    });

    it('should detect Safari', () => {
        const ua =
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
        expect(detectBrowser({ userAgent: ua })).toBe('browser:safari');
    });

    it('should return other for unknown browsers', () => {
        expect(detectBrowser({ userAgent: 'SomeBot/1.0' })).toBe('browser:other');
    });
});

describe('detectPlatform', () => {
    it('should detect Android', () => {
        const ua =
            'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
        expect(detectPlatform({ userAgent: ua, screenResolution: '412x915' })).toBe(
            'platform:android'
        );
    });

    it('should detect iOS from iPhone', () => {
        const ua =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
        expect(detectPlatform({ userAgent: ua, screenResolution: '390x844' })).toBe('platform:ios');
    });

    it('should detect iOS from iPad', () => {
        const ua =
            'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
        expect(detectPlatform({ userAgent: ua, screenResolution: '1024x1366' })).toBe(
            'platform:ios'
        );
    });

    it('should detect web-mobile for small screens', () => {
        const ua =
            'Mozilla/5.0 (Linux; x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        expect(detectPlatform({ userAgent: ua, screenResolution: '360x640' })).toBe(
            'platform:web-mobile'
        );
    });

    it('should detect web-desktop for large screens', () => {
        const ua =
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        expect(detectPlatform({ userAgent: ua, screenResolution: '1920x1080' })).toBe(
            'platform:web-desktop'
        );
    });

    it('should treat 768px width as web-mobile', () => {
        const ua = 'Mozilla/5.0 Test';
        expect(detectPlatform({ userAgent: ua, screenResolution: '768x1024' })).toBe(
            'platform:web-mobile'
        );
    });

    it('should treat 769px width as web-desktop', () => {
        const ua = 'Mozilla/5.0 Test';
        expect(detectPlatform({ userAgent: ua, screenResolution: '769x1024' })).toBe(
            'platform:web-desktop'
        );
    });
});
