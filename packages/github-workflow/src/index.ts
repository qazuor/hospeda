/**
 * GitHub Workflow Automation Package
 *
 * Provides automation for:
 * - Planning session sync to GitHub Issues
 * - TODO generation from planning documents
 * - Issue enrichment with planning context
 * - Git hooks for workflow enforcement
 *
 * @module @repo/github-workflow
 */

export * from './types/index.ts';
export * from './core/index.ts';
export * from './parsers/index.ts';
export * from './sync/index.ts';
export * from './enrichment/index.ts';
export * from './config/index.ts';
export * from './commands/index.ts';
export * from './hooks/index.ts';
export * from './utils/index.ts';
