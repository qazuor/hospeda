/**
 * Issue enrichment with planning context and metadata
 *
 * @module enrichment
 */

export {
    executeClaudeCommand,
    type ClaudeCommand,
    type ClaudeCommandInput,
    type CommandOptions
} from './claude-integration.js';

export {
    detectSessionFromPath,
    loadSessionContext,
    validateSessionStructure,
    clearSessionCache,
    type SessionContext,
    type SessionDetectionResult,
    type SessionValidationResult,
    type SessionContextResult
} from './session-context.js';

export {
    extractPlanningContext,
    type PlanningContext,
    type UserStory,
    type TaskInfo,
    type ExtractContextOptions,
    type ExtractContextResult
} from './context-extractor.js';

export {
    generateIssueTemplate,
    type TemplateOptions,
    type GeneratedTemplate,
    type GenerateTemplateResult
} from './template-engine.js';

export {
    enrichIssue,
    isAlreadyEnriched,
    type IssueEnricherConfig,
    type EnrichIssueOptions,
    type IssueEnrichmentResult
} from './issue-enricher.js';
