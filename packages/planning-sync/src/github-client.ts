/**
 * GitHub Client Wrapper
 * Simple wrapper around Octokit for planning sync operations
 */

import { Octokit } from '@octokit/rest';
import type { GitHubSyncConfig, TaskStatus } from './types.js';

/**
 * Simple GitHub client for planning synchronization
 */
export class PlanningGitHubClient {
    private octokit: Octokit;
    private owner: string;
    private repo: string;
    private parentLabel: string;
    private labels: string[];
    private milestone?: string;
    private authenticatedUser?: string;

    constructor(config: GitHubSyncConfig) {
        this.octokit = new Octokit({ auth: config.token });

        // Parse owner/repo from config
        const [owner, repo] = config.repo.split('/');
        if (!owner || !repo) {
            throw new Error(
                'Invalid repo format. Expected "owner/repo" (e.g., "anthropics/hospeda")'
            );
        }

        this.owner = owner;
        this.repo = repo;
        this.parentLabel = config.parentLabel || 'planning';
        this.labels = config.labels || [];
        this.milestone = config.milestone;
    }

    /**
     * Gets the authenticated user's login
     */
    private async getAuthenticatedUser(): Promise<string> {
        if (this.authenticatedUser) {
            return this.authenticatedUser;
        }

        try {
            const { data } = await this.octokit.users.getAuthenticated();
            this.authenticatedUser = data.login;
            return data.login;
        } catch {
            // If we can't get the authenticated user, return empty string
            return '';
        }
    }

    /**
     * Creates or updates a parent planning issue
     *
     * @param params - Parent issue parameters
     * @returns Issue number and URL
     */
    async createOrUpdateParentIssue(params: {
        title: string;
        body: string;
        existingIssueNumber?: number;
        planningCode: string;
        projectName?: string;
        tasksCount?: number;
    }): Promise<{ number: number; url: string; projectNumber?: number }> {
        // Add planning code to title
        const titleWithCode = `[${params.planningCode}] ${params.title}`;

        // Enhance body with planning metadata
        const enhancedBody = `# Planning Session: ${params.title}

${params.body}

---

## 📊 Planning Metadata

- **Planning Code**: \`${params.planningCode}\`
- **Total Tasks**: ${params.tasksCount || 0}
- **Created**: ${new Date().toISOString().split('T')[0]}
- **Repository**: ${this.owner}/${this.repo}

---

> 🤖 This planning session was generated and synced by Claude Code Planning Sync

`;

        if (params.existingIssueNumber) {
            // Update existing issue
            const { data } = await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: params.existingIssueNumber,
                title: titleWithCode,
                body: enhancedBody
            });

