/**
 * Zod schemas for workflow configuration validation
 *
 * @module config/schemas
 */

import { z } from 'zod';

/**
 * GitHub projects schema
 */
export const githubProjectsSchema = z
    .object({
        general: z.string().default('Hospeda'),
        api: z.string().default('Hospeda API'),
        admin: z.string().default('Hospeda Admin'),
        web: z.string().default('Hospeda Web')
    })
    .optional();

/**
 * GitHub config schema
 */
export const githubConfigSchema = z.object({
    token: z.string().min(1, 'GitHub token is required'),
    owner: z.string().min(1, 'GitHub owner is required'),
    repo: z.string().min(1, 'GitHub repo is required'),
    projects: githubProjectsSchema,
    projectMapping: z.record(z.string()).optional()
});

/**
 * Planning sync config schema
 */
export const planningSyncConfigSchema = z
    .object({
        enabled: z.boolean().default(true),
        autoSync: z.boolean().default(false),
        projectTemplate: z.string().default('Planning: {featureName}'),
        useTemplates: z.boolean().default(true)
    })
    .optional();

/**
 * TODO sync config schema
 */
export const todoSyncConfigSchema = z
    .object({
        enabled: z.boolean().default(true),
        types: z.array(z.string()).default(['TODO', 'HACK', 'DEBUG']),
        excludePaths: z.array(z.string()).default(['node_modules', 'dist', '.git', 'coverage']),
        useTemplates: z.boolean().default(true)
    })
    .optional();

/**
 * Sync config schema
 */
export const syncConfigSchema = z
    .object({
        planning: planningSyncConfigSchema,
        todos: todoSyncConfigSchema
    })
    .optional();

/**
 * Label source config schema
 */
export const labelSourceSchema = z
    .object({
        todo: z.string().default('todo'),
        hack: z.string().default('hack'),
        debug: z.string().default('debug')
    })
    .optional();

/**
 * Auto-generate labels config schema
 */
export const autoGenerateLabelsSchema = z
    .object({
        type: z.boolean().default(true),
        app: z.boolean().default(true),
        package: z.boolean().default(true),
        priority: z.boolean().default(true),
        difficulty: z.boolean().default(true),
        impact: z.boolean().default(true)
    })
    .optional();

/**
 * Labels config schema
 */
export const labelsConfigSchema = z
    .object({
        universal: z.string().default('from:claude-code'),
        source: labelSourceSchema,
        autoGenerate: autoGenerateLabelsSchema,
        colors: z.record(z.string()).optional()
    })
    .optional();

/**
 * Detection config schema
 */
export const detectionConfigSchema = z
    .object({
        autoComplete: z.boolean().default(true),
        requireTests: z.boolean().default(true),
        requireCoverage: z.number().min(0).max(100).default(90)
    })
    .optional();

/**
 * Enrichment config schema
 */
export const enrichmentConfigSchema = z
    .object({
        enabled: z.boolean().default(true),
        contextLines: z.number().min(0).default(10),
        includeImports: z.boolean().default(true),
        includeRelatedFiles: z.boolean().default(true),
        agent: z.string().default('general-purpose'),
        requestLabels: z.boolean().default(true)
    })
    .optional();

/**
 * Hooks config schema
 */
export const hooksConfigSchema = z
    .object({
        preCommit: z.boolean().default(true),
        postCommit: z.boolean().default(true)
    })
    .optional();

/**
 * Links config schema
 */
export const linksConfigSchema = z
    .object({
        ide: z.enum(['vscode', 'cursor', 'other']).default('vscode'),
        template: z.string().default('vscode://file/{filePath}:{lineNumber}')
    })
    .optional();

/**
 * Templates config schema
 */
export const templatesConfigSchema = z
    .object({
        issuesPath: z.string().default('.github/ISSUE_TEMPLATE'),
        planning: z.string().default('planning-task.md'),
        todo: z.string().default('code-todo.md'),
        hack: z.string().default('code-hack.md')
    })
    .optional();

/**
 * Main workflow config schema
 */
export const workflowConfigSchema = z.object({
    github: githubConfigSchema,
    sync: syncConfigSchema,
    labels: labelsConfigSchema,
    detection: detectionConfigSchema,
    enrichment: enrichmentConfigSchema,
    hooks: hooksConfigSchema,
    links: linksConfigSchema,
    templates: templatesConfigSchema
});

/**
 * Inferred type from workflow config schema
 */
export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;

/**
 * Inferred type from GitHub config schema
 */
export type GitHubConfig = z.infer<typeof githubConfigSchema>;

/**
 * Inferred type from sync config schema
 */
export type SyncConfig = z.infer<typeof syncConfigSchema>;

/**
 * Inferred type from labels config schema
 */
export type LabelsConfig = z.infer<typeof labelsConfigSchema>;

/**
 * Inferred type from detection config schema
 */
export type DetectionConfig = z.infer<typeof detectionConfigSchema>;

/**
 * Inferred type from enrichment config schema
 */
export type EnrichmentConfig = z.infer<typeof enrichmentConfigSchema>;

/**
 * Inferred type from hooks config schema
 */
export type HooksConfig = z.infer<typeof hooksConfigSchema>;

/**
 * Inferred type from links config schema
 */
export type LinksConfig = z.infer<typeof linksConfigSchema>;

/**
 * Inferred type from templates config schema
 */
export type TemplatesConfig = z.infer<typeof templatesConfigSchema>;
