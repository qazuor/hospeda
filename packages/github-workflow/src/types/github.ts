/**
 * GitHub API types and interfaces
 *
 * @module types/github
 */

/**
 * GitHub Issue state
 */
export type IssueState = 'open' | 'closed' | 'all';

/**
 * GitHub Issue representation
 */
export type GitHubIssue = {
    /** Issue number */
    number: number;
    /** Issue title */
    title: string;
    /** Issue body/description */
    body: string | null;
    /** Issue state */
    state: IssueState;
    /** Issue labels */
    labels: GitHubLabel[];
    /** Issue assignees */
    assignees: GitHubUser[];
    /** Issue milestone */
    milestone: GitHubMilestone | null;
    /** Creation timestamp */
    created_at: string;
    /** Last update timestamp */
    updated_at: string;
    /** Issue URL */
    html_url: string;
};

/**
 * GitHub Label
 */
export type GitHubLabel = {
    /** Label name */
    name: string;
    /** Label color (hex without #) */
    color: string;
    /** Label description */
    description: string | null;
};

/**
 * GitHub User
 */
export type GitHubUser = {
    /** User login/username */
    login: string;
    /** User ID */
    id: number;
    /** User avatar URL */
    avatar_url: string;
    /** User profile URL */
    html_url: string;
};

/**
 * GitHub Milestone
 */
export type GitHubMilestone = {
    /** Milestone number */
    number: number;
    /** Milestone title */
    title: string;
    /** Milestone description */
    description: string | null;
    /** Milestone state */
    state: 'open' | 'closed';
    /** Due date */
    due_on: string | null;
};

/**
 * GitHub API error response
 */
export type GitHubError = {
    /** Error message */
    message: string;
    /** Documentation URL */
    documentation_url?: string;
    /** HTTP status code */
    status?: number;
};

/**
 * Create issue payload
 */
export type CreateIssueInput = {
    /** Issue title */
    title: string;
    /** Issue body */
    body?: string;
    /** Label names */
    labels?: string[];
    /** Assignee usernames */
    assignees?: string[];
    /** Milestone number */
    milestone?: number;
};

/**
 * Update issue payload
 */
export type UpdateIssueInput = Partial<CreateIssueInput> & {
    /** Issue state */
    state?: IssueState;
};

/**
 * GitHub client configuration
 */
export type GitHubClientConfig = {
    /** GitHub personal access token */
    token: string;
    /** Repository owner */
    owner: string;
    /** Repository name */
    repo: string;
};
