/**
 * GitHub Workflow Configuration Example
 *
 * Copy this file to `.github-workflow.config.ts` and configure with your values.
 *
 * @see packages/github-workflow/docs/SETUP.md for detailed setup instructions
 */

import type { WorkflowConfig } from '@repo/github-workflow';

export default {
    github: {
        token: process.env.GITHUB_TOKEN || '',
        owner: process.env.GH_OWNER || 'hospeda',
        repo: process.env.GH_REPO || 'main'
    },
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
            excludePaths: ['node_modules', 'dist', '.git', 'coverage'],
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
} satisfies WorkflowConfig;
