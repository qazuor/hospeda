/**
 * Linear Client Wrapper
 * Simple wrapper around Linear SDK for planning sync operations
 */

import { LinearClient } from '@linear/sdk';
import type { LinearSyncConfig, TaskStatus } from './types.js';

/**
 * Simple Linear client for planning synchronization
 */
export class PlanningLinearClient {
    private client: LinearClient;
    private teamId: string;
    private parentLabel: string;

    constructor(config: LinearSyncConfig) {
        this.client = new LinearClient({ apiKey: config.apiKey });
        this.teamId = config.teamId;
        this.parentLabel = config.parentLabel || 'Planning';
    }

    /**
     * Creates or updates a parent planning issue
     *
     * @param params - Parent issue parameters
     * @returns Issue ID and URL
     */
    async createOrUpdateParentIssue(params: {
        title: string;
        description: string;
        existingIssueId?: string;
    }): Promise<{ id: string; url: string }> {
        if (params.existingIssueId) {
            // Update existing issue
            const issue = await this.client.issue(params.existingIssueId);
            await issue.update({
                title: params.title,
                description: params.description
            });

            return {
                id: params.existingIssueId,
                url: issue.url || ''
            };
        }

        // Create new parent issue
        const labelId = await this.getOrCreateLabel(this.parentLabel);

        const issuePayload = await this.client.createIssue({
            teamId: this.teamId,
            title: params.title,
            description: params.description,
            labelIds: labelId ? [labelId] : undefined
        });

        const issue = await issuePayload.issue;
        if (!issue) {
            throw new Error('Failed to create parent issue');
        }

        return {
            id: issue.id,
            url: issue.url || ''
        };
    }

    /**
     * Creates a sub-issue linked to parent
     *
     * @param params - Sub-issue parameters
     * @returns Issue ID and URL
     */
    async createSubIssue(params: {
        parentId: string;
        title: string;
        description?: string;
    }): Promise<{ id: string; url: string }> {
        const issuePayload = await this.client.createIssue({
            teamId: this.teamId,
            title: params.title,
            description: params.description || '',
            parentId: params.parentId
        });

        const issue = await issuePayload.issue;
        if (!issue) {
            throw new Error('Failed to create sub-issue');
        }

        return {
            id: issue.id,
            url: issue.url || ''
        };
    }

    /**
     * Updates an issue's status
     *
     * @param issueId - Linear issue ID
     * @param status - New status
     */
    async updateIssueStatus(issueId: string, status: TaskStatus): Promise<void> {
        const issue = await this.client.issue(issueId);
        const team = await this.client.team(this.teamId);
        const states = await team.states();

        // Map our status to Linear state
        const targetStateName = this.mapStatusToStateName(status);

        // Find matching state
        const targetState = states.nodes.find((s) =>
            s.name.toLowerCase().includes(targetStateName)
        );

        if (!targetState) {
            console.warn(`Could not find Linear state for status: ${status}, skipping update`);
            return;
        }

        await issue.update({
            stateId: targetState.id
        });
    }

    /**
     * Gets label by name (returns existing label or null)
     *
     * Note: Label creation requires manual setup in Linear UI
     *
     * @param name - Label name
     * @returns Label ID or null if not found
     */
    private async getOrCreateLabel(name: string): Promise<string | null> {
        try {
            const team = await this.client.team(this.teamId);
            const labels = await team.labels();

            // Find existing label
            const existing = labels.nodes.find((l) => l.name.toLowerCase() === name.toLowerCase());

            return existing?.id || null;
        } catch (error) {
            console.error('Failed to get label:', error);
            return null;
        }
    }

    /**
     * Maps TaskStatus to Linear state name
     */
    private mapStatusToStateName(status: TaskStatus): string {
        switch (status) {
            case 'completed':
                return 'done';
            case 'in_progress':
                return 'in progress';
            default:
                return 'todo';
        }
    }

    /**
     * Gets issue URL by ID
     *
     * @param issueId - Linear issue ID
     * @returns Issue URL
     */
    async getIssueUrl(issueId: string): Promise<string> {
        const issue = await this.client.issue(issueId);
        return issue.url || '';
    }
}
