/**
 * Linear API client for managing issues
 */

import { relative, resolve } from 'node:path';
import { LinearClient } from '@linear/sdk';
import type { ParsedComment, TodoLinearConfig } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Separator used to divide tool-managed content from user-managed content in Linear issues
 */
const CONTENT_SEPARATOR = '\n\n---\n\n';
const SEPARATOR_MARKER = '---';

/**
 * Client for interacting with Linear API
 */
export class TodoLinearClient {
    private readonly client: LinearClient;
    private readonly config: TodoLinearConfig;
    private readonly labelCache = new Map<string, string>();

    constructor(config: TodoLinearConfig) {
        this.client = new LinearClient({ apiKey: config.linearApiKey });
        this.config = config;
    }

    /**
     * Creates a new Linear issue from a TODO comment
     */
    async createIssue(comment: ParsedComment): Promise<string> {
        const issueData = await this.buildCreateIssueData(comment);
        const result = await this.client.createIssue(issueData);

        if (!result.success) {
            throw new Error('Failed to create issue: Unknown error');
        }

        const issue = await result.issue;
        const issueId = issue?.id;

        if (!issueId) {
            throw new Error('No issue ID returned from Linear API');
        }

        return issueId;
    }

    /**
     * Updates an existing Linear issue
     */
    async updateIssue(comment: ParsedComment): Promise<boolean> {
        if (!comment.issueId) {
            throw new Error('Comment must have an issue ID to update');
        }

        const updateData = await this.buildUpdateIssueData(comment);
        const result = await this.client.updateIssue(comment.issueId, updateData);

        return result.success;
    }

    /**
     * Archives a Linear issue
     */
    async archiveIssue(issueId: string): Promise<boolean> {
        try {
            // Get team workflow states to find a "done" or "closed" state
            const states = await this.client.workflowStates({
                filter: { team: { id: { eq: this.config.linearTeamId } } }
            });

            // Find a state that represents completion
            const doneState = states.nodes.find(
                (state) =>
                    state.name.toLowerCase().includes('done') ||
                    state.name.toLowerCase().includes('closed') ||
                    state.name.toLowerCase().includes('complete')
            );

            if (!doneState) {
                throw new Error('No suitable completion state found for archiving');
            }

            // Update the issue to the done state
            const result = await this.client.updateIssue(issueId, {
                stateId: doneState.id
            });

            return result.success;
        } catch (error) {
            logger.error(`Failed to archive issue ${issueId}:`, error);
            return false;
        }
    }

    /**
     * Checks if an issue exists in Linear
     */
    async issueExists(issueId: string): Promise<boolean> {
        try {
            const issue = await this.client.issue(issueId);
            return !!issue.id && !issue.archivedAt;
        } catch {
            return false;
        }
    }

    /**
     * Builds create issue data
     */
    private async buildCreateIssueData(comment: ParsedComment) {
        const labels = await this.resolveLabels(comment);
        const assigneeId = await this.resolveAssignee(comment);
        const description = this.buildIssueDescription(comment);

        return {
            teamId: this.config.linearTeamId,
            title: comment.title,
            description,
            assigneeId,
            labelIds: labels,
            priority: 3 // Normal priority
        };
    }

    /**
     * Builds update issue data, preserving user content
     */
    private async buildUpdateIssueData(comment: ParsedComment) {
        const labels = await this.resolveLabels(comment);
        const assigneeId = await this.resolveAssignee(comment);

        // Get existing issue to preserve user content
        let description = this.buildIssueDescription(comment);

        if (comment.issueId) {
            try {
                const existingIssue = await this.client.issue(comment.issueId);
                if (existingIssue.description) {
                    description = this.buildUpdatedIssueDescription(
                        comment,
                        existingIssue.description
                    );
                }
            } catch (error) {
                logger.warn(
                    `Could not fetch existing issue ${comment.issueId} for content preservation:`,
                    error
                );
                // Continue with new description if we can't fetch the existing one
            }
        }

        return {
            title: comment.title,
            description,
            assigneeId,
            labelIds: labels
        };
    }

