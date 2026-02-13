/**
 * Attachment information for bug reports.
 */
export interface AttachmentInfo {
    fileName: string;
    assetUrl: string;
}

/**
 * Browser and environment metadata for bug reports.
 */
export interface BrowserMetadata {
    userAgent: string;
    platform: string;
    screenResolution: string;
    timestamp: string;
    language: string;
}

/**
 * Parameters for building a bug report markdown document.
 */
export interface BuildMarkdownParams {
    reporter: { name: string; email: string };
    priority: string;
    severity: string;
    category: string | null;
    description: string;
    stepsToReproduce: string | null;
    expectedBehavior: string | null;
    actualBehavior: string | null;
    attachments: readonly AttachmentInfo[];
    metadata: BrowserMetadata;
    tags: readonly string[];
}

/**
 * Builds a formatted Markdown document for a Linear bug report issue.
 *
 * Constructs a comprehensive bug report with all relevant information including
 * reporter details, priority/severity, description, reproduction steps, behaviors,
 * attachments, metadata, and tags. The output is formatted for Linear's markdown
 * support including HTML details/summary elements.
 *
 * @param params - Bug report parameters
 * @returns Formatted markdown string ready for Linear issue creation
 *
 * @example
 * ```ts
 * const markdown = buildBugReportMarkdown({
 *   reporter: { name: "John Doe", email: "john@example.com" },
 *   priority: "High",
 *   severity: "Critical",
 *   category: "UI/UX",
 *   description: "Button does not respond to clicks",
 *   stepsToReproduce: "1. Navigate to dashboard\n2. Click submit button",
 *   expectedBehavior: "Form should submit",
 *   actualBehavior: "Nothing happens",
 *   attachments: [{ fileName: "screenshot.png", assetUrl: "https://..." }],
 *   metadata: {
 *     userAgent: "Mozilla/5.0...",
 *     platform: "Linux x86_64",
 *     screenResolution: "1920x1080",
 *     timestamp: "2026-02-12T10:30:00Z",
 *     language: "es-ES"
 *   },
 *   tags: ["bug", "ui"]
 * });
 * ```
 */
export function buildBugReportMarkdown({
    reporter,
    priority,
    severity,
    category,
    description,
    stepsToReproduce,
    expectedBehavior,
    actualBehavior,
    attachments,
    metadata,
    tags
}: BuildMarkdownParams): string {
    const sections: string[] = [];

    // Header section
    sections.push('## Bug Report');
    sections.push('');
    sections.push(`**Reporter:** ${reporter.name} (${reporter.email})`);
    sections.push(`**Priority:** ${priority} | **Severity:** ${severity}`);
    sections.push(`**Category:** ${category ?? 'Not specified'}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Description
    sections.push('### Description');
    sections.push(description);
    sections.push('');

    // Steps to Reproduce
    sections.push('### Steps to Reproduce');
    sections.push(stepsToReproduce ?? 'Not provided');
    sections.push('');

    // Expected Behavior
    sections.push('### Expected Behavior');
    sections.push(expectedBehavior ?? 'Not provided');
    sections.push('');

    // Actual Behavior
    sections.push('### Actual Behavior');
    sections.push(actualBehavior ?? 'Not provided');
    sections.push('');

    // Attachments
    sections.push('### Attachments');
    if (attachments.length === 0) {
        sections.push('No attachments');
    } else {
        for (const attachment of attachments) {
            sections.push(`- [${attachment.fileName}](${attachment.assetUrl})`);
        }
    }
    sections.push('');
    sections.push('---');
    sections.push('');

    // Metadata table
    sections.push('<details>');
    sections.push('<summary>Form Submission Metadata</summary>');
    sections.push('');
    sections.push('| Field | Value |');
    sections.push('|-------|-------|');
    sections.push(`| Browser | ${metadata.userAgent} |`);
    sections.push(`| OS | ${metadata.platform} |`);
    sections.push(`| Screen | ${metadata.screenResolution} |`);
    sections.push(`| Language | ${metadata.language} |`);
    sections.push(`| Timestamp | ${metadata.timestamp} |`);
    sections.push('');
    sections.push('</details>');

    // Tags (only if present)
    if (tags.length > 0) {
        sections.push('');
        sections.push('### Tags');
        sections.push(tags.join(', '));
    }

    return sections.join('\n');
}
