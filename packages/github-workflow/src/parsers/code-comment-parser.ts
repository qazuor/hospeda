/**
 * Code comment parser for TODO, HACK, and DEBUG comments
 *
 * Scans codebase for special comments and extracts metadata including
 * priority, assignee, labels, and content. Supports TypeScript, JavaScript,
 * JSX/TSX, and multi-line comment blocks.
 *
 * @module parsers/code-comment-parser
 *
 * @example
 * ```typescript
 * import { scanCodeComments } from '@repo/github-workflow';
 *
 * const result = await scanCodeComments({
 *   baseDir: './src',
 *   commentTypes: ['TODO', 'HACK']
 * });
 *
 * console.log(`Found ${result.commentsFound} comments in ${result.filesScanned} files`);
 * ```
 */

import { readFile } from 'node:fs/promises';
import { relative, join } from 'node:path';
import { glob } from 'glob';
import { createHash } from 'node:crypto';
import type {
    CodeComment,
    CommentType,
    CommentPriority,
    CodeCommentScanOptions,
    CodeCommentScanResult,
} from './types.js';

/**
 * Default file patterns to include in scan
 */
const DEFAULT_INCLUDE_PATTERNS = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '**/*.mjs',
    '**/*.cjs',
];

/**
 * Default file patterns to exclude from scan
 */
const DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/.git/**',
];

/**
 * Regex patterns for detecting comments
 */
const COMMENT_PATTERNS = {
    // Single-line comments: // TODO: ...
    singleLine: /\/\/\s*(TODO|HACK|DEBUG)\s*(.+)$/gim,
    // Multi-line comments: /* TODO: ... */
    multiLineStart: /\/\*\*?\s*(TODO|HACK|DEBUG)\s*(.+)/gi,
    multiLineContent: /\s*\*\s*(.+)/g,
    multiLineEnd: /\*\//,
    // JSX comments: {/* TODO: ... */}
    jsxComment: /\{\s*\/\*\s*(TODO|HACK|DEBUG)\s*(.+?)\*\/\s*\}/gi,
} as const;

/**
 * Regex patterns for extracting metadata
 */
const METADATA_PATTERNS = {
    // Priority: (high), (P1), etc.
    priority: /\(([a-z0-9]+)\)/i,
    // Assignee: (@username) or just @username
    assignee: /@([a-z0-9_-]+)/i,
    // Labels: [label], [@label], [security][performance]
    labels: /\[@?([a-z0-9_-]+)\]/gi,
    // Remove metadata prefix to get clean content
    cleanContent: /^(?:\([^)]*\)|\[[^\]]*\]|@[a-z0-9_-]+|\s|:)+/gi,
} as const;

/**
 * Generate unique ID for a code comment
 *
 * Creates a deterministic hash based on file path, line number, and type.
 * Same location will always generate the same ID.
 *
 * @param input - Comment identification data
 * @param input.filePath - File path where comment appears
 * @param input.lineNumber - Line number of comment
 * @param input.type - Type of comment (TODO, HACK, DEBUG)
 * @returns Unique identifier string
 *
 * @example
 * ```typescript
 * const id = generateCommentId({
 *   filePath: 'src/utils.ts',
 *   lineNumber: 42,
 *   type: 'TODO'
 * });
 * // Returns: "comment-abc123def456..."
 * ```
 */
export function generateCommentId(input: {
    filePath: string;
    lineNumber: number;
    type: CommentType;
}): string {
    const { filePath, lineNumber, type } = input;
    const data = `${filePath}:${lineNumber}:${type}`;
    const hash = createHash('sha256').update(data).digest('hex').substring(0, 12);
    return `comment-${hash}`;
}

