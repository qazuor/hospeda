/**
 * Example configuration file for GitHub Workflow
 *
 * Copy this file to `.github-workflow.config.ts` and customize as needed.
 *
 * @example
 * ```bash
 * cp .github-workflow.config.example.ts .github-workflow.config.ts
 * ```
 */

import type { WorkflowConfig } from './src/config';

/**
 * GitHub Workflow configuration
 *
 * This configuration controls all aspects of the GitHub workflow automation
 * including planning sync, TODO generation, and issue enrichment.
 */
export default {
    // ========================================
    // GitHub Configuration (REQUIRED)
    // ========================================
    github: {
        /**
         * GitHub API token for authentication
         *
         * Get a token from: https://github.com/settings/tokens
         * Required scopes: repo, write:packages
         */
        // biome-ignore lint/style/noNonNullAssertion: Example file - ensure token is set in your .env
        token: process.env.GITHUB_TOKEN!,

        /**
         * Repository owner (organization or user)
         */
        owner: 'hospeda',

        /**
         * Repository name
         */
        repo: 'main',

        /**
         * Project names for different components (optional)
         */
        projects: {
            general: 'Hospeda',
            api: 'Hospeda API',
            admin: 'Hospeda Admin',
            web: 'Hospeda Web'
        },

        /**
         * Project mapping based on file patterns (optional)
         *
         * Maps glob patterns to project keys
         */
        projectMapping: {
            'apps/api/**': 'api',
            'apps/admin/**': 'admin',
            'apps/web/**': 'web',
            'packages/**': 'general'
        }
    },

    // ========================================
    // Sync Configuration (optional)
    // ========================================
    sync: {
        /**
         * Planning session sync configuration
         */
        planning: {
            /**
             * Enable planning session sync
             * @default true
             */
            enabled: true,

            /**
             * Automatically sync on changes
             * @default false
             */
            autoSync: false,

            /**
             * Project name template
             * Available variables: {featureName}, {sessionId}
             * @default 'Planning: {featureName}'
             */
            projectTemplate: 'Planning: {featureName}',

            /**
             * Use GitHub issue templates
             * @default true
             */
            useTemplates: true
        },

        /**
         * TODO sync configuration
         */
        todos: {
            /**
             * Enable TODO sync
             * @default true
             */
            enabled: true,

            /**
             * TODO types to detect
             * @default ['TODO', 'HACK', 'DEBUG']
             */
            types: ['TODO', 'HACK', 'FIXME', 'DEBUG'],

            /**
             * Paths to exclude from TODO detection
             * @default ['node_modules', 'dist', '.git', 'coverage']
             */
            excludePaths: [
                'node_modules',
                'dist',
                '.git',
                'coverage',
                '*.test.ts',
                '*.spec.ts',
                '.next',
                '.turbo'
            ],

            /**
             * Use GitHub issue templates for TODOs
             * @default true
             */
            useTemplates: true
        }
    },

    // ========================================
    // Labels Configuration (optional)
    // ========================================
    labels: {
        /**
         * Universal label applied to all synced issues
         * @default 'from:claude-code'
         */
        universal: 'from:claude-code',

        /**
         * Source labels for different TODO types
         */
        source: {
            todo: 'todo',
            hack: 'hack',
            debug: 'debug'
        },

        /**
         * Auto-generate labels based on context
         */
        autoGenerate: {
            type: true, // type:feature, type:bug, etc.
            app: true, // app:web, app:api, etc.
            package: true, // pkg:db, pkg:service-core, etc.
            priority: true, // priority:high, priority:medium, etc.
            difficulty: true, // difficulty:easy, difficulty:hard, etc.
            impact: true // impact:high, impact:low, etc.
        },

        /**
         * Label colors (hex without #)
         */
        colors: {
            'from:claude-code': '0E8A16',
            'type:feature': '1D76DB',
            'type:bug': 'B60205',
            'app:api': 'FBCA04',
            'app:web': 'FBCA04',
            'app:admin': 'FBCA04',
            'pkg:db': 'D4C5F9',
            'priority:critical': 'B60205',
            'priority:high': 'D93F0B',
            'priority:medium': 'FBCA04',
            'priority:low': '0E8A16',
            todo: 'FEF2C0',
            hack: 'F9D0C4',
            debug: 'BFD4F2'
        }
    },

    // ========================================
    // Detection Configuration (optional)
    // ========================================
    detection: {
        /**
         * Auto-complete issues when code is committed
         * @default true
         */
        autoComplete: true,

        /**
         * Require tests before completing
         * @default true
         */
        requireTests: true,

        /**
         * Minimum test coverage required
         * @default 90
         */
        requireCoverage: 90
    },

    // ========================================
    // Enrichment Configuration (optional)
    // ========================================
    enrichment: {
        /**
         * Enable automatic issue enrichment
         * @default true
         */
        enabled: true,

        /**
         * Number of context lines to include
         * @default 10
         */
        contextLines: 15,

        /**
         * Include import statements in context
         * @default true
         */
        includeImports: true,

        /**
         * Include related files in context
         * @default true
         */
        includeRelatedFiles: true,

        /**
         * Agent to use for enrichment
         * @default 'general-purpose'
         */
        agent: 'general-purpose',

        /**
         * Request label suggestions from agent
         * @default true
         */
        requestLabels: true
    },

    // ========================================
    // Git Hooks Configuration (optional)
    // ========================================
    hooks: {
        /**
         * Run validation before commit
         * @default true
         */
        preCommit: true,

        /**
         * Sync issues after commit
         * @default true
         */
        postCommit: true
    },

    // ========================================
    // IDE Links Configuration (optional)
    // ========================================
    links: {
        /**
         * IDE type for file links
         * @default 'vscode'
         */
        ide: 'vscode', // 'vscode' | 'cursor' | 'other'

        /**
         * Link template for IDE
         * Available variables: {filePath}, {lineNumber}
         * @default 'vscode://file/{filePath}:{lineNumber}'
         */
        template: 'vscode://file/{filePath}:{lineNumber}'
    },

    // ========================================
    // Templates Configuration (optional)
    // ========================================
    templates: {
        /**
         * Path to GitHub issue templates
         * @default '.github/ISSUE_TEMPLATE'
         */
        issuesPath: '.github/ISSUE_TEMPLATE',

        /**
         * Planning task template name
         * @default 'planning-task.md'
         */
        planning: 'planning-task.md',

        /**
         * TODO template name
         * @default 'code-todo.md'
         */
        todo: 'code-todo.md',

        /**
         * HACK template name
         * @default 'code-hack.md'
         */
        hack: 'code-hack.md'
    }
} satisfies WorkflowConfig;
