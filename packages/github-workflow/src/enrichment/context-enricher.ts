/**
 * Planning context enricher
 *
 * Extracts and enriches GitHub issues with planning context from sessions.
 *
 * @module enrichment/context-enricher
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@repo/logger';
import type { EnrichmentOptions, EnrichmentTask, PlanningContext } from './types.js';

/**
 * Extract planning context from a planning session
 *
 * Reads PDR.md, tech-analysis.md, and TODOs.md to extract relevant context.
 *
 * @param sessionPath - Path to planning session directory
 * @returns Planning context
 *
 * @example
 * ```typescript
 * const context = await extractPlanningContext('.claude/sessions/planning/P-001');
 * console.log(context.pdr.overview);
 * console.log(context.techAnalysis.architectureDecisions);
 * ```
 */
export async function extractPlanningContext(sessionPath: string): Promise<PlanningContext> {
    logger.debug({ sessionPath }, 'Extracting planning context');

    const context: PlanningContext = {
        sessionPath,
        tasks: []
    };

    // Extract PDR content
    const pdrPath = join(sessionPath, 'PDR.md');
    if (existsSync(pdrPath)) {
        const pdrContent = readFileSync(pdrPath, 'utf-8');
        context.pdr = extractPDRContent(pdrContent);
    }

    // Extract tech analysis content
    const techAnalysisPath = join(sessionPath, 'tech-analysis.md');
    if (existsSync(techAnalysisPath)) {
        const techContent = readFileSync(techAnalysisPath, 'utf-8');
        context.techAnalysis = extractTechAnalysisContent(techContent);
    }

    // Extract tasks
    const todosPath = join(sessionPath, 'TODOs.md');
    if (existsSync(todosPath)) {
        const todosContent = readFileSync(todosPath, 'utf-8');
        context.tasks = extractTasks(todosContent);
    }

    logger.debug(
        {
            hasPDR: !!context.pdr,
            hasTechAnalysis: !!context.techAnalysis,
            taskCount: context.tasks.length
        },
        'Planning context extracted'
    );

    return context;
}

/**
 * Enrich issue body with planning context
 *
 * Adds relevant planning information to issue body.
 *
 * @param options - Enrichment options
 * @returns Enriched issue body
 *
 * @example
 * ```typescript
 * const enrichedBody = await enrichIssueWithContext({
 *   body: '## Task\n\nImplement login',
 *   sessionPath: '.claude/sessions/planning/P-001',
 *   taskCode: 'T-001-001'
 * });
 * ```
 */
export async function enrichIssueWithContext(options: EnrichmentOptions): Promise<string> {
    const {
        body,
        sessionPath,
        taskCode,
        includeUserStories = true,
        includeArchitectureDecisions = true,
        includeAcceptanceCriteria = true,
        includeDependencies = true
    } = options;

    logger.debug({ taskCode, sessionPath }, 'Enriching issue with context');

    // Extract planning context
    const context = await extractPlanningContext(sessionPath);

    // Find task
    const task = context.tasks.find((t) => t.code === taskCode);

    // Build enrichment sections
    const sections: string[] = [body, '', '---', '', '## Planning Context', ''];

    // Add user stories
    if (includeUserStories && context.pdr?.userStories && context.pdr.userStories.length > 0) {
        sections.push('### User Stories', '');
        for (const story of context.pdr.userStories) {
            sections.push(`- ${story}`);
        }
        sections.push('');
    }

    // Add architecture decisions
    if (
        includeArchitectureDecisions &&
        context.techAnalysis?.architectureDecisions &&
        context.techAnalysis.architectureDecisions.length > 0
    ) {
        sections.push('### Architecture Decisions', '');
        for (const decision of context.techAnalysis.architectureDecisions) {
            sections.push(`- ${decision}`);
        }
        sections.push('');
    }

    // Add acceptance criteria
    if (
        includeAcceptanceCriteria &&
        context.pdr?.acceptanceCriteria &&
        context.pdr.acceptanceCriteria.length > 0
    ) {
        sections.push('### Acceptance Criteria', '');
        for (const criteria of context.pdr.acceptanceCriteria) {
            sections.push(`- ${criteria}`);
        }
        sections.push('');
    }

    // Add dependencies
    if (includeDependencies && task?.dependencies && task.dependencies.length > 0) {
        sections.push('### Dependencies', '');
        for (const dep of task.dependencies) {
            sections.push(`- ${dep}`);
        }
        sections.push('');
    }

    const enrichedBody = sections.join('\n').trim();

    logger.debug({ taskCode }, 'Issue enriched with context');

    return enrichedBody;
}

