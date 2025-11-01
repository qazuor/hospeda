/**
 * Configuration types for GitHub workflow automation
 *
 * @module types/config
 *
 * @deprecated These types are now auto-generated from Zod schemas.
 * Import from '@repo/github-workflow/config' instead.
 *
 * @example
 * ```typescript
 * // Old way (deprecated)
 * import type { WorkflowConfig } from '@repo/github-workflow/types';
 *
 * // New way (recommended)
 * import type { WorkflowConfig } from '@repo/github-workflow/config';
 * ```
 */

// Re-export types from config module to maintain backward compatibility
export type {
    WorkflowConfig,
    GitHubConfig,
    SyncConfig,
    LabelsConfig,
    DetectionConfig,
    EnrichmentConfig,
    HooksConfig,
    LinksConfig,
    TemplatesConfig
} from '../config/schemas';
