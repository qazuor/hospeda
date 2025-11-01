/**
 * Planning context extractor
 *
 * Extracts structured context from planning session files (PDR.md, tech-analysis.md, TODOs.md).
 * Provides rich context for GitHub issue enrichment.
 *
 * @module enrichment/context-extractor
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parsePlanningSession } from '../parsers/planning-session.js';
import type { Task } from '../parsers/types.js';

/**
 * User story extracted from PDR
 */
export type UserStory = {
	/** User role (e.g., "guest user", "host") */
	role: string;
	/** What the user wants to do */
	action: string;
	/** Why the user wants to do it */
	benefit: string;
};

/**
 * Task information for context
 */
export type TaskInfo = {
	/** Task code (e.g., T-001-001) */
	id: string;
	/** Task title */
	title: string;
	/** Task description */
	description?: string;
	/** Estimate (e.g., "8h") */
	estimate?: string;
	/** Task dependencies */
	dependencies?: string[];
	/** Task labels */
	labels?: string[];
};

/**
 * Complete planning context extracted from session
 */
export type PlanningContext = {
	/** Planning session ID (e.g., P-001) */
	sessionId: string;
	/** Feature title */
	title: string;
	/** Goals from PDR */
	goals?: string[];
	/** User stories from PDR */
	userStories?: UserStory[];
	/** Acceptance criteria from PDR */
	acceptanceCriteria?: string[];
	/** Architecture overview from tech-analysis */
	architecture?: string;
	/** Dependencies from tech-analysis */
	dependencies?: string[];
	/** Risks from tech-analysis */
	risks?: string[];
	/** Tasks from TODOs */
	tasks?: TaskInfo[];
};

/**
 * Options for context extraction
 */
export type ExtractContextOptions = {
	/** Path to planning session directory */
	sessionPath: string;
	/** Include goals section (default: true) */
	includeGoals?: boolean;
	/** Include user stories (default: true) */
	includeUserStories?: boolean;
	/** Include acceptance criteria (default: true) */
	includeAcceptanceCriteria?: boolean;
	/** Include architecture (default: true) */
	includeArchitecture?: boolean;
	/** Include dependencies (default: true) */
	includeDependencies?: boolean;
	/** Include risks (default: true) */
	includeRisks?: boolean;
	/** Include tasks (default: true) */
	includeTasks?: boolean;
};

/**
 * Result of context extraction
 */
export type ExtractContextResult = {
	/** Whether extraction was successful */
	success: boolean;
	/** Extracted context if successful */
	context?: PlanningContext;
	/** Error message if failed */
	error?: string;
};

/**
 * Extract planning context from session files
 *
 * Parses PDR.md, tech-analysis.md, and TODOs.md to extract structured
 * context for GitHub issue enrichment.
 *
 * @param input - Extraction options
 * @returns Extraction result with context or error
 *
 * @example
 * ```typescript
 * const result = await extractPlanningContext({
 *   sessionPath: '.claude/sessions/planning/P-001-feature'
 * });
 *
 * if (result.success && result.context) {
 *   console.log('Goals:', result.context.goals);
 *   console.log('User Stories:', result.context.userStories);
 * }
 * ```
 */
