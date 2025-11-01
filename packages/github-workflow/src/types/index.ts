/**
 * Type definitions for GitHub workflow automation
 *
 * @module types
 */

export type {
    GitHubConfig,
    SyncConfig,
    LabelsConfig,
    DetectionConfig,
    EnrichmentConfig,
    HooksConfig,
    LinksConfig,
    TemplatesConfig,
    WorkflowConfig
} from './config.ts';

export type {
    IssueState,
    GitHubIssue,
    GitHubLabel,
    GitHubUser,
    GitHubMilestone,
    GitHubError,
    CreateIssueInput,
    UpdateIssueInput
} from './github.ts';

export type {
    PlanningSession,
    TodoItem,
    LegacySyncResult,
    EnrichmentResult,
    WorkflowContext
} from './workflow.ts';