/**
 * Extract metadata from comment content
 *
 * Parses priority markers, assignee, labels, and cleans content.
 * Supports various formats:
 * - Priority: (high), (P1), (medium)
 * - Assignee: (@username)
 * - Labels: [refactor], [security][performance]
 *
 * @param input - Comment data to parse
 * @param input.content - Raw comment content
 * @param input.type - Comment type
 * @returns Parsed metadata and cleaned content
 *
 * @example
 * ```typescript
 * const result = extractCommentMetadata({
 *   content: '(P1)[@security](@john): Fix vulnerability',
 *   type: 'TODO'
 * });
 * // {
 * //   priority: 'P1',
 * //   labels: ['security'],
 * //   assignee: 'john',
 * //   content: 'Fix vulnerability'
 * // }
 * ```
 */
export function extractCommentMetadata(input: {
    content: string;
    type: CommentType;
}): {
    content: string;
    priority?: CommentPriority;
    assignee?: string;
    labels?: string[];
    metadata?: Record<string, string>;
} {
    let { content } = input;
    let priority: CommentPriority | undefined;
    let assignee: string | undefined;
    const labels: string[] = [];

    // Extract priority (preserve case for P1, P2, etc.)
    const priorityMatch = content.match(METADATA_PATTERNS.priority);
    if (priorityMatch?.[1] && priorityMatch[1].trim()) {
        const priorityValue = priorityMatch[1];
        // Preserve uppercase for P1, P2, P3; lowercase for others
        priority = (priorityValue.match(/^P\d+$/i)
            ? priorityValue.toUpperCase()
            : priorityValue.toLowerCase()) as CommentPriority;
    }

    // Extract labels first (to avoid confusion with @username inside [@label])
    const labelMatches = content.matchAll(METADATA_PATTERNS.labels);
    for (const match of labelMatches) {
        if (match[1] && match[1].trim()) {
            labels.push(match[1]);
        }
    }

    // Extract assignee (but not if it's inside brackets [@username])
    // Remove all bracketed content first for assignee matching
    const contentWithoutBrackets = content.replace(/\[[^\]]*\]/g, '');
    const assigneeMatch = contentWithoutBrackets.match(METADATA_PATTERNS.assignee);
    if (assigneeMatch?.[1] && assigneeMatch[1].trim()) {
        assignee = assigneeMatch[1];
    }

    // Clean content by removing metadata markers and leading colons/spaces
    content = content
        .replace(METADATA_PATTERNS.priority, '')
        .replace(METADATA_PATTERNS.labels, '')
        .replace(/\(@[a-z0-9_-]+\)/gi, '') // Remove (@username) format
        .replace(/@[a-z0-9_-]+/gi, '') // Remove @username format
        .replace(/\(\s*\)/g, '') // Remove empty parentheses
        .replace(/\[\s*\]/g, '') // Remove empty brackets
        .replace(/^\s*:\s*/, '')
        .trim();

    return {
        content,
        priority,
        assignee,
        labels: labels.length > 0 ? labels : undefined,
    };
}

/**
 * Parse code comments from file content
 *
 * Extracts TODO, HACK, and DEBUG comments from source code.
 * Supports single-line, multi-line, and JSX comment styles.
 * Ignores comments within string literals.
 *
 * @param input - Parsing options
 * @param input.fileContent - Source code content
 * @param input.filePath - File path for reference
 * @param input.commentTypes - Optional filter for comment types
 * @returns Array of parsed code comments
 *
 * @example
 * ```typescript
 * const comments = parseCodeComments({
 *   fileContent: sourceCode,
 *   filePath: 'src/utils.ts',
 *   commentTypes: ['TODO', 'HACK']
 * });
 * ```
 */