/**
 * Extract PDR content
 */
function extractPDRContent(content: string): PlanningContext['pdr'] {
    const overview = extractSection(content, 'Overview');
    const userStories = extractListItems(content, 'User Stories');
    const acceptanceCriteria = extractListItems(content, 'Acceptance Criteria');

    return {
        overview: overview || '',
        userStories,
        acceptanceCriteria
    };
}

/**
 * Extract tech analysis content
 */
function extractTechAnalysisContent(content: string): PlanningContext['techAnalysis'] | undefined {
    const architectureDecisions = extractListItems(content, 'Architecture Decisions');
    const technicalRequirements = extractListItems(content, 'Technical Requirements');
    const dependencies = extractListItems(content, 'Dependencies');

    if (
        architectureDecisions.length === 0 &&
        technicalRequirements.length === 0 &&
        dependencies.length === 0
    ) {
        return undefined;
    }

    return {
        architectureDecisions,
        technicalRequirements,
        dependencies
    };
}

/**
 * Extract tasks from TODOs.md
 */
function extractTasks(content: string): EnrichmentTask[] {
    const tasks: EnrichmentTask[] = [];

    // Match task headers: ## [T-XXX-XXX] Task title
    const taskRegex = /##\s*\[([^\]]+)\]\s*(.+)/g;
    let match: RegExpExecArray | null;

    match = taskRegex.exec(content);
    while (match !== null) {
        const code = match[1];
        const title = match[2]?.trim();

        if (!code || !title) {
            continue;
        }

        // Extract task section
        const taskStart = match.index;
        const nextTask = content.indexOf('\n## [', taskStart + 1);
        const taskEnd = nextTask === -1 ? content.length : nextTask;
        const taskSection = content.slice(taskStart, taskEnd);

        // Extract estimate
        const estimateMatch = /\*\*Estimate:\*\*\s*(.+)/i.exec(taskSection);
        const estimate = estimateMatch?.[1]?.trim();

        // Extract dependencies
        const dependencies = extractTaskDependencies(taskSection);

        tasks.push({
            code,
            title,
            estimate: estimate ?? undefined,
            dependencies
        });

        match = taskRegex.exec(content);
    }

    return tasks;
}

/**
 * Extract section content
 */
function extractSection(content: string, sectionName: string): string | undefined {
    const regex = new RegExp(`##\\s+${sectionName}\\s*\\n([^#]+)`, 'i');
    const match = regex.exec(content);

    if (!match || !match[1]) {
        return undefined;
    }

    return match[1].trim();
}

/**
 * Extract list items from a section
 */
function extractListItems(content: string, sectionName: string): string[] {
    const sectionContent = extractSection(content, sectionName);

    if (!sectionContent) {
        return [];
    }

    // Extract bullet points
    const lines = sectionContent.split('\n');
    const items: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
            const item = trimmed.slice(1).trim();
            if (item) {
                items.push(item);
            }
        }
    }

    return items;
}

/**
 * Extract task dependencies
 */
function extractTaskDependencies(taskSection: string): string[] {
    const dependencies: string[] = [];

    // Look for "Dependencies:" section
    const depMatch = /\*\*Dependencies:\*\*\s*(.+)/i.exec(taskSection);

    if (!depMatch || !depMatch[1]) {
        return dependencies;
    }

    const depText = depMatch[1].trim();

    if (depText.toLowerCase() === 'none') {
        return dependencies;
    }

    // Extract task codes (T-XXX-XXX)
    const taskCodeRegex = /T-[A-Z]+-\d+/g;
    let match: RegExpExecArray | null;

    match = taskCodeRegex.exec(depText);
    while (match !== null) {
        dependencies.push(match[0]);
        match = taskCodeRegex.exec(depText);
    }

    return dependencies;
}