            return {
                number: data.number,
                url: data.html_url
            };
        }

        // Ensure parent label exists
        await this.ensureLabel(this.parentLabel, 'Planning session', '0E8A16');
        await this.ensureLabel('claude-code', 'Created by Claude Code', '8B5CF6');

        // Prepare labels
        const issueLabels = [this.parentLabel, 'claude-code', ...this.labels];

        // Get milestone ID if specified
        let milestoneNumber: number | undefined;
        if (this.milestone) {
            milestoneNumber = await this.getMilestoneNumber(this.milestone);
        }

        // Get authenticated user for assignee
        const assignee = await this.getAuthenticatedUser();

        // Create new parent issue
        const { data } = await this.octokit.issues.create({
            owner: this.owner,
            repo: this.repo,
            title: titleWithCode,
            body: enhancedBody,
            labels: issueLabels,
            milestone: milestoneNumber,
            assignees: assignee ? [assignee] : undefined
        });

        // Create or get project
        let projectNumber: number | undefined;
        if (params.projectName) {
            projectNumber = await this.ensureProject(params.projectName, data.number);
        }

        return {
            number: data.number,
            url: data.html_url,
            projectNumber
        };
    }

    /**
     * Creates a sub-issue (child task)
     *
     * Note: GitHub doesn't have native parent-child relationships,
     * so we use the issue body to link to parent
     *
     * @param params - Sub-issue parameters
     * @returns Issue number and URL
     */
    async createSubIssue(params: {
        parentNumber: number;
        title: string;
        body?: string;
        taskCode: string;
        planningName: string;
        planningCode: string;
        status: 'pending' | 'in_progress' | 'completed';
        phase?: string;
        projectNumber?: number;
    }): Promise<{ number: number; url: string }> {
        // Add task code and planning name to title
        const titleWithCode = `[${params.taskCode}] ${params.planningName}: ${params.title}`;

        // Enhance body with rich metadata
        const enhancedBody = `## 📋 Task Details

${params.body || params.title}

---

## 🔗 Planning Context

- **Parent Planning**: #${params.parentNumber} (\`${params.planningCode}\`)
- **Task Code**: \`${params.taskCode}\`
- **Status**: ${this.getStatusEmoji(params.status)} ${params.status.replace('_', ' ')}
${params.phase ? `- **Phase**: ${params.phase}` : ''}

---

## ✅ Acceptance Criteria

_To be defined during implementation_

---

> 🤖 This task was generated by Claude Code Planning Sync
> 📖 Part of the **${params.planningName}** planning session

`;

        // Ensure required labels exist
        await this.ensureLabel('task', 'Planning task', 'D4C5F9');
        await this.ensureLabel('claude-code', 'Created by Claude Code', '8B5CF6');

        // Add status label
        const statusLabel = `status:${params.status.replace('_', '-')}`;
        await this.ensureStatusLabels();

        // Prepare labels
        const issueLabels = ['task', 'claude-code', statusLabel, ...this.labels];

        // Add phase label if provided
        if (params.phase) {
            const phaseLabel = `phase:${params.phase.toLowerCase().replace(/\s+/g, '-')}`;
            await this.ensureLabel(phaseLabel, `Phase: ${params.phase}`, 'FBCA04');
            issueLabels.push(phaseLabel);
        }

        // Get milestone ID if specified
        let milestoneNumber: number | undefined;
        if (this.milestone) {
            milestoneNumber = await this.getMilestoneNumber(this.milestone);
        }

        // Get authenticated user for assignee
        const assignee = await this.getAuthenticatedUser();

        // Create issue
        const { data } = await this.octokit.issues.create({
            owner: this.owner,
            repo: this.repo,
            title: titleWithCode,
            body: enhancedBody,
            labels: issueLabels,
            milestone: milestoneNumber,
            assignees: assignee ? [assignee] : undefined
        });

        // Add to project if provided
        if (params.projectNumber) {
            await this.addIssueToProject(params.projectNumber, data.node_id);
        }

        return {
            number: data.number,
            url: data.html_url
        };
    }

    /**
     * Updates parent issue with tasklist of all sub-issues
     *
     * @param parentNumber - Parent issue number
     * @param subIssues - Array of sub-issue numbers and titles
     */
    async updateParentWithTasklist(params: {
        parentNumber: number;
        subIssues: Array<{ number: number; title: string; status: string }>;
    }): Promise<void> {
        // Get current issue
        const { data: issue } = await this.octokit.issues.get({
            owner: this.owner,
            repo: this.repo,
            issue_number: params.parentNumber
        });

        // Generate tasklist
        const tasklist = params.subIssues
            .map(({ number, title, status }) => {
                const checkbox = status === 'completed' ? '[x]' : '[ ]';
                return `- ${checkbox} #${number} ${title}`;
            })
            .join('\n');

        // Append tasklist to body
        const updatedBody = `${issue.body}

## 📋 Tasks

${tasklist}
`;

        // Update issue
        await this.octokit.issues.update({
            owner: this.owner,
            repo: this.repo,
            issue_number: params.parentNumber,
            body: updatedBody
        });
    }

    /**
     * Gets emoji for status
     */
    private getStatusEmoji(status: string): string {
        switch (status) {
            case 'completed':
                return '✅';
            case 'in_progress':
                return '🔄';
            default:
                return '⏸️';
        }
    }

    /**
     * Ensures all status labels exist
     */
    private async ensureStatusLabels(): Promise<void> {
        await this.ensureLabel('status:pending', 'Task not started', 'EDEDED');
        await this.ensureLabel('status:in-progress', 'Task in progress', 'FBCA04');
        await this.ensureLabel('status:completed', 'Task completed', '0E8A16');
    }

    /**
     * Updates an issue's status using labels
     *
     * GitHub uses labels for status tracking. We use:
     * - status:pending (gray)
     * - status:in-progress (yellow)
     * - status:completed (green/purple) + close issue
     *
     * @param issueNumber - GitHub issue number
     * @param status - New status
     */
    async updateIssueStatus(issueNumber: number, status: TaskStatus): Promise<void> {
        // Ensure status labels exist
        await this.ensureLabel('status:pending', 'Task not started', 'EDEDED');
        await this.ensureLabel('status:in-progress', 'Task in progress', 'FBCA04');
        await this.ensureLabel('status:completed', 'Task completed', '0E8A16');

        // Get current labels
        const { data: issue } = await this.octokit.issues.get({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber
        });

        // Remove all status labels
        const currentLabels = issue.labels
            .map((l) => (typeof l === 'string' ? l : l.name))
            .filter((l): l is string => typeof l === 'string' && !l.startsWith('status:'));

        // Add new status label
        const statusLabel = `status:${status.replace('_', '-')}`;
        const newLabels: string[] = [...currentLabels, statusLabel];

        // Update labels
        await this.octokit.issues.update({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber,
            labels: newLabels,
            // Close issue if completed
            state: status === 'completed' ? 'closed' : 'open'
        });
    }

    /**
     * Gets issue URL by number
     *
     * @param issueNumber - GitHub issue number
     * @returns Issue URL
     */
    getIssueUrl(issueNumber: number): string {
        return `https://github.com/${this.owner}/${this.repo}/issues/${issueNumber}`;
    }

    /**
     * Ensures a label exists, creates it if not
     *
     * @param name - Label name
     * @param description - Label description
     * @param color - Label color (hex without #)
     */
    private async ensureLabel(name: string, description: string, color: string): Promise<void> {
        try {
            // Try to get label
            await this.octokit.issues.getLabel({
                owner: this.owner,
                repo: this.repo,
                name
            });
        } catch (error: unknown) {
            // Label doesn't exist, create it
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                await this.octokit.issues.createLabel({
                    owner: this.owner,
                    repo: this.repo,
                    name,
                    description,
                    color
                });
            } else {
                // Other error, rethrow
                throw error;
            }
        }
    }

    /**
     * Gets milestone number by title
     *
     * @param title - Milestone title
     * @returns Milestone number or undefined
     */
    private async getMilestoneNumber(title: string): Promise<number | undefined> {
        try {
            const { data: milestones } = await this.octokit.issues.listMilestones({
                owner: this.owner,
                repo: this.repo,
                state: 'all'
            });

            const milestone = milestones.find((m) => m.title === title);
            return milestone?.number;
        } catch {
            return undefined;
        }
    }

    /**
     * Ensures a GitHub project exists for the planning, creates if not
     *
     * @param projectName - Name of the project
     * @param parentIssueNumber - Parent issue number to link
     * @returns Project number
     */
    private async ensureProject(
        projectName: string,
        _parentIssueNumber: number
    ): Promise<number | undefined> {
        try {
            // Note: GitHub Projects v2 requires GraphQL API
            // For now, we'll create a classic project using REST API
            // This is a simplified implementation

            // List existing projects
            const { data: projects } = await this.octokit.projects.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'open'
            });

            // Check if project already exists
            let project = projects.find((p) => p.name === projectName);

            if (!project) {
                // Create new project
                const { data } = await this.octokit.projects.createForRepo({
                    owner: this.owner,
                    repo: this.repo,
                    name: projectName,
                    body: `Planning project for: ${projectName}\n\nGenerated by Claude Code Planning Sync`
                });
                project = data;
            }

            return project.number;
        } catch (error) {
            // Projects might not be enabled for the repo
            console.warn(`Could not create/get project: ${error}`);
            return undefined;
        }
    }

    /**
     * Adds an issue to a GitHub project
     *
     * @param projectNumber - Project number
     * @param issueNodeId - Issue node ID
     */
    private async addIssueToProject(projectNumber: number, issueNodeId: string): Promise<void> {
        try {
            // Get project columns
            const { data: columns } = await this.octokit.projects.listColumns({
                project_id: projectNumber
            });

            // Add to first column (usually "To Do")
            if (columns.length > 0 && columns[0]) {
                await this.octokit.projects.createCard({
                    column_id: columns[0].id,
                    content_id: Number.parseInt(issueNodeId, 10),
                    content_type: 'Issue'
                });
            }
        } catch (error) {
            console.warn(`Could not add issue to project: ${error}`);
        }
    }

    /**
     * Deletes all issues in the repository (useful for cleanup)
     * WARNING: This is destructive!
     *
     * @param confirm - Must be true to execute
     */
    async deleteAllIssues(confirm: boolean): Promise<number> {
        if (!confirm) {
            throw new Error('Must confirm deletion by passing true');
        }

        let deleted = 0;
        let page = 1;
        const perPage = 100;

        while (true) {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'all',
                per_page: perPage,
                page
            });

            if (issues.length === 0) break;

            for (const issue of issues) {
                // Skip pull requests
                if (issue.pull_request) continue;

                try {
                    // Close and delete (GitHub doesn't have true delete, so we close)
                    await this.octokit.issues.update({
                        owner: this.owner,
                        repo: this.repo,
                        issue_number: issue.number,
                        state: 'closed'
                    });
                    deleted++;
                } catch (error) {
                    console.warn(`Could not close issue #${issue.number}: ${error}`);
                }
            }

            if (issues.length < perPage) break;
            page++;
        }

        return deleted;
    }
}