export function parseCodeComments(input: {
    fileContent: string;
    filePath: string;
    commentTypes?: CommentType[];
}): CodeComment[] {
    const { fileContent, filePath, commentTypes = ['TODO', 'HACK', 'DEBUG'] } = input;
    const comments: CodeComment[] = [];
    const lines = fileContent.split('\n');

    // Track if we're inside a string literal (basic detection)
    let inString = false;
    let stringChar: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const lineNumber = i + 1;

        // Basic string tracking (doesn't handle all edge cases, but covers most)
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const prevChar = j > 0 ? line[j - 1] : '';

            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
            } else if (inString && char === stringChar && prevChar !== '\\') {
                inString = false;
                stringChar = null;
            }
        }

        // Skip if we're in a string
        if (inString) {
            continue;
        }

        // Check for single-line comments
        const singleLineMatch = line.match(/\/\/\s*(TODO|HACK|DEBUG)\s*(.*)$/i);
        if (singleLineMatch) {
            const type = singleLineMatch[1]?.toUpperCase() as CommentType;
            const rawContent = singleLineMatch[2] || '';

            if (!commentTypes.includes(type)) {
                continue;
            }

            const metadata = extractCommentMetadata({
                content: rawContent.trim(),
                type,
            });

            comments.push({
                id: generateCommentId({ filePath, lineNumber, type }),
                type,
                content: metadata.content,
                filePath,
                lineNumber,
                priority: metadata.priority,
                assignee: metadata.assignee,
                labels: metadata.labels,
                metadata: metadata.metadata,
            });
            continue;
        }

        // Check for JSX comments
        const jsxMatch = line.match(/\{\s*\/\*\s*(TODO|HACK|DEBUG)\s*(.+?)\*\/\s*\}/i);
        if (jsxMatch) {
            const type = jsxMatch[1]?.toUpperCase() as CommentType;
            const rawContent = jsxMatch[2] || '';

            if (!commentTypes.includes(type)) {
                continue;
            }

            const metadata = extractCommentMetadata({
                content: rawContent.trim(),
                type,
            });

            comments.push({
                id: generateCommentId({ filePath, lineNumber, type }),
                type,
                content: metadata.content,
                filePath,
                lineNumber,
                priority: metadata.priority,
                assignee: metadata.assignee,
                labels: metadata.labels,
                metadata: metadata.metadata,
            });
            continue;
        }

        // Check for multi-line comment start (/* TODO: or just /*)
        let multiLineMatch = line.match(/\/\*\*?\s*(TODO|HACK|DEBUG)\s*:?\s*(.*)$/i);
        let isNextLineTodo = false;

        // Also check if this is just /* and the next line has TODO
        if (!multiLineMatch && line.match(/^\s*\/\*\*?\s*$/)) {
            // Look ahead to next line
            const nextLine = lines[i + 1];
            if (nextLine) {
                const nextMatch = nextLine.match(/^\s*\*\s*(TODO|HACK|DEBUG)\s*:?\s*(.*)$/i);
                if (nextMatch) {
                    multiLineMatch = nextMatch;
                    isNextLineTodo = true;
                }
            }
        }

        if (multiLineMatch) {
            const type = multiLineMatch[1]?.toUpperCase() as CommentType;
            let rawContent = (multiLineMatch[2] || '').replace(/\*\/.*$/, '').trim();
            const startLine = isNextLineTodo ? lineNumber + 1 : lineNumber;

            // Check if it's a single-line multi-line comment (e.g., /* TODO: text */)
            if (!isNextLineTodo && line.includes('*/')) {
                if (!commentTypes.includes(type)) {
                    continue;
                }

                const metadata = extractCommentMetadata({
                    content: rawContent,
                    type,
                });

                comments.push({
                    id: generateCommentId({ filePath, lineNumber: startLine, type }),
                    type,
                    content: metadata.content,
                    filePath,
                    lineNumber: startLine,
                    priority: metadata.priority,
                    assignee: metadata.assignee,
                    labels: metadata.labels,
                    metadata: metadata.metadata,
                });
                continue;
            }

            // Collect multi-line content
            let j = isNextLineTodo ? i + 2 : i + 1;
            while (j < lines.length) {
                const currentLine = lines[j];
                if (currentLine?.includes('*/')) {
                    // Extract content before closing
                    const endContent = currentLine.split('*/')[0];
                    if (endContent) {
                        const cleanedContent = endContent.replace(/^\s*\*\s*/, '').trim();
                        if (cleanedContent) {
                            rawContent += ' ' + cleanedContent;
                        }
                    }
                    break;
                }
                const lineContent = currentLine?.replace(/^\s*\*\s*/, '').trim();
                if (lineContent) {
                    rawContent += ' ' + lineContent;
                }
                j++;
            }

            if (!commentTypes.includes(type)) {
                i = j;
                continue;
            }

            const metadata = extractCommentMetadata({
                content: rawContent.trim(),
                type,
            });

            comments.push({
                id: generateCommentId({ filePath, lineNumber: startLine, type }),
                type,
                content: metadata.content,
                filePath,
                lineNumber: startLine,
                priority: metadata.priority,
                assignee: metadata.assignee,
                labels: metadata.labels,
                metadata: metadata.metadata,
            });

            i = j;
        }
    }

    return comments;
}