export async function extractPlanningContext(
	input: ExtractContextOptions
): Promise<ExtractContextResult> {
	const {
		sessionPath,
		includeGoals = true,
		includeUserStories = true,
		includeAcceptanceCriteria = true,
		includeArchitecture = true,
		includeDependencies = true,
		includeRisks = true,
		includeTasks = true
	} = input;

	// Validate session path
	if (!sessionPath || sessionPath.trim() === '') {
		return {
			success: false,
			error: 'Session path is required'
		};
	}

	// Check if session path exists
	if (!existsSync(sessionPath)) {
		return {
			success: false,
			error: `Session path not found: ${sessionPath}`
		};
	}

	try {
		// Parse planning session (metadata + tasks)
		const session = await parsePlanningSession(sessionPath);

		// Extract PDR content
		const pdrPath = join(sessionPath, 'PDR.md');
		const pdrContent = await readFile(pdrPath, 'utf-8');

		// Extract tech-analysis content
		const techAnalysisPath = join(sessionPath, 'tech-analysis.md');
		const techAnalysisContent = await readFile(techAnalysisPath, 'utf-8');

		// Build context
		const context: PlanningContext = {
			sessionId: session.metadata.planningCode,
			title: session.metadata.featureName
		};

		// Extract goals
		if (includeGoals) {
			context.goals = extractGoals(pdrContent);
		}

		// Extract user stories
		if (includeUserStories) {
			context.userStories = extractUserStories(pdrContent);
		}

		// Extract acceptance criteria
		if (includeAcceptanceCriteria) {
			context.acceptanceCriteria = extractAcceptanceCriteria(pdrContent);
		}

		// Extract architecture
		if (includeArchitecture) {
			context.architecture = extractArchitecture(techAnalysisContent);
		}

		// Extract dependencies
		if (includeDependencies) {
			context.dependencies = extractDependencies(techAnalysisContent);
		}

		// Extract risks
		if (includeRisks) {
			context.risks = extractRisks(techAnalysisContent);
		}

		// Extract tasks
		if (includeTasks) {
			context.tasks = convertTasksToInfo(session.tasks);
		}

		return {
			success: true,
			context
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to extract context: ${(error as Error).message}`
		};
	}
}

/**
 * Extract goals from PDR content
 *
 * @param content - PDR markdown content
 * @returns Array of goal strings
 */
function extractGoals(content: string): string[] {
	const goalsSection = extractSection(content, 'Goals');
	if (!goalsSection) {
		return [];
	}

	return extractBulletPoints(goalsSection);
}

/**
 * Extract user stories from PDR content
 *
 * @param content - PDR markdown content
 * @returns Array of user stories
 */
function extractUserStories(content: string): UserStory[] {
	const userStoriesSection = extractSection(content, 'User Stories');
	if (!userStoriesSection) {
		return [];
	}

	const stories: UserStory[] = [];

	// Split by ### to get each user story section
	const storySections = userStoriesSection.split(/(?=###\s+As\s+)/);

	for (const section of storySections) {
		if (!section.trim()) {
			continue;
		}

		// Extract role from "### As a <role>"
		const roleMatch = section.match(/###\s+As\s+a?\s+([^\n]+)/i);
		if (!roleMatch?.[1]) {
			continue;
		}

		// Extract action from "**I want** <action>"
		const actionMatch = section.match(/\*\*I want\*\*\s+([^\n]+)/i);
		if (!actionMatch?.[1]) {
			continue;
		}

		// Extract benefit from "**So that** <benefit>"
		const benefitMatch = section.match(/\*\*So that\*\*\s+([^\n]+)/i);
		if (!benefitMatch?.[1]) {
			continue;
		}

		stories.push({
			role: roleMatch[1].trim(),
			action: actionMatch[1].trim(),
			benefit: benefitMatch[1].trim()
		});
	}

	return stories;
}

/**
 * Extract acceptance criteria from PDR content
 *
 * @param content - PDR markdown content
 * @returns Array of acceptance criteria
 */
function extractAcceptanceCriteria(content: string): string[] {
	const criteriaSection = extractSection(content, 'Acceptance Criteria');
	if (!criteriaSection) {
		return [];
	}

	// Extract checkbox items
	const checkboxPattern = /^-\s+\[\s*[^\]]*\]\s+(.+)$/gm;
	const criteria: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = checkboxPattern.exec(criteriaSection)) !== null) {
		if (match[1]) {
			criteria.push(match[1].trim());
		}
	}

	return criteria;
}

/**
 * Extract architecture from tech-analysis content
 *
 * @param content - tech-analysis markdown content
 * @returns Architecture description
 */
function extractArchitecture(content: string): string | undefined {
	const architectureSection = extractSection(content, 'Architecture Overview');
	if (!architectureSection) {
		return undefined;
	}

	// Get first paragraph
	const paragraphs = architectureSection
		.split('\n\n')
		.filter((p) => p.trim() && !p.startsWith('#') && !p.startsWith('```'))
		.map((p) => p.trim());

	return paragraphs[0] ?? undefined;
}

/**
 * Extract dependencies from tech-analysis content
 *
 * @param content - tech-analysis markdown content
 * @returns Array of dependencies
 */
function extractDependencies(content: string): string[] {
	const deps: string[] = [];

	// Try to find "### Core Dependencies" or "### Dependencies" section
	const depSectionPattern = /###\s+(Core\s+)?Dependencies\s*\n+\s*([\s\S]+?)(?=\n###|\n##|$)/i;
	const match = content.match(depSectionPattern);

	if (!match?.[2]) {
		return [];
	}

	const dependenciesSection = match[2];

	// Pattern: - **Name:** Description
	// Match lines starting with - **Name:** or - **Name**
	const depPattern = /-\s+\*\*([^:*]+?)(?:\*\*|:)/g;

	let depMatch: RegExpExecArray | null;
	while ((depMatch = depPattern.exec(dependenciesSection)) !== null) {
		if (depMatch[1]) {
			deps.push(depMatch[1].trim());
		}
	}

	return deps;
}

/**
 * Extract risks from tech-analysis content
 *
 * @param content - tech-analysis markdown content
 * @returns Array of risks
 */
function extractRisks(content: string): string[] {
	const risksSection = extractSection(content, 'Risks and Mitigations');
	if (!risksSection) {
		return [];
	}

	const risks: string[] = [];

	// Pattern: ### Risk: <risk description>
	const riskPattern = /###\s+Risk:\s+(.+?)(?=\n|$)/gi;

	let match: RegExpExecArray | null;
	while ((match = riskPattern.exec(risksSection)) !== null) {
		if (match[1]) {
			risks.push(match[1].trim());
		}
	}

	return risks;
}

/**
 * Extract a section from markdown content
 *
 * @param content - Markdown content
 * @param sectionName - Section heading name
 * @returns Section content or undefined
 */
function extractSection(content: string, sectionName: string): string | undefined {
	// Pattern: ## N. Section Name (with or without numbering)
	// Stop at next ## section (not ###) or end of file
	const pattern = new RegExp(
		`##\\s+(?:\\d+\\.\\s+)?${sectionName}\\s*\\n+([\\s\\S]+?)(?=\\n##\\s+(?:\\d+\\.|[A-Z])|$)`,
		'i'
	);

	const match = content.match(pattern);
	return match?.[1]?.trim();
}

/**
 * Extract a subsection (###) from within a parent section (##)
 *
 * @param content - Markdown content
 * @param parentSection - Parent section heading name (##)
 * @param subsectionName - Subsection heading name (###)
 * @returns Subsection content or undefined
 */
function extractSubsection(
	content: string,
	parentSection: string,
	subsectionName: string
): string | undefined {
	// First get the parent section
	const parentContent = extractSection(content, parentSection);
	if (!parentContent) {
		return undefined;
	}

	// Then find the subsection within it
	const pattern = new RegExp(
		`###\\s+${subsectionName}\\s*\\n+([\\s\\S]+?)(?=\\n###|\\n##|$)`,
		'i'
	);

	const match = parentContent.match(pattern);
	return match?.[1]?.trim();
}

/**
 * Extract bullet points from markdown content
 *
 * @param content - Markdown content
 * @returns Array of bullet point text
 */
function extractBulletPoints(content: string): string[] {
	const bulletPattern = /^-\s+(.+)$/gm;
	const bullets: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = bulletPattern.exec(content)) !== null) {
		if (match[1]) {
			bullets.push(match[1].trim());
		}
	}

	return bullets;
}

/**
 * Convert parsed tasks to TaskInfo format
 *
 * @param tasks - Parsed tasks from TODOs
 * @returns Array of TaskInfo
 */
function convertTasksToInfo(tasks: Task[]): TaskInfo[] {
	return tasks.map((task) => ({
		id: task.code,
		title: task.title,
		description: task.description,
		estimate: task.estimate,
		dependencies: undefined, // TODO: Extract from task description
		labels: undefined // TODO: Infer from task metadata
	}));
}
