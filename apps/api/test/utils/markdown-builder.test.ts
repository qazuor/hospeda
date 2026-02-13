import { describe, expect, it } from 'vitest';
import {
    type AttachmentInfo,
    type BrowserMetadata,
    type BuildMarkdownParams,
    buildBugReportMarkdown
} from '../../src/utils/markdown-builder';

describe('buildBugReportMarkdown', () => {
    const mockMetadata: BrowserMetadata = {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        platform: 'Linux x86_64',
        screenResolution: '1920x1080',
        timestamp: '2026-02-12T10:30:00Z',
        language: 'es-ES'
    };

    it('should build complete markdown with all fields', () => {
        // Arrange
        const attachments: AttachmentInfo[] = [
            { fileName: 'screenshot.png', assetUrl: 'https://example.com/file1.png' }
        ];

        const params: BuildMarkdownParams = {
            reporter: { name: 'John Doe', email: 'john@example.com' },
            priority: 'High',
            severity: 'Critical',
            category: 'UI/UX',
            description: 'Button does not respond to clicks',
            stepsToReproduce: '1. Navigate to dashboard\n2. Click submit button',
            expectedBehavior: 'Form should submit',
            actualBehavior: 'Nothing happens',
            attachments,
            metadata: mockMetadata,
            tags: ['bug', 'ui']
        };

        // Act
        const result = buildBugReportMarkdown(params);

        // Assert
        expect(result).toContain('## Bug Report');
        expect(result).toContain('**Reporter:** John Doe (john@example.com)');
        expect(result).toContain('**Priority:** High | **Severity:** Critical');
        expect(result).toContain('**Category:** UI/UX');
        expect(result).toContain('### Description');
        expect(result).toContain('Button does not respond to clicks');
        expect(result).toContain('### Steps to Reproduce');
        expect(result).toContain('1. Navigate to dashboard');
        expect(result).toContain('### Expected Behavior');
        expect(result).toContain('Form should submit');
        expect(result).toContain('### Actual Behavior');
        expect(result).toContain('Nothing happens');
        expect(result).toContain('### Attachments');
        expect(result).toContain('[screenshot.png](https://example.com/file1.png)');
        expect(result).toContain('<details>');
        expect(result).toContain('<summary>Form Submission Metadata</summary>');
        expect(result).toContain('| Browser | Mozilla/5.0 (X11; Linux x86_64) |');
        expect(result).toContain('| OS | Linux x86_64 |');
        expect(result).toContain('### Tags');
        expect(result).toContain('bug, ui');
    });

    it('should handle null optional fields', () => {
        // Arrange
        const params: BuildMarkdownParams = {
            reporter: { name: 'Jane Smith', email: 'jane@example.com' },
            priority: 'Medium',
            severity: 'Minor',
            category: null,
            description: 'Something is broken',
            stepsToReproduce: null,
            expectedBehavior: null,
            actualBehavior: null,
            attachments: [],
            metadata: mockMetadata,
            tags: []
        };

        // Act
        const result = buildBugReportMarkdown(params);

        // Assert
        expect(result).toContain('**Category:** Not specified');
        expect(result).toContain('### Steps to Reproduce');
        expect(result).toContain('Not provided');
        expect(result).toContain('### Expected Behavior');
        expect(result).toContain('Not provided');
        expect(result).toContain('### Actual Behavior');
        expect(result).toContain('Not provided');
    });

    it('should show "No attachments" when no files', () => {
        // Arrange
        const params: BuildMarkdownParams = {
            reporter: { name: 'Test User', email: 'test@example.com' },
            priority: 'Low',
            severity: 'Trivial',
            category: 'Performance',
            description: 'Page loads slowly',
            stepsToReproduce: 'Navigate to homepage',
            expectedBehavior: 'Fast load',
            actualBehavior: 'Slow load',
            attachments: [],
            metadata: mockMetadata,
            tags: ['performance']
        };

        // Act
        const result = buildBugReportMarkdown(params);

        // Assert
        expect(result).toContain('### Attachments');
        expect(result).toContain('No attachments');
    });

    it('should omit tags section when no tags', () => {
        // Arrange
        const params: BuildMarkdownParams = {
            reporter: { name: 'Test User', email: 'test@example.com' },
            priority: 'Low',
            severity: 'Trivial',
            category: 'Performance',
            description: 'Page loads slowly',
            stepsToReproduce: 'Navigate to homepage',
            expectedBehavior: 'Fast load',
            actualBehavior: 'Slow load',
            attachments: [],
            metadata: mockMetadata,
            tags: []
        };

        // Act
        const result = buildBugReportMarkdown(params);

        // Assert
        expect(result).not.toContain('### Tags');
    });

    it('should include multiple attachments as links', () => {
        // Arrange
        const attachments: AttachmentInfo[] = [
            { fileName: 'file1.png', assetUrl: 'https://example.com/url1' },
            { fileName: 'file2.pdf', assetUrl: 'https://example.com/url2' }
        ];

        const params: BuildMarkdownParams = {
            reporter: { name: 'Test User', email: 'test@example.com' },
            priority: 'Medium',
            severity: 'Moderate',
            category: 'Documentation',
            description: 'Broken links in docs',
            stepsToReproduce: 'Click docs link',
            expectedBehavior: 'Page loads',
            actualBehavior: '404 error',
            attachments,
            metadata: mockMetadata,
            tags: ['docs']
        };

        // Act
        const result = buildBugReportMarkdown(params);

        // Assert
        expect(result).toContain('[file1.png](https://example.com/url1)');
        expect(result).toContain('[file2.pdf](https://example.com/url2)');
    });
});
