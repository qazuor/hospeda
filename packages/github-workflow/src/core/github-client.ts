/**
 * GitHub API client for issue management
 *
 * @module core/github-client
 */

import { graphql } from '@octokit/graphql';
import { Octokit } from '@octokit/rest';
import type {
    CreateIssueInput,
    GitHubClientConfig,
    GitHubLabel,
    UpdateIssueInput
} from '../types/github';

/**
 * GitHub client for managing issues, labels, and project items
 *
 * Provides methods for creating, updating, and linking GitHub issues,
 * as well as managing labels with intelligent caching.
 *
 * @example
 * ```typescript
 * const client = new GitHubClient({
 *   token: process.env.GITHUB_TOKEN,
 *   owner: 'hospeda',
 *   repo: 'main',
 * });
 *
 * const issueNumber = await client.createIssue({
 *   title: 'New feature',
 *   body: 'Feature description',
 *   labels: ['feature', 'priority-high'],
 * });
 * ```
 */
export class GitHubClient {
    private octokit: Octokit;
    private graphqlClient: typeof graphql;
    private config: GitHubClientConfig;
    private labelCache: Map<string, GitHubLabel>;

    /**
     * Create a new GitHub client instance
     *
     * @param config - Client configuration
     * @throws {Error} If token, owner, or repo is missing
     */
    constructor(config: GitHubClientConfig) {
        // Validate configuration
        if (!config.token) {
            throw new Error('GitHub token is required');
        }
        if (!config.owner) {
            throw new Error('GitHub owner is required');
        }
        if (!config.repo) {
            throw new Error('GitHub repository is required');
        }

        this.config = config;
        this.octokit = new Octokit({ auth: config.token });
        this.graphqlClient = graphql.defaults({
            headers: {
                authorization: `token ${config.token}`
            }
        });
        this.labelCache = new Map();
    }

    /**
     * Create a new GitHub issue
     *
     * @param input - Issue creation data
     * @returns Issue number of created issue
     * @throws {Error} If issue creation fails
     *
     * @example
     * ```typescript
     * const issueNumber = await client.createIssue({
     *   title: 'Bug report',
     *   body: 'Description of the bug',
     *   labels: ['bug', 'priority-high'],
     *   assignees: ['username'],
     * });
     * ```
     */
    async createIssue(input: CreateIssueInput): Promise<number> {
        try {
            const response = await this.octokit.rest.issues.create({
                owner: this.config.owner,
                repo: this.config.repo,
                title: input.title,
                body: input.body,
                labels: input.labels,
                assignees: input.assignees,
                milestone: input.milestone
            });

            return response.data.number;
        } catch (error) {
            throw this.handleApiError(error, 'Failed to create issue');
        }
    }

    /**
     * Update an existing GitHub issue
     *
     * @param issueNumber - Issue number to update
     * @param input - Fields to update
     * @throws {Error} If issue update fails or issue not found
     *
     * @example
     * ```typescript
     * await client.updateIssue(123, {
     *   title: 'Updated title',
     *   state: 'closed',
     * });
     * ```
     */
    async updateIssue(issueNumber: number, input: UpdateIssueInput): Promise<void> {
        try {
            // Filter out 'all' state as it's not valid for updates (only for queries)
            const validState = input.state === 'all' ? undefined : input.state;

            await this.octokit.rest.issues.update({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                title: input.title,
                body: input.body,
                state: validState,
                labels: input.labels,
                assignees: input.assignees,
                milestone: input.milestone
            });
        } catch (error) {
            throw this.handleApiError(error, 'Failed to update issue');
        }
    }

    /**
     * Close a GitHub issue
     *
     * @param issueNumber - Issue number to close
     * @throws {Error} If issue close fails
     *
     * @example
     * ```typescript
     * await client.closeIssue(123);
     * ```
     */
    async closeIssue(issueNumber: number): Promise<void> {
        await this.updateIssue(issueNumber, { state: 'closed' });
    }

