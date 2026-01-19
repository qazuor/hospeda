import type { WorkflowConfig } from '@repo/github-workflow';

/**
 * GitHub Workflow Configuration
 *
 * This file configures the planning sync, todos sync, and other GitHub workflow automation.
 *
 * Environment variables are loaded from .env.local:
 * - GITHUB_TOKEN: GitHub personal access token
 * - GH_OWNER: Repository owner (username or organization)
 * - GH_REPO: Repository name
 */

const config: WorkflowConfig = {
    github: {
        token: process.env.GITHUB_TOKEN || '',
        owner: process.env.GH_OWNER || 'qazuor',
        repo: process.env.GH_REPO || 'hospeda'
    },
    planning: {
        sessionsDir: '.claude/sessions/planning',
        pdrPattern: '**/PDR.md',
        techAnalysisPattern: '**/tech-analysis.md',
        todosPattern: '**/TODOs.md'
    },
    todos: {
        outputDir: '.github-workflow',
        autoSync: false // Set to true to auto-sync on commit
    },
    enrichment: {
        autoEnrich: true,
        triggerLabels: ['planning-sync', 'feature']
    }
};

export default config;
