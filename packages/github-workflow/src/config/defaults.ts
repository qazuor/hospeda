/**
 * Default configuration values for GitHub workflow
 *
 * @module config/defaults
 */

import type { WorkflowConfig } from './schemas';

/**
 * Default configuration for GitHub workflow
 *
 * These values are merged with user configuration.
 * User values take precedence over defaults.
 */
export const defaultConfig: Partial<WorkflowConfig> = {
    sync: {
        planning: {
            enabled: true,
            autoSync: false,
            projectTemplate: 'Planning: {featureName}',
            useTemplates: true
        },
        todos: {
            enabled: true,
            types: ['TODO', 'HACK', 'DEBUG'],
            excludePaths: ['node_modules', 'dist', '.git', 'coverage', '*.test.ts', '*.spec.ts'],
            useTemplates: true
        }
    },

    labels: {
        universal: 'from:claude-code',
        source: {
            todo: 'todo',
            hack: 'hack',
            debug: 'debug'
        },
        autoGenerate: {
            type: true,
            app: true,
            package: true,
            priority: true,
            difficulty: true,
            impact: true
        },
        colors: {
            'from:claude-code': '0E8A16',
            'type:*': '1D76DB',
            'app:*': 'FBCA04',
            'pkg:*': 'D4C5F9',
            'priority:critical': 'B60205',
            'priority:high': 'D93F0B',
            'priority:medium': 'FBCA04',
            'priority:low': '0E8A16',
            'difficulty:*': 'C2E0C6',
            'impact:*': 'D93F0B',
            'planning:*': '5319E7',
            todo: 'FEF2C0',
            hack: 'F9D0C4',
            debug: 'BFD4F2'
        }
    },

    detection: {
        autoComplete: true,
        requireTests: true,
        requireCoverage: 90
    },

    enrichment: {
        enabled: true,
        contextLines: 10,
        includeImports: true,
        includeRelatedFiles: true,
        agent: 'general-purpose',
        requestLabels: true
    },

    hooks: {
        preCommit: true,
        postCommit: true
    },

    links: {
        ide: 'vscode',
        template: 'vscode://file/{filePath}:{lineNumber}'
    },

    templates: {
        issuesPath: '.github/ISSUE_TEMPLATE',
        planning: 'planning-task.md',
        todo: 'code-todo.md',
        hack: 'code-hack.md'
    }
};