    /**
     * Builds issue description with file location and IDE link
     * Content above the separator is managed by the tool, content below is preserved for user edits
     */
    private buildIssueDescription(comment: ParsedComment): string {
        const relativePath = this.makeRelativePath(comment.filePath);
        const ideLink = this.createIDELink(comment.filePath, comment.line);

        let description = `Found in: [${relativePath}:${comment.line}](${ideLink})\n\n`;

        if (comment.description) {
            description += `${comment.description}\n\n`;
        }

        description += 'Auto-generated by todo-linear-sync';
        description += CONTENT_SEPARATOR;

        return description;
    }

    /**
     * Extracts user-managed content from an existing issue description
     * Returns content below the separator, or empty string if no separator found
     */
    private extractUserContent(existingDescription: string): string {
        if (!existingDescription) {
            return '';
        }

        const separatorIndex = existingDescription.indexOf(SEPARATOR_MARKER);
        if (separatorIndex === -1) {
            return '';
        }

        // Find the actual separator line (may have whitespace around it)
        const lines = existingDescription.split('\n');
        let separatorLineIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i]?.trim() === SEPARATOR_MARKER) {
                separatorLineIndex = i;
                break;
            }
        }

        if (separatorLineIndex === -1) {
            return '';
        }

        // Return everything after the separator line
        const userContentLines = lines.slice(separatorLineIndex + 1);
        const userContent = userContentLines.join('\n').trim();

        return userContent ? `\n${userContent}` : '';
    }

    /**
     * Builds updated issue description preserving user content
     */
    private buildUpdatedIssueDescription(
        comment: ParsedComment,
        existingDescription: string
    ): string {
        const toolManagedContent = this.buildIssueDescription(comment);
        const userContent = this.extractUserContent(existingDescription);

        return toolManagedContent + userContent;
    }

    /**
     * Creates an IDE link for opening files
     */
    private createIDELink(filePath: string, line: number): string {
        const absolutePath = filePath.startsWith('/')
            ? filePath
            : resolve(this.config.projectRoot, filePath);
        
        // Use configurable template
        return this.config.ideLinkTemplate
            .replace('{filePath}', absolutePath)
            .replace('{lineNumber}', line.toString());
    }

    /**
     * Makes file path relative to project root
     */
    private makeRelativePath(filePath: string): string {
        if (filePath.startsWith('/')) {
            return relative(this.config.projectRoot, filePath);
        }
        return filePath;
    }

    /**
     * Resolves labels for an issue
     */
    private async resolveLabels(comment: ParsedComment): Promise<string[]> {
        const labels: string[] = [];

        // Add IDE label
        const ideLabelId = await this.getLabelId(this.config.ideLabelName);
        if (ideLabelId) {
            labels.push(ideLabelId);
        }

        // Add location-based labels
        const locationLabels = this.detectLocationLabels(comment.filePath);
        for (const labelName of locationLabels) {
            const labelId = await this.getLabelId(labelName);
            if (labelId) {
                labels.push(labelId);
            }
        }

        // Add comment type label
        const typeLabelId = await this.getLabelId(comment.type.toUpperCase());
        if (typeLabelId) {
            labels.push(typeLabelId);
        }

        // Add user-specified label
        if (comment.label) {
            const userLabelId = await this.getLabelId(comment.label);
            if (userLabelId) {
                labels.push(userLabelId);
            }
        }

        return labels;
    }

    /**
     * Detects labels based on file location
     */
    private detectLocationLabels(filePath: string): string[] {
        const labels: string[] = [];

        // App-specific labels
        if (filePath.includes('apps/admin/')) {
            labels.push('Apps: Admin');
        } else if (filePath.includes('apps/api/')) {
            labels.push('Apps: API');
        } else if (filePath.includes('apps/web/')) {
            labels.push('Apps: Web');
        } else if (filePath.includes('apps/')) {
            labels.push('Apps');
        }

        // Package-specific labels
        const packageMatch = filePath.match(/packages\/([^/]+)/);
        if (packageMatch?.[1]) {
            const packageName = packageMatch[1]
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            labels.push(`Packages: ${packageName}`);
        } else if (filePath.includes('packages/')) {
            labels.push('Packages');
        }

        return labels;
    }

    /**
     * Gets or creates a label ID
     */
    private async getLabelId(name: string): Promise<string | null> {
        // Check cache first
        if (this.labelCache.has(name)) {
            return this.labelCache.get(name) || null;
        }

        try {
            // Try to find existing label
            const labelsResponse = await this.client.issueLabels({
                filter: { team: { id: { eq: this.config.linearTeamId } } }
            });

            const existingLabel = labelsResponse.nodes.find(
                (label: { name: string; id: string }) =>
                    label.name.toLowerCase() === name.toLowerCase()
            );

            if (existingLabel) {
                this.labelCache.set(name, existingLabel.id);
                return existingLabel.id;
            }

            // Create new label
            const color = this.generateLabelColor(name);
            try {
                const result = await this.client.createIssueLabel({
                    name,
                    color,
                    teamId: this.config.linearTeamId
                });

                if (result.success && result.issueLabel) {
                    const label = await result.issueLabel;
                    const labelId = label?.id;
                    if (labelId) {
                        this.labelCache.set(name, labelId);
                        return labelId;
                    }
                }
            } catch (error) {
                // Handle duplicate label error
                if (error instanceof Error && error.message.includes('Duplicate label name')) {
                    // Try direct fetch by name with explicit typing for label
                    const directLabel = labelsResponse.nodes.find(
                        (label: { name: string; id: string }) =>
                            label.name.toLowerCase() === name.toLowerCase()
                    );
                    const labelId: string | null = directLabel?.id ?? null;
                    this.labelCache.set(name, labelId ?? '');
                    return labelId;
                }
                // Re-throw other errors
                throw error;
            }

            logger.warn(`Warning: Could not create/find label "${name}"`);
            return null;
        } catch (error) {
            logger.warn(`Warning: Failed to get/create label "${name}":`, error);
            return null;
        }
    }

    /**
     * Generates a color for a label based on its name
     */
    private generateLabelColor(name: string): string {
        const colors = {
            'from ide': '#4F46E5',
            todo: '#EF4444',
            hack: '#F59E0B',
            debug: '#10B981',
            apps: '#8B5CF6',
            packages: '#06B6D4',
            frontend: '#EC4899',
            backend: '#84CC16',
            database: '#F97316'
        };

        const normalizedName = name.toLowerCase();
        if (normalizedName in colors) {
            return colors[normalizedName as keyof typeof colors];
        }

        // Generate color based on name hash
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash) % 360;
        const saturation = 70;
        const lightness = 50;

        return this.hslToHex(hue, saturation, lightness);
    }

    /**
     * Converts HSL to Hex color
     */
    private hslToHex(h: number, s: number, l: number): string {
        const lightness = l / 100;
        const a = (s * Math.min(lightness, 1 - lightness)) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color)
                .toString(16)
                .padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    /**
     * Resolves assignee ID from username or email
     */
    private async resolveAssignee(comment: ParsedComment): Promise<string | undefined> {
        const assigneeEmail = comment.assignee || this.config.defaultUserEmail;

        try {
            const users = await this.client.users();
            const user = users.nodes.find(
                (u) =>
                    u.email?.toLowerCase() === assigneeEmail.toLowerCase() ||
                    u.name?.toLowerCase() === assigneeEmail.toLowerCase()
            );

            return user?.id;
        } catch (error) {
            logger.warn(`Warning: Could not resolve assignee "${assigneeEmail}":`, error);
            return undefined;
        }
    }
}