    /**
     * Link a child issue to a parent issue
     *
     * Creates a comment in the child issue referencing the parent.
     *
     * @param parentNumber - Parent issue number
     * @param childNumber - Child issue number
     * @throws {Error} If issue linking fails or issue numbers are invalid
     *
     * @example
     * ```typescript
     * await client.linkIssues(123, 456);
     * // Creates comment in issue #456: "Parent issue: #123"
     * ```
     */
    async linkIssues(parentNumber: number, childNumber: number): Promise<void> {
        // Validate issue numbers
        if (!parentNumber || parentNumber <= 0) {
            throw new Error('Invalid parent issue number');
        }
        if (!childNumber || childNumber <= 0) {
            throw new Error('Invalid child issue number');
        }

        try {
            await this.octokit.rest.issues.createComment({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: childNumber,
                body: `Parent issue: #${parentNumber}`
            });
        } catch (error) {
            throw this.handleApiError(error, 'Failed to link issues');
        }
    }

    /**
     * Create a new label in the repository
     *
     * If the label already exists, this operation is idempotent and will not fail.
     * Created labels are automatically cached for performance.
     *
     * @param label - Label data (name, color, description)
     * @throws {Error} If label creation fails (except for duplicates)
     *
     * @example
     * ```typescript
     * await client.createLabel({
     *   name: 'priority-high',
     *   color: 'FF0000',
     *   description: 'High priority items',
     * });
     * ```
     */
    async createLabel(label: GitHubLabel): Promise<void> {
        try {
            await this.octokit.rest.issues.createLabel({
                owner: this.config.owner,
                repo: this.config.repo,
                name: label.name,
                color: label.color,
                description: label.description || undefined
            });

            // Cache the created label
            this.labelCache.set(label.name, label);
        } catch (error) {
            // If label already exists, just cache it and don't throw
            const err = error as { status?: number; message?: string };
            if (err.status === 422 && err.message?.includes('already exists')) {
                this.labelCache.set(label.name, label);
                return;
            }
            throw this.handleApiError(error, 'Failed to create label');
        }
    }

    /**
     * Add labels to an issue
     *
     * Automatically creates labels if they don't exist (with default color D4C5F9).
     * Uses label cache to minimize API calls.
     *
     * @param issueNumber - Issue number to add labels to
     * @param labels - Array of label names
     * @throws {Error} If adding labels fails
     *
     * @example
     * ```typescript
     * await client.addLabels(123, ['bug', 'priority-high', 'needs-review']);
     * ```
     */
    async addLabels(issueNumber: number, labels: string[]): Promise<void> {
        // Ensure all labels exist before adding them
        for (const labelName of labels) {
            await this.ensureLabelExists(labelName);
        }

        try {
            await this.octokit.rest.issues.addLabels({
                owner: this.config.owner,
                repo: this.config.repo,
                issue_number: issueNumber,
                labels
            });
        } catch (error) {
            throw this.handleApiError(error, 'Failed to add labels');
        }
    }

    /**
     * Ensure a label exists, creating it if necessary
     *
     * Checks cache first, then checks GitHub, and creates if not found.
     *
     * @param name - Label name
     * @param color - Label color (default: D4C5F9)
     * @private
     */
    private async ensureLabelExists(name: string, color = 'D4C5F9'): Promise<void> {
        // Check cache first
        if (this.labelCache.has(name)) {
            return;
        }

        try {
            // Try to get existing label
            const response = await this.octokit.rest.issues.getLabel({
                owner: this.config.owner,
                repo: this.config.repo,
                name
            });

            // Add to cache
            this.labelCache.set(name, {
                name: response.data.name,
                color: response.data.color,
                description: response.data.description || null
            });
        } catch (error) {
            // Label doesn't exist, create it
            const err = error as { status?: number };
            if (err.status === 404) {
                await this.createLabel({ name, color, description: null });
            } else {
                throw error;
            }
        }
    }

    /**
     * Handle API errors with proper error messages
     *
     * @param error - Error from API call
     * @param defaultMessage - Default error message
     * @returns Never - always throws
     * @throws {Error} With appropriate error message
     * @private
     */
    private handleApiError(error: unknown, defaultMessage: string): never {
        const err = error as {
            status?: number;
            message?: string;
            response?: {
                headers?: {
                    'x-ratelimit-reset'?: string;
                };
            };
        };

        // Handle rate limiting
        if (err.status === 403 && err.message?.toLowerCase().includes('rate limit')) {
            throw new Error('GitHub API rate limit exceeded');
        }

        // Handle not found
        if (err.status === 404) {
            throw new Error('Issue not found');
        }

        // Handle validation errors
        if (err.status === 422) {
            throw new Error(`${defaultMessage}: ${err.message || 'Validation failed'}`);
        }

        // Default error
        throw new Error(`${defaultMessage}: ${err.message || 'Unknown error'}`);
    }
}