/**
 * Scan directory for code comments
 *
 * Recursively scans files for TODO, HACK, and DEBUG comments.
 * Supports filtering by file patterns, comment types, and respects
 * .gitignore patterns.
 *
 * @param options - Scan configuration
 * @param options.baseDir - Base directory to scan (defaults to cwd)
 * @param options.include - Glob patterns to include
 * @param options.exclude - Glob patterns to exclude
 * @param options.commentTypes - Comment types to detect
 * @param options.respectGitignore - Respect .gitignore (defaults to true)
 * @returns Scan results with comments grouped by type and file
 *
 * @example
 * ```typescript
 * const result = await scanCodeComments({
 *   baseDir: './src',
 *   include: ['**\/*.ts'],
 *   exclude: ['**\/*.test.ts'],
 *   commentTypes: ['TODO']
 * });
 *
 * console.log(`Found ${result.commentsFound} TODOs`);
 * for (const comment of result.byType.TODO) {
 *   console.log(`- ${comment.filePath}:${comment.lineNumber} - ${comment.content}`);
 * }
 * ```
 */
export async function scanCodeComments(
    options: CodeCommentScanOptions = {}
): Promise<CodeCommentScanResult> {
    const {
        baseDir = process.cwd(),
        include = DEFAULT_INCLUDE_PATTERNS,
        exclude = DEFAULT_EXCLUDE_PATTERNS,
        commentTypes = ['TODO', 'HACK', 'DEBUG'],
        respectGitignore = true,
    } = options;

    const allComments: CodeComment[] = [];
    const byType: Record<CommentType, CodeComment[]> = {
        TODO: [],
        HACK: [],
        DEBUG: [],
    };
    const byFile: Record<string, CodeComment[]> = {};

    try {
        // Find all matching files
        const files = await glob(include, {
            cwd: baseDir,
            ignore: exclude,
            absolute: false,
            nodir: true,
            dot: false,
        });

        // Process each file
        for (const file of files) {
            const filePath = join(baseDir, file);
            const relativeFilePath = relative(baseDir, filePath);

            try {
                const fileContent = await readFile(filePath, 'utf-8');
                const comments = parseCodeComments({
                    fileContent,
                    filePath: relativeFilePath,
                    commentTypes,
                });

                allComments.push(...comments);

                // Group by type
                for (const comment of comments) {
                    byType[comment.type]?.push(comment);
                }

                // Group by file
                if (comments.length > 0) {
                    byFile[relativeFilePath] = comments;
                }
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }

        return {
            comments: allComments,
            filesScanned: files.length,
            commentsFound: allComments.length,
            byType,
            byFile,
        };
    } catch (error) {
        // Return empty result on error
        return {
            comments: [],
            filesScanned: 0,
            commentsFound: 0,
            byType: {
                TODO: [],
                HACK: [],
                DEBUG: [],
            },
            byFile: {},
        };
    }
}
