/**
 * Parser for TODO/HACK/DEBUG comments in source code
 */

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { CommentType, ParsedComment } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Regular expressions for parsing comments
 */
const COMMENT_PATTERNS = {
    // Matches: // TODO [id]: title @user #label
    main: /^\/\/\s*(todo|hack|debug)(\s*\[([a-f0-9-]+)\])?\s*:\s*(.+?)(?:\s+@(\w+))?(?:\s+#([\w-]+))?$/i,
    // Matches: // DESC: description
    description: /^\/\/\s*desc\s*:\s*(.+)$/i,
    // Matches: // NO ISSUE
    noIssue: /^\/\/\s*no\s+issue\s*$/i
};

/**
 * Parses TODO/HACK/DEBUG comments from source files
 */
export class CommentParser {
    private readonly projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    /**
     * Parses all comments from a file
     */
    parseFile(filePath: string): ParsedComment[] {
        try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const relativePath = relative(this.projectRoot, filePath);

            return this.parseLines(lines, relativePath);
        } catch (error) {
            logger.warn(`Warning: Could not read file ${filePath}: ${error}`);
            return [];
        }
    }

    /**
     * Parses lines of code for TODO comments
     */
    private parseLines(lines: string[], filePath: string): ParsedComment[] {
        const comments: ParsedComment[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            // Check for NO ISSUE directive on previous line
            const previousLine = i > 0 ? lines[i - 1] : null;
            if (previousLine && COMMENT_PATTERNS.noIssue.test(previousLine.trim())) {
                continue; // Skip this TODO
            }

            const parsedComment = this.parseLine(line, i + 1, filePath);
            if (parsedComment) {
                // Check for description on next line
                const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
                if (nextLine) {
                    const description = this.parseDescriptionLine(nextLine);
                    if (description) {
                        parsedComment.description = description;
                    }
                }

                comments.push(parsedComment);
            }
        }

        return comments;
    }

    /**
     * Parses a single line for TODO comment
     */
    private parseLine(line: string, lineNumber: number, filePath: string): ParsedComment | null {
        const trimmedLine = line.trim();
        const match = COMMENT_PATTERNS.main.exec(trimmedLine);

        if (!match) return null;

        const [, typeRaw, , issueId, title, assignee, label] = match;

        if (!typeRaw || !title) return null;

        // Extract indentation
        const indentationMatch = /^(\s*)/.exec(line);
        const indentation = indentationMatch ? indentationMatch[1] : '';

        return {
            type: typeRaw.toLowerCase() as CommentType,
            filePath,
            line: lineNumber,
            title: title.trim(),
            assignee: assignee || undefined,
            label: label || undefined,
            issueId: issueId || undefined,
            indentation
        };
    }

    /**
     * Parses a description line
     */
    private parseDescriptionLine(line: string): string | null {
        const match = COMMENT_PATTERNS.description.exec(line.trim());
        if (!match || !match[1]) return null;
        return match[1].trim();
    }

    /**
     * Generates an updated comment string with issue ID
     */
    generateUpdatedComment(comment: ParsedComment, issueId?: string): string {
        const { type, title, assignee, label, indentation = '' } = comment;

        let commentStr = `// ${type.toUpperCase()}`;

        // Add issue ID if provided
        if (issueId) {
            commentStr += ` [${issueId}]`;
        }

        commentStr += `: ${title}`;

        // Add assignee if present
        if (assignee) {
            commentStr += ` @${assignee}`;
        }

        // Add label if present
        if (label) {
            commentStr += ` #${label}`;
        }

        return indentation + commentStr;
    }

    /**
     * Checks if a comment is already linked to a Linear issue
     */
    isLinkedComment(comment: ParsedComment): boolean {
        return !!comment.issueId;
    }

    /**
     * Extracts issue ID from a comment
     */
    extractIssueId(comment: ParsedComment): string | null {
        return comment.issueId || null;
    }

    /**
     * Updates a comment in a file with a new issue ID
     */
    async updateCommentInFile(comment: ParsedComment, issueId: string): Promise<void> {
        try {
            const filePath = comment.filePath.startsWith('/')
                ? comment.filePath
                : `${this.projectRoot}/${comment.filePath}`;

            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            if (comment.line > lines.length) {
                throw new Error(`Line ${comment.line} does not exist in file ${comment.filePath}`);
            }

            // Get the current line to preserve its original indentation
            const lineIndex = comment.line - 1;
            const currentLine = lines[lineIndex] || '';

            // Extract the original indentation from the current line
            const indentationMatch = /^(\s*)/.exec(currentLine);
            const originalIndentation = indentationMatch ? indentationMatch[1] : '';

            // Create a new comment object with the preserved indentation
            const commentWithCorrectIndentation = {
                ...comment,
                indentation: originalIndentation
            };

            // Update the specific line with preserved indentation
            lines[lineIndex] = this.generateUpdatedComment(commentWithCorrectIndentation, issueId);

            const updatedContent = lines.join('\n');
            const { writeFileSync } = await import('node:fs');
            writeFileSync(filePath, updatedContent, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to update comment in file: ${error}`);
        }
    }

    /**
     * Removes issue ID from a comment in a file
     */
    async removeIssueIdFromFile(comment: ParsedComment): Promise<void> {
        await this.updateCommentInFile(comment, '');
    }

    /**
     * Creates a comment key for tracking
     */
    static generateCommentKey(comment: ParsedComment): string {
        return `${comment.filePath}:${comment.line}:${comment.title?.toLowerCase().trim() || ''}`;
    }
}
