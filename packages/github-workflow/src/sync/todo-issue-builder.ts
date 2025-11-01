/**
 * Issue builder for TODO comments
 *
 * Generates GitHub issue titles and bodies for code comments (TODO, HACK, DEBUG).
 * Formats issues with rich context including file paths, line numbers, and metadata.
 *
 * @module sync/todo-issue-builder
 */

import type { CodeComment } from '../parsers/types.js';

/**
 * Input for building TODO issue title
 */
export type BuildTodoIssueTitleInput = {
    /** Code comment to build title for */
    comment: CodeComment;
};

/**
 * Input for building TODO issue body
 */
export type BuildTodoIssueBodyInput = {
    /** Code comment to build body for */
    comment: CodeComment;

    /** GitHub repository owner */
    owner: string;

    /** GitHub repository name */
    repo: string;
};

/**
 * Build issue title for code comment
 *
 * Generates concise title in format: `[TYPE] file/path.ts:lineNumber`
 * This allows quick identification of comment location in issue list.
 *
 * @param input - Title building input
 * @param input.comment - Code comment to build title for
 * @returns Formatted issue title
 *
 * @example
 * ```typescript
 * const title = buildTodoIssueTitle({
 *   comment: {
 *     type: 'TODO',
 *     filePath: 'src/auth.ts',
 *     lineNumber: 42,
 *     content: 'Add validation'
 *   }
 * });
 * // Returns: "[TODO] src/auth.ts:42"
 * ```
 */
export function buildTodoIssueTitle(input: BuildTodoIssueTitleInput): string {
    const { comment } = input;
    return `[${comment.type}] ${comment.filePath}:${comment.lineNumber}`;
}

/**
 * Build issue body for code comment
 *
 * Generates comprehensive issue description with:
 * - Comment type and content
 * - File location and line number
 * - Priority, assignee, labels (if available)
 * - Code context snippet
 * - Direct link to source code
 *
 * @param input - Body building input
 * @param input.comment - Code comment to build body for
 * @param input.owner - GitHub repository owner
 * @param input.repo - GitHub repository name
 * @returns Formatted issue body in Markdown
 *
 * @example
 * ```typescript
 * const body = buildTodoIssueBody({
 *   comment: {
 *     type: 'TODO',
 *     content: 'Fix bug',
 *     filePath: 'src/api.ts',
 *     lineNumber: 100,
 *     priority: 'high'
 *   },
 *   owner: 'hospeda',
 *   repo: 'main'
 * });
 * ```
 */
export function buildTodoIssueBody(input: BuildTodoIssueBodyInput): string {
    const { comment, owner, repo } = input;

    const sections: string[] = [];

    // Header with comment type and content
    sections.push(`## ${comment.type}: ${comment.content}`);
    sections.push('');

    // Basic info
    sections.push(`**Type:** ${comment.type}`);
    sections.push(`**File:** ${comment.filePath}`);
    sections.push(`**Line:** ${comment.lineNumber}`);
    sections.push('');

    // Details section (only if metadata exists)
    const hasDetails = comment.priority || comment.assignee || comment.labels?.length;
    if (hasDetails) {
        sections.push('### Details');
        if (comment.priority) {
            sections.push(`- **Priority:** ${comment.priority}`);
        }
        if (comment.assignee) {
            sections.push(`- **Assignee:** @${comment.assignee}`);
        }
        if (comment.labels?.length) {
            sections.push(`- **Labels:** ${comment.labels.join(', ')}`);
        }
        sections.push('');
    }

    // Code context
    sections.push('### Code Context');
    sections.push('```typescript');
    sections.push(`// Line ${comment.lineNumber}`);
    sections.push(comment.content);
    sections.push('```');
    sections.push('');

    // Source links
    const githubUrl = `https://github.com/${owner}/${repo}/blob/main/${comment.filePath}#L${comment.lineNumber}`;
    sections.push('### Source');
    sections.push(`- **Repository:** ${owner}/${repo}`);
    sections.push(`- **File:** \`${comment.filePath}\``);
    sections.push(`- **Line:** [${comment.lineNumber}](${githubUrl})`);
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('*Auto-generated from code comment by @repo/github-workflow*');

    return sections.join('\n');
}
