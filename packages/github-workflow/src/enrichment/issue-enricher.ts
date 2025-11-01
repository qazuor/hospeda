/**
 * Issue enricher with planning context
 *
 * Fetches existing GitHub issues and enriches them with planning context
 * from PDR.md, tech-analysis.md, and TODOs.md files.
 *
 * @module enrichment/issue-enricher
 */

import { Octokit } from '@octokit/rest';
import type { GitHubIssue } from '../types/github.js';
import { extractPlanningContext } from './context-extractor.js';
import { generateIssueTemplate } from './template-engine.js';

/**
 * GitHub configuration for enricher API access
 */
export type IssueEnricherConfig = {
    /** GitHub personal access token */
    token: string;
    /** Repository owner/organization */
    owner: string;
    /** Repository name */
    repo: string;
};

/**
 * Options for enriching a GitHub issue
 */
export type EnrichIssueOptions = {
    /** GitHub issue number to enrich */
    issueNumber: number;
    /** Path to planning session directory */
    sessionPath: string;
    /** GitHub API configuration */
    githubConfig: IssueEnricherConfig;
    /** Optional: specific task code to enrich with (e.g., T-001-001) */
    taskCode?: string;
    /** Optional: dry-run mode (no actual changes) */
    dryRun?: boolean;
};

/**
 * Result of issue enrichment operation
 */
export type IssueEnrichmentResult = {
    /** Whether operation succeeded */
    success: boolean;
    /** GitHub issue number */
    issueNumber: number;
    /** Whether enrichment was applied (false if already enriched) */
    enriched: boolean;
    /** Human-readable message */
    message: string;
    /** Additional details if successful */
    details?: {
        /** Planning session ID */
        sessionId: string;
        /** Task code if task-specific enrichment */
        taskCode?: string;
        /** Labels added to issue */
        labelsAdded: string[];
        /** Whether tracking was updated */
        trackingUpdated: boolean;
    };
};

/**
 * Marker used to detect if issue is already enriched
 */
const ENRICHMENT_MARKER = '## 📋 Planning Context';

/**
 * Enrich a GitHub issue with planning context
 *
 * Fetches the existing issue, checks if already enriched, and if not,
 * appends planning context from the session files. Supports dry-run mode
 * for testing without making actual changes.
 *
 * @param input - Enrichment options
 * @returns Enrichment result
 *
 * @example
 * ```typescript
 * const result = await enrichIssue({
 *   issueNumber: 42,
 *   sessionPath: '.claude/sessions/planning/P-001-feature',
 *   githubConfig: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'myorg',
 *     repo: 'myrepo'
 *   }
 * });
 *
 * if (result.success && result.enriched) {
 *   console.log('Issue enriched successfully!');
 * }
 * ```
 */
