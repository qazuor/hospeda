/**
 * Linear API client for managing issues
 */

import { relative, resolve } from 'node:path';
import { LinearClient } from '@linear/sdk';
import { AIAnalyzer } from '../ai/analyzer.js';
import type { AIAnalysis } from '../ai/types.js';
import type { ParsedComment, TodoLinearConfig } from '../types/index.js';
import logger from '../utils/logger.js';
import { TrackingManager } from './tracking.js';

/**
 * Separator used to divide tool-managed content from user-managed content in Linear issues
 */
const SEPARATOR_MARKER = '---';

/**
 * Client for interacting with Linear API
 */
export class TodoLinearClient {
    private readonly client: LinearClient;
    private readonly config: TodoLinearConfig;
    private readonly labelCache = new Map<string, string>();
    private readonly aiAnalyzer: AIAnalyzer;
    private labelCacheInitialized = false;

    constructor(config: TodoLinearConfig) {
        this.client = new LinearClient({ apiKey: config.linearApiKey });
        this.config = config;
        this.aiAnalyzer = new AIAnalyzer(config.ai);
    }

    /**
     * Initialize the label cache by loading all existing labels
     */
    private async initializeLabelCache(): Promise<void> {
        if (this.labelCacheInitialized) {
            return;
        }

        try {
            logger.debug('Initializing label cache...');

            // Load team labels
            const teamLabels = await this.client.issueLabels({
                filter: { team: { id: { eq: this.config.linearTeamId } } },
                first: 250
            });

            // Load workspace labels
            const workspaceLabels = await this.client.issueLabels({
                first: 250
            });

            // Cache all labels
            const allLabels = [...teamLabels.nodes, ...workspaceLabels.nodes];
            const uniqueLabels = allLabels.filter(
                (label, index, self) => self.findIndex((l) => l.id === label.id) === index
            );

            for (const label of uniqueLabels) {
                this.labelCache.set(label.name, label.id);
            }

            this.labelCacheInitialized = true;
            logger.debug(`Label cache initialized with ${uniqueLabels.length} labels`);
        } catch (error) {
            logger.warn(
                `Failed to initialize label cache: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            // Don't set as initialized so it can retry later
        }
    }

    /**
     * Public method to initialize label cache (called by synchronizer)
     */
    async warmupCache(): Promise<void> {
        await this.initializeLabelCache();
    }

    /**
     * Creates a new Linear issue from a TODO comment
     */
    async createIssue(comment: ParsedComment): Promise<string> {
        return await this.createIssueWithAnalysis(comment, null);
    }

    /**
     * Creates a new Linear issue from a TODO comment with pre-processed AI analysis
     */
    async createIssueWithAnalysis(
        comment: ParsedComment,
        providedAnalysis: AIAnalysis | null = null
    ): Promise<string> {
        // Only use pre-processed AI analysis from batch processing
        // Individual AI analysis is disabled to avoid duplicate API calls
        const aiAnalysis = providedAnalysis;

        if (!aiAnalysis && this.aiAnalyzer.isEnabled()) {
            logger.aiWarn(
                `AI analysis failed for new comment ${comment.filePath}:${comment.line}: ${providedAnalysis ? 'Provided analysis was null' : 'No analysis available from batch processing'}`
            );
        }

        const issueData = await this.buildCreateIssueData(comment, aiAnalysis);
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
    async updateIssue(
        comment: ParsedComment,
        tracking?: import('./tracking.js').TrackingManager
    ): Promise<boolean> {
        return await this.updateIssueWithAnalysis(comment, null, tracking);
    }

    /**
     * Updates an existing Linear issue with pre-processed AI analysis
     */
    async updateIssueWithAnalysis(
        comment: ParsedComment,
        providedAnalysis: AIAnalysis | null = null,
        _tracking?: import('./tracking.js').TrackingManager
    ): Promise<boolean> {
        if (!comment.issueId) {
            throw new Error('Comment must have an issue ID to update');
        }

        // Only use pre-processed AI analysis from batch processing
        // Individual AI analysis is disabled to avoid duplicate API calls
        const aiAnalysis = providedAnalysis;

        if (!aiAnalysis && this.aiAnalyzer.isEnabled()) {
            logger.aiWarn(
                `AI analysis failed for comment update ${comment.filePath}:${comment.line}: ${providedAnalysis ? 'Provided analysis was null' : 'No analysis available from batch processing'}`
            );
        }

        const updateData = await this.buildUpdateIssueData(comment, aiAnalysis);
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
    private async buildCreateIssueData(comment: ParsedComment, aiAnalysis?: AIAnalysis | null) {
        const labels = await this.resolveLabels(comment, aiAnalysis);
        const assigneeId = await this.resolveAssignee(comment);
        const description = this.buildIssueDescription(comment, aiAnalysis);

        // Use AI-determined priority if available, otherwise default to normal
        const priority = aiAnalysis?.priority || 3;

        return {
            teamId: this.config.linearTeamId,
            title: comment.title,
            description,
            assigneeId,
            labelIds: labels,
            priority
        };
    }

    /**
     * Builds update issue data, preserving user content
     */
    private async buildUpdateIssueData(comment: ParsedComment, aiAnalysis?: AIAnalysis | null) {
        const labels = await this.resolveLabels(comment, aiAnalysis);
        const assigneeId = await this.resolveAssignee(comment);

        // Get existing issue to preserve user content
        let description = this.buildIssueDescription(comment, aiAnalysis);

        if (comment.issueId) {
            try {
                const existingIssue = await this.client.issue(comment.issueId);
                if (existingIssue.description) {
                    description = this.buildUpdatedIssueDescription(
                        comment,
                        existingIssue.description,
                        aiAnalysis
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
    private buildIssueDescription(comment: ParsedComment, aiAnalysis?: AIAnalysis | null): string {
        const relativePath = this.makeRelativePath(comment.filePath);
        const ideLink = this.createIDELink(comment.filePath, comment.line);

        // Start with auto-generated marker
        let description = 'Auto-generated by todo-linear-sync\n\n';
        description += '---\n\n';

        // Add file location
        description += `Found in: [${relativePath}:${comment.line}](${ideLink})\n\n`;

        if (comment.description) {
            description += `${comment.description}\n\n`;
        }

        // Add AI analysis if available
        if (aiAnalysis) {
            description += this.buildAIAnalysisSection(aiAnalysis);
        } else {
            // Show pending state when AI analysis is not available
            description += this.buildPendingAIAnalysisSection();
        }

        // Add final separator and DEV NOTES section
        description += '---\n\n';
        description += '## DEV NOTES:\n\n';
        description += '<!-- User content below this line is preserved -->\n\n';

        return description;
    }

    /**
     * Extracts user-managed content from an existing issue description
     * Returns content below the DEV NOTES section, or empty string if not found
     */
    private extractUserContent(existingDescription: string): string {
        if (!existingDescription) {
            return '';
        }

        // Look for DEV NOTES section
        const devNotesMarker = '## DEV NOTES:';
        const devNotesIndex = existingDescription.indexOf(devNotesMarker);

        if (devNotesIndex === -1) {
            // Fallback: look for old separator pattern
            const separatorIndex = existingDescription.indexOf(SEPARATOR_MARKER);
            if (separatorIndex === -1) {
                return '';
            }

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

            // Filter content after separator, excluding preservation comment
            const userContentLines = lines.slice(separatorLineIndex + 1);
            const filteredLines = userContentLines.filter(
                (line) => line.trim() !== '<!-- User content below this line is preserved -->'
            );
            const userContent = filteredLines.join('\n').trim();
            return userContent ? `${userContent}` : '';
        }

        // Extract content after DEV NOTES section
        const afterDevNotes = existingDescription.substring(devNotesIndex + devNotesMarker.length);
        const lines = afterDevNotes.split('\n');

        // Filter out the preservation comment lines and empty lines at the beginning
        const filteredLines: string[] = [];
        let hasStartedContent = false;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip the preservation comment line specifically
            if (trimmedLine === '<!-- User content below this line is preserved -->') {
                continue;
            }

            // Skip empty lines at the beginning
            if (!hasStartedContent && !trimmedLine) {
                continue;
            }

            // Once we find content, start collecting all lines (including empty ones)
            if (trimmedLine) {
                hasStartedContent = true;
            }

            if (hasStartedContent) {
                filteredLines.push(line);
            }
        }

        const userContent = filteredLines.join('\n').trim();
        return userContent || '';
    }

    /**
     * Builds updated issue description preserving user content
     */
    private buildUpdatedIssueDescription(
        comment: ParsedComment,
        existingDescription: string,
        aiAnalysis?: AIAnalysis | null
    ): string {
        const toolManagedContent = this.buildIssueDescription(comment, aiAnalysis);
        const userContent = this.extractUserContent(existingDescription);

        // If there's user content, append it to the DEV NOTES section
        if (userContent) {
            return toolManagedContent + userContent;
        }

        return toolManagedContent;
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
    private async resolveLabels(
        comment: ParsedComment,
        aiAnalysis?: AIAnalysis | null
    ): Promise<string[]> {
        const labels: string[] = [];

        // Add IDE label
        const ideLabelId = await this.getLabelId(this.config.ideLabelName);
        if (ideLabelId) {
            labels.push(ideLabelId);
        } else {
            logger.warn(`Failed to get/create IDE label: ${this.config.ideLabelName}`);
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

        // Add AI-suggested labels if available
        if (aiAnalysis?.labels) {
            for (const labelName of aiAnalysis.labels) {
                const aiLabelId = await this.getLabelId(labelName);
                if (aiLabelId) {
                    labels.push(aiLabelId);
                }
            }
        }

        // Add user-specified label
        if (comment.label) {
            const userLabelId = await this.getLabelId(comment.label);
            if (userLabelId) {
                labels.push(userLabelId);
            }
        }

        return [...new Set(labels)]; // Remove duplicates
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
        // Initialize cache if not done yet
        await this.initializeLabelCache();

        // Check cache first
        if (this.labelCache.has(name)) {
            return this.labelCache.get(name) || null;
        }

        try {
            // Try to find existing label - search more comprehensively first
            const existingLabel = await this.findExistingLabel(name);

            if (existingLabel) {
                this.labelCache.set(name, existingLabel.id);
                return existingLabel.id;
            }

            // Create new label only if we're sure it doesn't exist
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
                // Handle duplicate label error - this means it exists but we missed it
                if (error instanceof Error && error.message.includes('Duplicate label name')) {
                    logger.debug(`Label "${name}" already exists, searching again...`);

                    // Try one more comprehensive search
                    const retryLabel = await this.findExistingLabel(name, true);
                    if (retryLabel) {
                        this.labelCache.set(name, retryLabel.id);
                        return retryLabel.id;
                    }
                }

                // Log the warning but don't throw - just return null
                logger.warn(
                    `Warning: Failed to get/create label "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                return null;
            }

            logger.warn(`Warning: Could not create/find label "${name}"`);
            return null;
        } catch (error) {
            logger.warn(
                `Warning: Failed to get/create label "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return null;
        }
    }

    /**
     * Comprehensive search for existing labels
     */
    private async findExistingLabel(
        name: string,
        forceRefresh = false
    ): Promise<{ id: string; name: string } | null> {
        if (!forceRefresh && this.labelCache.has(name)) {
            const cachedId = this.labelCache.get(name);
            if (cachedId) {
                return { id: cachedId, name };
            }
        }

        try {
            // Search in team labels first with higher limit
            const teamLabelsResponse = await this.client.issueLabels({
                filter: { team: { id: { eq: this.config.linearTeamId } } },
                first: 200
            });

            let existingLabel = teamLabelsResponse.nodes.find(
                (label: { name: string; id: string }) =>
                    label.name.toLowerCase() === name.toLowerCase()
            );

            if (existingLabel) {
                return existingLabel;
            }

            // Search in workspace labels with higher limit
            const workspaceLabelsResponse = await this.client.issueLabels({
                first: 200
            });

            existingLabel = workspaceLabelsResponse.nodes.find(
                (label: { name: string; id: string }) =>
                    label.name.toLowerCase() === name.toLowerCase()
            );

            if (existingLabel) {
                return existingLabel;
            }

            // If we have pagination, search next pages
            if (teamLabelsResponse.pageInfo?.hasNextPage) {
                const nextTeamLabels = await this.client.issueLabels({
                    filter: { team: { id: { eq: this.config.linearTeamId } } },
                    first: 200,
                    after: teamLabelsResponse.pageInfo.endCursor
                });

                existingLabel = nextTeamLabels.nodes.find(
                    (label: { name: string; id: string }) =>
                        label.name.toLowerCase() === name.toLowerCase()
                );

                if (existingLabel) {
                    return existingLabel;
                }
            }

            return null;
        } catch (error) {
            logger.debug(
                `Error searching for label "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
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
     * Builds the AI analysis section for issue description
     */
    private buildAIAnalysisSection(analysis: AIAnalysis): string {
        // Construir el título con información del proveedor y modelo
        const providerInfo =
            analysis.provider && analysis.model ? ` (${analysis.provider}: ${analysis.model})` : '';
        let section = `## 🤖 AI Analysis${providerInfo}\n\n`;

        // Priority and effort
        const priorityNames = { 1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low' };
        const effortNames = {
            small: 'Small (1-2h)',
            medium: 'Medium (1-3d)',
            large: 'Large (1w+)'
        };

        section += `**Priority:** ${priorityNames[analysis.priority]} | **Effort:** ${effortNames[analysis.effort]}\n\n`;

        // Description sections
        if (analysis.description.why) {
            section += `**Why:** ${analysis.description.why}\n\n`;
        }

        if (analysis.description.how) {
            section += `**How:** ${analysis.description.how}\n\n`;
        }

        if (analysis.description.impact) {
            section += `**Impact:** ${analysis.description.impact}\n\n`;
        }

        // Suggestions
        if (analysis.suggestions && analysis.suggestions.length > 0) {
            section += '**Suggestions:**\n';
            for (const suggestion of analysis.suggestions) {
                section += `- ${suggestion}\n`;
            }
            section += '\n';
        }

        // Related files
        if (analysis.relatedFiles && analysis.relatedFiles.length > 0) {
            section += '**Related Files:**\n';
            for (const file of analysis.relatedFiles) {
                section += `- ${file}\n`;
            }
            section += '\n';
        }

        // Confidence
        if (analysis.confidence < 1) {
            const confidencePercent = Math.round(analysis.confidence * 100);
            section += `*AI Confidence: ${confidencePercent}%*\n\n`;
        }

        return section;
    }

    /**
     * Builds the pending AI analysis section for issue description
     */
    private buildPendingAIAnalysisSection(): string {
        return '## 🤖 AI Analysis (PENDING)\n\n*AI analysis is pending for this TODO. It will be updated automatically once processing is complete.*\n\n';
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

    /**
     * Processes AI analysis for multiple comments in batch
     */
    async processAIAnalysis(comments: ParsedComment[]): Promise<Map<string, AIAnalysis>> {
        if (!this.aiAnalyzer.isEnabled() || comments.length === 0) {
            return new Map();
        }

        try {
            // Use the existing analyzer with tracking
            const tracking = new TrackingManager(this.config.projectRoot);
            return await this.aiAnalyzer.analyzeCommentsWithTracking(
                comments,
                this.config.projectRoot,
                tracking
            );
        } catch (error) {
            logger.error(
                `AI batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return new Map();
        }
    }
}
