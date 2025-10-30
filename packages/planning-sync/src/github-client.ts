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
    }): Promise<{ number: number; url: string; projectId?: string }> {
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
        let projectId: string | undefined;
        if (params.projectName) {
            projectId = await this.ensureProject(params.projectName, data.number);

            // Add parent issue to project
            if (projectId) {
                await this.addIssueToProject(projectId, data.number);
            }
        }

        return {
            number: data.number,
            url: data.html_url,
            projectId
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
        projectId?: string;
    }): Promise<{ number: number; url: string }> {
        // Remove any existing task code from title (in case it was already added in TODOs.md)
        // Pattern: **[T-XXX-XXX]** at the beginning
        const cleanTitle = params.title.replace(/^\*\*\[T-\d+-\d+\]\*\*\s*/, '');

        // Add task code and planning name to title
        const titleWithCode = `[${params.taskCode}] ${params.planningName}: ${cleanTitle}`;

        // Extract auto-labels from title and body
        const autoLabels = this.extractLabelsFromTask(params.title, params.body);

        // Enhance body with rich metadata and summary
        const enhancedBody = `## 📋 Task Summary

**${params.title}**

${params.body || ''}

---

## 📊 Task Metadata

| Field | Value |
|-------|-------|
| **Task Code** | \`${params.taskCode}\` |
| **Status** | ${this.getStatusEmoji(params.status)} ${params.status.replace('_', ' ')} |
${params.phase ? `| **Phase** | ${params.phase} |` : ''}
| **Planning** | ${params.planningName} (\`${params.planningCode}\`) |
| **Parent Issue** | #${params.parentNumber} |

${autoLabels.length > 0 ? `\n**Auto-detected Labels**: ${autoLabels.map((l) => `\`${l}\``).join(', ')}\n` : ''}

---

## 🔗 Planning Context

This task is part of the **${params.planningName}** planning session.

- 📖 View full planning: #${params.parentNumber}
- 🎯 Planning Code: \`${params.planningCode}\`
- 📁 Session Path: \`.claude/sessions/planning/${params.planningCode.toLowerCase()}-*\`

---

## ✅ Acceptance Criteria

_To be defined during implementation_

---

## 📝 Implementation Notes

_Add notes, discoveries, and decisions made during implementation_

---

> 🤖 This task was generated by Claude Code Planning Sync
> 🏷️ Labels were auto-detected from task content

`;

        // Ensure required labels exist
        await this.ensureLabel('task', 'Planning task', 'D4C5F9');
        await this.ensureLabel('claude-code', 'Created by Claude Code', '8B5CF6');

        // Add status label
        const statusLabel = `status:${params.status.replace('_', '-')}`;
        await this.ensureStatusLabels();

        // Ensure auto-detected labels exist
        for (const label of autoLabels) {
            const [category, value] = label.split(':');
            let description = `Auto-detected: ${value}`;
            let color = '0E8A16'; // Default green

            if (category === 'type') {
                description = `Task type: ${value}`;
                color = 'FBCA04'; // Yellow
            } else if (category === 'priority') {
                description = `Priority: ${value}`;
                color = value === 'high' ? 'D73A4A' : 'FBCA04'; // Red or yellow
            } else if (category === 'complexity') {
                description = `Complexity: ${value}`;
                color = value === 'high' ? 'D73A4A' : '0E8A16'; // Red or green
            }

            await this.ensureLabel(label, description, color);
        }

        // Prepare labels
        const issueLabels = ['task', 'claude-code', statusLabel, ...autoLabels, ...this.labels];

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
        if (params.projectId) {
            await this.addIssueToProject(params.projectId, data.number);
        }

        // Establish parent-child relationship
        await this.createSubIssueRelationship(params.parentNumber, data.number);

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
     * Extracts labels from task title and body
     * Auto-detects keywords and returns appropriate labels
     */
    private extractLabelsFromTask(title: string, body?: string): string[] {
        const content = `${title} ${body || ''}`.toLowerCase();
        const labels: string[] = [];

        // Type labels based on keywords
        const typeKeywords: Record<string, string[]> = {
            'type:schema': ['schema', 'schemas', 'database schema', 'table definition'],
            'type:model': ['model', 'models', 'base model', 'extends basemodel'],
            'type:service': ['service', 'services', 'business logic', 'crud service'],
            'type:api': ['api', 'endpoint', 'route', 'routes', 'hono'],
            'type:test': ['test', 'tests', 'testing', 'unit test', 'integration test', 'e2e'],
            'type:docs': ['docs', 'documentation', 'readme', 'guide', 'document'],
            'type:migration': ['migration', 'migrate', 'schema change'],
            'type:validation': ['validation', 'zod', 'validate', 'schema validation'],
            'type:ui': ['component', 'ui', 'frontend', 'react', 'astro', 'page'],
            'type:fix': ['fix', 'bug', 'bugfix', 'hotfix', 'patch'],
            'type:refactor': ['refactor', 'refactoring', 'cleanup', 'improve'],
            'type:config': ['config', 'configuration', 'setup', 'environment']
        };

        // Check for type keywords
        for (const [label, keywords] of Object.entries(typeKeywords)) {
            if (keywords.some((keyword) => content.includes(keyword))) {
                labels.push(label);
            }
        }

        // Priority labels
        if (
            content.includes('urgent') ||
            content.includes('critical') ||
            content.includes('blocker')
        ) {
            labels.push('priority:high');
        } else if (content.includes('important')) {
            labels.push('priority:medium');
        }

        // Complexity labels
        if (content.includes('complex') || content.includes('challenging')) {
            labels.push('complexity:high');
        } else if (content.includes('simple') || content.includes('trivial')) {
            labels.push('complexity:low');
        }

        return [...new Set(labels)]; // Remove duplicates
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
     * Creates or gets a GitHub Project v2 for the planning using GraphQL
     *
     * @param projectName - Name of the project
     * @returns Project node ID or undefined
     */
    private async ensureProjectV2(projectName: string): Promise<string | undefined> {
        try {
            // Get owner ID (user or organization)
            const ownerQuery = `
                query {
                    repositoryOwner(login: "${this.owner}") {
                        id
                        ... on User {
                            projectsV2(first: 10, query: "${projectName}") {
                                nodes {
                                    id
                                    title
                                }
                            }
                        }
                        ... on Organization {
                            projectsV2(first: 10, query: "${projectName}") {
                                nodes {
                                    id
                                    title
                                }
                            }
                        }
                    }
                }
            `;

            const ownerResult = await this.octokit.graphql<{
                repositoryOwner: {
                    id: string;
                    projectsV2?: { nodes: Array<{ id: string; title: string }> };
                };
            }>(ownerQuery);

            const ownerId = ownerResult.repositoryOwner.id;
            const existingProjects = ownerResult.repositoryOwner.projectsV2?.nodes || [];

            // Check if project exists
            const existingProject = existingProjects.find((p) => p.title === projectName);
            if (existingProject) {
                console.log(`  📋 Using existing project: ${projectName}`);
                return existingProject.id;
            }

            // Create new project
            const createMutation = `
                mutation {
                    createProjectV2(input: {
                        ownerId: "${ownerId}",
                        title: "${projectName}"
                    }) {
                        projectV2 {
                            id
                            title
                        }
                    }
                }
            `;

            const createResult = await this.octokit.graphql<{
                createProjectV2: { projectV2: { id: string; title: string } };
            }>(createMutation);

            console.log(`  ✨ Created new project: ${projectName}`);
            return createResult.createProjectV2.projectV2.id;
        } catch (error) {
            console.warn(`  ⚠️  Could not create/get Projects v2: ${error}`);
            return undefined;
        }
    }

    /**
     * Adds an issue to a GitHub Project v2 using GraphQL
     *
     * @param projectId - Project node ID
     * @param issueNumber - Issue number
     */
    async addIssueToProjectV2(projectId: string, issueNumber: number): Promise<void> {
        try {
            // Get issue node ID
            const issueQuery = `
                query {
                    repository(owner: "${this.owner}", name: "${this.repo}") {
                        issue(number: ${issueNumber}) {
                            id
                        }
                    }
                }
            `;

            const issueResult = await this.octokit.graphql<{
                repository: { issue: { id: string } };
            }>(issueQuery);

            const issueId = issueResult.repository.issue.id;

            // Add issue to project
            const mutation = `
                mutation {
                    addProjectV2ItemById(input: {
                        projectId: "${projectId}",
                        contentId: "${issueId}"
                    }) {
                        item {
                            id
                        }
                    }
                }
            `;

            await this.octokit.graphql(mutation);
            console.log(`  📌 Added #${issueNumber} to project`);
        } catch (error) {
            console.warn(`  ⚠️  Could not add issue to project: ${error}`);
        }
    }

    /**
     * Ensures a GitHub project exists for the planning, creates if not
     *
     * @param projectName - Name of the project
     * @param parentIssueNumber - Parent issue number to link
     * @returns Project node ID (Projects v2) or undefined
     */
    private async ensureProject(
        projectName: string,
        _parentIssueNumber: number
    ): Promise<string | undefined> {
        // Use Projects v2 (GraphQL)
        return await this.ensureProjectV2(projectName);
    }

    /**
     * Adds an issue to a GitHub project
     *
     * @param projectId - Project ID (Projects v2 node ID)
     * @param issueNumber - Issue number
     */
    private async addIssueToProject(projectId: string, issueNumber: number): Promise<void> {
        await this.addIssueToProjectV2(projectId, issueNumber);
    }

    /**
     * Establishes parent-child relationship between issues using GraphQL
     * Uses GitHub's tracked/tracks relationship
     *
     * @param parentNumber - Parent issue number
     * @param childNumber - Child issue number
     */
    async createSubIssueRelationship(parentNumber: number, childNumber: number): Promise<void> {
        try {
            // GitHub's Sub-Issues REST API requires the numeric ID, not the issue number
            // First, get the child issue to obtain its ID
            const { data: childIssue } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: childNumber
            });

            // Use GitHub's Sub-Issues REST API
            // POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues
            await this.octokit.request(
                'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
                {
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: parentNumber,
                    sub_issue_id: childIssue.id, // Use the numeric ID, not the issue number
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );

            console.log(`  🔗 Linked #${childNumber} as sub-issue of #${parentNumber}`);
        } catch (error) {
            // This feature may not be available in all repos
            // Fallback: relationship is established via tasklist and mentions
            console.warn(`  ⚠️  Could not create sub-issue relationship (using tasklist instead)`);
        }
    }

    /**
     * Deletes all issues in the repository (useful for cleanup)
     * WARNING: This is destructive!
     *
     * Note: GitHub doesn't support true deletion via API. This method:
     * 1. Closes all open issues
     * 2. Optionally adds a label to mark them as deleted
     * 3. Uses delays to avoid rate limiting
     *
     * @param confirm - Must be true to execute
     * @param addLabel - If true, adds a 'deleted' label before closing
     * @returns Number of issues closed
     */
    async deleteAllIssues(confirm: boolean, addLabel = true): Promise<number> {
        if (!confirm) {
            throw new Error('Must confirm deletion by passing true');
        }

        // Ensure deleted label exists if requested
        if (addLabel) {
            await this.ensureLabel('deleted', 'Issue marked for deletion', 'D73A4A');
        }

        let closed = 0;
        let failed = 0;
        let skipped = 0;
        let page = 1;
        const perPage = 100;
        const delayMs = 100; // Delay between requests to avoid rate limiting

        console.log('📋 Fetching issues...');

        while (true) {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'all',
                per_page: perPage,
                page
            });

            if (issues.length === 0) break;

            console.log(`📦 Processing page ${page} (${issues.length} issues)...`);

            for (const issue of issues) {
                // Skip pull requests
                if (issue.pull_request) {
                    skipped++;
                    continue;
                }

                try {
                    // Add deleted label if requested
                    if (addLabel) {
                        const currentLabels = issue.labels
                            .map((l) => (typeof l === 'string' ? l : l.name))
                            .filter((l): l is string => typeof l === 'string');

                        await this.octokit.issues.update({
                            owner: this.owner,
                            repo: this.repo,
                            issue_number: issue.number,
                            labels: [...currentLabels, 'deleted'],
                            state: 'closed'
                        });
                    } else {
                        // Just close
                        await this.octokit.issues.update({
                            owner: this.owner,
                            repo: this.repo,
                            issue_number: issue.number,
                            state: 'closed'
                        });
                    }

                    closed++;
                    console.log(`  ✅ Closed #${issue.number}: ${issue.title}`);

                    // Delay to avoid rate limiting
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                } catch (error: unknown) {
                    failed++;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.warn(`  ❌ Failed to close #${issue.number}: ${errorMessage}`);
                }
            }

            if (issues.length < perPage) break;
            page++;

            // Longer delay between pages
            await new Promise((resolve) => setTimeout(resolve, delayMs * 2));
        }

        console.log('\n📊 Summary:');
        console.log(`  ✅ Closed: ${closed}`);
        console.log(`  ❌ Failed: ${failed}`);
        console.log(`  ⏭️  Skipped (PRs): ${skipped}`);

        return closed;
    }
}