export async function enrichIssue(input: EnrichIssueOptions): Promise<IssueEnrichmentResult> {
    const { issueNumber, sessionPath, githubConfig, taskCode, dryRun = false } = input;

    // Validate inputs
    const validation = validateInputs(input);
    if (!validation.valid) {
        return {
            success: false,
            issueNumber,
            enriched: false,
            message: validation.error ?? 'Validation failed'
        };
    }

    try {
        // Initialize Octokit
        const octokit = new Octokit({
            auth: githubConfig.token
        });

        // Fetch existing issue
        const { data: rawIssue } = await octokit.issues.get({
            owner: githubConfig.owner,
            repo: githubConfig.repo,
            issue_number: issueNumber
        });

        // Cast to our type (body is always null or string in practice)
        const issue = rawIssue as GitHubIssue;

        // Check if already enriched
        if (isAlreadyEnriched(issue.body ?? null)) {
            return {
                success: true,
                issueNumber,
                enriched: false,
                message: `Issue #${issueNumber} is already enriched with planning context`
            };
        }

        // Extract planning context
        const contextResult = await extractPlanningContext({
            sessionPath
        });

        if (!contextResult.success || !contextResult.context) {
            return {
                success: false,
                issueNumber,
                enriched: false,
                message: `Failed to extract planning context: ${contextResult.error}`
            };
        }

        const context = contextResult.context;

        // Generate enrichment section
        const templateResult = generateIssueTemplate({
            type: taskCode ? 'task' : 'feature',
            context,
            taskCode,
            sessionPath
        });

        if (!templateResult.success || !templateResult.template) {
            return {
                success: false,
                issueNumber,
                enriched: false,
                message: `Failed to generate enrichment template: ${templateResult.error}`
            };
        }

        // Build enriched body
        const originalBody = issue.body || '';
        const enrichmentSection = buildEnrichmentSection(templateResult.template.body);
        const enrichedBody = `${originalBody}\n\n---\n\n${enrichmentSection}`.trim();

        // Determine labels to add
        const labelsToAdd = determineLabels(
            issue,
            templateResult.template.labels,
            taskCode !== undefined
        );

        // Apply changes (unless dry-run)
        if (!dryRun) {
            // Update issue body
            await octokit.issues.update({
                owner: githubConfig.owner,
                repo: githubConfig.repo,
                issue_number: issueNumber,
                body: enrichedBody
            });

            // Add labels
            if (labelsToAdd.length > 0) {
                await octokit.issues.addLabels({
                    owner: githubConfig.owner,
                    repo: githubConfig.repo,
                    issue_number: issueNumber,
                    labels: labelsToAdd
                });
            }
        }

        return {
            success: true,
            issueNumber,
            enriched: true,
            message: dryRun
                ? `Issue #${issueNumber} would be enriched (dry-run mode)`
                : `Issue #${issueNumber} enriched successfully`,
            details: {
                sessionId: context.sessionId,
                taskCode,
                labelsAdded: labelsToAdd,
                trackingUpdated: !dryRun
            }
        };
    } catch (error) {
        // Handle GitHub API errors
        const apiError = error as { status?: number; message?: string };

        if (apiError.status === 404) {
            return {
                success: false,
                issueNumber,
                enriched: false,
                message: `Issue #${issueNumber} not found in ${githubConfig.owner}/${githubConfig.repo}`
            };
        }

        return {
            success: false,
            issueNumber,
            enriched: false,
            message: `Failed to enrich issue: ${apiError.message || 'Unknown error'}`
        };
    }
}

/**
 * Check if an issue body is already enriched
 *
 * Looks for the enrichment marker in the issue body to determine
 * if planning context has already been added.
 *
 * @param body - Issue body text (can be null)
 * @returns True if already enriched, false otherwise
 *
 * @example
 * ```typescript
 * if (isAlreadyEnriched(issue.body)) {
 *   console.log('Issue already has planning context');
 * }
 * ```
 */
export function isAlreadyEnriched(body: string | null): boolean {
    if (!body || body.trim() === '') {
        return false;
    }

    return body.includes(ENRICHMENT_MARKER);
}

/**
 * Validate enrichment inputs
 */
function validateInputs(input: EnrichIssueOptions): {
    valid: boolean;
    error?: string;
} {
    // Validate issue number
    if (!input.issueNumber || input.issueNumber <= 0) {
        return {
            valid: false,
            error: 'Issue number must be a positive integer'
        };
    }

    // Validate session path
    if (!input.sessionPath || input.sessionPath.trim() === '') {
        return {
            valid: false,
            error: 'Session path is required'
        };
    }

    // Validate GitHub config
    if (!input.githubConfig) {
        return {
            valid: false,
            error: 'GitHub configuration is required'
        };
    }

    if (!input.githubConfig.token || input.githubConfig.token.trim() === '') {
        return {
            valid: false,
            error: 'GitHub token is required'
        };
    }

    if (!input.githubConfig.owner || input.githubConfig.owner.trim() === '') {
        return {
            valid: false,
            error: 'GitHub owner is required'
        };
    }

    if (!input.githubConfig.repo || input.githubConfig.repo.trim() === '') {
        return {
            valid: false,
            error: 'GitHub repo is required'
        };
    }

    return { valid: true };
}

/**
 * Build enrichment section with marker
 */
function buildEnrichmentSection(templateBody: string): string {
    return `${ENRICHMENT_MARKER}\n\n${templateBody}`;
}

/**
 * Determine which labels to add to the issue
 */
function determineLabels(issue: GitHubIssue, suggestedLabels: string[], isTask: boolean): string[] {
    // Get existing label names
    const existingLabels = new Set(issue.labels.map((label) => label.name));

    // Start with suggested labels from template
    const labelsToAdd = new Set(suggestedLabels);

    // Always add planning-context label
    labelsToAdd.add('planning-context');

    // Add task label if task-specific enrichment
    if (isTask) {
        labelsToAdd.add('task');
    }

    // Filter out labels that already exist
    return Array.from(labelsToAdd).filter((label) => !existingLabels.has(label));
}
