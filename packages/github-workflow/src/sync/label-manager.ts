/**
 * Label management for GitHub issues
 *
 * Generates and manages labels for GitHub issues based on task metadata.
 * Includes intelligent label generation, caching, warmup, and color schemes.
 *
 * @module sync/label-manager
 */

import type { GitHubClient } from '../core/github-client.js';
import type { CodeComment } from '../parsers/types.js';
import type { Task, TaskStatus } from '../parsers/types.js';

/**
 * Input for generating labels
 */
export type GenerateLabelsInput = {
	/** Task to generate labels for */
	task: Task;

	/** Planning code (e.g., P-003) */
	planningCode: string;
};

/**
 * Label with color and description
 */
export type LabelDefinition = {
	/** Label name */
	name: string;

	/** Label color (hex without #) */
	color: string;

	/** Label description */
	description: string;
};

/**
 * Color scheme for different label categories
 */
export type ColorScheme = {
	/** Universal labels (from:*) */
	universal: string;

	/** Status labels (status:*) */
	status: {
		pending: string;
		inProgress: string;
		completed: string;
	};

	/** Phase labels (phase:*) */
	phase: string;

	/** Planning labels (planning:*) */
	planning: string;

	/** Type labels (type:*) */
	type: {
		task: string;
		subtask: string;
		subSubTask: string;
	};

	/** Priority labels (priority:*) */
	priority: {
		low: string;
		medium: string;
		high: string;
		critical: string;
	};

	/** Difficulty labels (difficulty:*) */
	difficulty: {
		easy: string;
		medium: string;
		hard: string;
	};

	/** Impact labels (impact:*) */
	impact: {
		low: string;
		medium: string;
		high: string;
	};

	/** Comment type labels (TODO, HACK, DEBUG) */
	commentType: {
		todo: string;
		hack: string;
		debug: string;
	};

	/** Custom labels */
	custom: string;
};

/**
 * Default color scheme
 *
 * Colors follow GitHub's label color conventions:
 * - Blues/Purples: System/universal labels
 * - Greens: Completed/success states
 * - Yellows/Oranges: In progress/warnings
 * - Grays: Pending/neutral states
 * - Reds: High priority/critical
 */
const DEFAULT_COLOR_SCHEME: ColorScheme = {
	universal: '7057ff', // Purple - system label
	status: {
		pending: 'd4c5f9', // Light purple
		inProgress: 'fbca04', // Yellow
		completed: '0e8a16' // Green
	},
	phase: '0075ca', // Blue
	planning: '1d76db', // Dark blue
	type: {
		task: '0052cc', // Navy blue
		subtask: '5319e7', // Purple
		subSubTask: 'c2e0c6' // Light green
	},
	priority: {
		low: 'd4c5f9', // Light purple
		medium: 'fbca04', // Yellow
		high: 'ff9800', // Orange
		critical: 'd73a4a' // Red
	},
	difficulty: {
		easy: 'c2e0c6', // Light green
		medium: 'fbca04', // Yellow
		hard: 'ff6b6b' // Light red
	},
	impact: {
		low: 'e4e669', // Pale yellow
		medium: 'fbca04', // Yellow
		high: 'ff9800' // Orange
	},
	commentType: {
		todo: '1d76db', // Blue
		hack: 'ff9800', // Orange - warning
		debug: 'd73a4a' // Red - should be removed
	},
	custom: 'ededed' // Light gray
};

/**
 * Convert task status to label format
 *
 * @param status - Task status
 * @returns Status label
 */
function statusToLabel(status: TaskStatus): string {
	switch (status) {
		case 'pending':
			return 'status:pending';
		case 'in_progress':
			return 'status:in-progress';
		case 'completed':
			return 'status:completed';
	}
}

/**
 * Generate labels for a task based on metadata
 *
 * Generates labels according to strategy:
 * - Universal: `from:claude-code` (always)
 * - Status: `status:pending`, `status:in-progress`, `status:completed`
 * - Phase: `phase:1`, `phase:2`, etc. (if specified)
 * - Planning: `planning:P-003`
 * - Type: `type:task` (level 0), `type:subtask` (level > 0)
 *
 * @param input - Label generation input
 * @returns Array of label names
 *
 * @example
 * ```typescript
 * const labels = generateLabelsForTask({
 *   task: {
 *     code: 'T-003-001',
 *     status: 'pending',
 *     phase: 2,
 *     level: 0,
 *     ...
 *   },
 *   planningCode: 'P-003'
 * });
 * // Returns: ['from:claude-code', 'status:pending', 'phase:2', 'planning:P-003', 'type:task']
 * ```
 */
export function generateLabelsForTask(input: GenerateLabelsInput): string[] {
	const { task, planningCode } = input;
	const labels: string[] = [];

	// Universal label
	labels.push('from:claude-code');

	// Status label
	labels.push(statusToLabel(task.status));

	// Phase label (if specified)
	if (task.phase !== undefined) {
		labels.push(`phase:${task.phase}`);
	}

	// Planning label
	labels.push(`planning:${planningCode}`);

	// Type label based on level
	if (task.level === 0) {
		labels.push('type:task');
	} else if (task.level === 1) {
		labels.push('type:subtask');
	} else {
		labels.push('type:sub-subtask');
	}

	return labels;
}

/**
 * Label Manager
 *
 * Manages GitHub labels with intelligent generation, caching, warmup, and color schemes.
 *
 * Features:
 * - Intelligent label generation based on task metadata
 * - Label caching via GitHubClient
 * - Warmup of common labels
 * - Predefined color schemes
 * - Context-aware label suggestions
 *
 * @example
 * ```typescript
 * const manager = new LabelManager({
 *   githubClient,
 *   colorScheme: DEFAULT_COLOR_SCHEME
 * });
 *
 * // Warmup common labels
 * await manager.warmup();
 *
 * // Generate labels for a task
 * const labels = manager.generateForTask({
 *   task: myTask,
 *   planningCode: 'P-003'
 * });
 *
 * // Ensure labels exist in GitHub
 * await manager.ensureLabelsExist(labels);
 * ```
 */
export class LabelManager {
	private readonly githubClient: GitHubClient;
	private readonly colorScheme: ColorScheme;
	private warmedUp: boolean = false;

	/**
	 * Create a new LabelManager
	 *
	 * @param options - Manager options
	 */
	constructor(options: { githubClient: GitHubClient; colorScheme?: ColorScheme }) {
		this.githubClient = options.githubClient;
		this.colorScheme = options.colorScheme ?? DEFAULT_COLOR_SCHEME;
	}

	/**
	 * Warmup common labels
	 *
	 * Creates all predefined labels in GitHub to avoid rate limit issues
	 * during sync operations. Should be called once when initializing
	 * the workflow automation.
	 *
	 * @returns Promise that resolves when warmup is complete
	 *
	 * @example
	 * ```typescript
	 * const manager = new LabelManager({ githubClient });
	 * await manager.warmup();
	 * ```
	 */
	async warmup(): Promise<void> {
		if (this.warmedUp) {
			return;
		}

		const commonLabels = this.getCommonLabels();

		// Ensure all common labels exist
		for (const label of commonLabels) {
			await this.githubClient.ensureLabelExists({
				name: label.name,
				color: label.color,
				description: label.description
			});
		}

		this.warmedUp = true;
	}

	/**
	 * Generate labels for a task
	 *
	 * Generates labels based on task metadata and context analysis.
	 * Includes intelligent suggestions based on task title and description.
	 *
	 * @param input - Generation input
	 * @returns Array of label names
	 *
	 * @example
	 * ```typescript
	 * const labels = manager.generateForTask({
	 *   task: {
	 *     code: 'T-003-001',
	 *     title: 'Fix critical security bug',
	 *     status: 'pending',
	 *     phase: 2,
	 *     level: 0,
	 *     estimate: 4
	 *   },
	 *   planningCode: 'P-003'
	 * });
	 * // Returns: ['from:claude-code', 'status:pending', 'phase:2', 'planning:P-003',
	 * //           'type:task', 'priority:critical', 'difficulty:medium']
	 * ```
	 */
	generateForTask(input: GenerateLabelsInput): string[] {
		const { task, planningCode } = input;
		const labels: string[] = [];

		// Universal label
		labels.push('from:claude-code');

		// Status label
		labels.push(statusToLabel(task.status));

		// Phase label (if specified)
		if (task.phase !== undefined) {
			labels.push(`phase:${task.phase}`);
		}

		// Planning label
		labels.push(`planning:${planningCode}`);

		// Type label based on level
		if (task.level === 0) {
			labels.push('type:task');
		} else if (task.level === 1) {
			labels.push('type:subtask');
		} else {
			labels.push('type:sub-subtask');
		}

		// Intelligent label suggestions based on content
		const suggestedLabels = this.analyzeTitleForLabels(task.title);
		labels.push(...suggestedLabels);

		// Priority based on estimate (if provided)
		if (task.estimate !== undefined) {
			const priority = this.estimateToPriority(task.estimate);
			if (priority) {
				labels.push(priority);
			}
		}

		// Difficulty based on estimate (if provided)
		if (task.estimate !== undefined) {
			const difficulty = this.estimateToDifficulty(task.estimate);
			if (difficulty) {
				labels.push(difficulty);
			}
		}

		// Remove duplicates
		return [...new Set(labels)];
	}

	/**
	 * Generate labels for a code comment (TODO/HACK/DEBUG)
	 *
	 * @param comment - Code comment
	 * @returns Array of label names
	 *
	 * @example
	 * ```typescript
	 * const labels = manager.generateForComment({
	 *   type: 'HACK',
	 *   text: 'Temporary workaround for bug #123',
	 *   priority: 'HIGH',
	 *   labels: ['bug', 'technical-debt']
	 * });
	 * // Returns: ['from:claude-code', 'comment:hack', 'priority:high', 'bug', 'technical-debt']
	 * ```
	 */
	generateForComment(comment: CodeComment): string[] {
		const labels: string[] = [];

		// Universal label
		labels.push('from:claude-code');

		// Comment type label
		const typeLabel = `comment:${comment.type.toLowerCase()}`;
		labels.push(typeLabel);

		// Priority label (if specified)
		if (comment.priority) {
			const priority = `priority:${comment.priority.toLowerCase()}`;
			labels.push(priority);
		}

		// Custom labels from comment
		if (comment.labels && comment.labels.length > 0) {
			labels.push(...comment.labels);
		}

		// Analyze comment text for additional labels
		const suggestedLabels = this.analyzeCommentForLabels(comment.text);
		labels.push(...suggestedLabels);

		// Remove duplicates
		return [...new Set(labels)];
	}

	/**
	 * Ensure all labels exist in GitHub
	 *
	 * Creates labels if they don't exist. Uses GitHubClient's cache
	 * to avoid redundant API calls.
	 *
	 * @param labelNames - Array of label names to ensure
	 * @returns Promise that resolves when all labels exist
	 *
	 * @example
	 * ```typescript
	 * await manager.ensureLabelsExist([
	 *   'from:claude-code',
	 *   'status:pending',
	 *   'priority:high'
	 * ]);
	 * ```
	 */
	async ensureLabelsExist(labelNames: string[]): Promise<void> {
		for (const name of labelNames) {
			const definition = this.getLabelDefinition(name);
			await this.githubClient.ensureLabelExists(definition);
		}
	}

	/**
	 * Get label definition with color and description
	 *
	 * @param name - Label name
	 * @returns Label definition
	 */
	private getLabelDefinition(name: string): LabelDefinition {
		// Parse label name to determine category
		const [category, value] = name.split(':');

		// Handle special cases
		if (name === 'from:claude-code') {
			return {
				name,
				color: this.colorScheme.universal,
				description: 'Created by Claude Code workflow automation'
			};
		}

		// Status labels
		if (category === 'status') {
			const colorMap: Record<string, string> = {
				pending: this.colorScheme.status.pending,
				'in-progress': this.colorScheme.status.inProgress,
				completed: this.colorScheme.status.completed
			};
			return {
				name,
				color: colorMap[value] ?? this.colorScheme.custom,
				description: `Task status: ${value}`
			};
		}

		// Phase labels
		if (category === 'phase') {
			return {
				name,
				color: this.colorScheme.phase,
				description: `Implementation phase ${value}`
			};
		}

		// Planning labels
		if (category === 'planning') {
			return {
				name,
				color: this.colorScheme.planning,
				description: `Planning session ${value}`
			};
		}

		// Type labels
		if (category === 'type') {
			const colorMap: Record<string, string> = {
				task: this.colorScheme.type.task,
				subtask: this.colorScheme.type.subtask,
				'sub-subtask': this.colorScheme.type.subSubTask
			};
			return {
				name,
				color: colorMap[value] ?? this.colorScheme.custom,
				description: `Task type: ${value}`
			};
		}

		// Priority labels
		if (category === 'priority') {
			const colorMap: Record<string, string> = {
				low: this.colorScheme.priority.low,
				medium: this.colorScheme.priority.medium,
				high: this.colorScheme.priority.high,
				critical: this.colorScheme.priority.critical
			};
			return {
				name,
				color: colorMap[value] ?? this.colorScheme.custom,
				description: `Priority: ${value}`
			};
		}

		// Difficulty labels
		if (category === 'difficulty') {
			const colorMap: Record<string, string> = {
				easy: this.colorScheme.difficulty.easy,
				medium: this.colorScheme.difficulty.medium,
				hard: this.colorScheme.difficulty.hard
			};
			return {
				name,
				color: colorMap[value] ?? this.colorScheme.custom,
				description: `Difficulty: ${value}`
			};
		}

		// Impact labels
		if (category === 'impact') {
			const colorMap: Record<string, string> = {
				low: this.colorScheme.impact.low,
				medium: this.colorScheme.impact.medium,
				high: this.colorScheme.impact.high
			};
			return {
				name,
				color: colorMap[value] ?? this.colorScheme.custom,
				description: `Impact: ${value}`
			};
		}

		// Comment type labels
		if (category === 'comment') {
			const colorMap: Record<string, string> = {
				todo: this.colorScheme.commentType.todo,
				hack: this.colorScheme.commentType.hack,
				debug: this.colorScheme.commentType.debug
			};
			return {
				name,
				color: colorMap[value] ?? this.colorScheme.custom,
				description: `Code comment type: ${value.toUpperCase()}`
			};
		}

		// Custom/unknown label
		return {
			name,
			color: this.colorScheme.custom,
			description: name
		};
	}

	/**
	 * Get common labels for warmup
	 *
	 * @returns Array of common label definitions
	 */
	private getCommonLabels(): LabelDefinition[] {
		return [
			// Universal
			{
				name: 'from:claude-code',
				color: this.colorScheme.universal,
				description: 'Created by Claude Code workflow automation'
			},
			// Status
			{
				name: 'status:pending',
				color: this.colorScheme.status.pending,
				description: 'Task status: pending'
			},
			{
				name: 'status:in-progress',
				color: this.colorScheme.status.inProgress,
				description: 'Task status: in progress'
			},
			{
				name: 'status:completed',
				color: this.colorScheme.status.completed,
				description: 'Task status: completed'
			},
			// Types
			{
				name: 'type:task',
				color: this.colorScheme.type.task,
				description: 'Task type: parent task'
			},
			{
				name: 'type:subtask',
				color: this.colorScheme.type.subtask,
				description: 'Task type: subtask'
			},
			{
				name: 'type:sub-subtask',
				color: this.colorScheme.type.subSubTask,
				description: 'Task type: sub-subtask'
			},
			// Priority
			{
				name: 'priority:low',
				color: this.colorScheme.priority.low,
				description: 'Priority: low'
			},
			{
				name: 'priority:medium',
				color: this.colorScheme.priority.medium,
				description: 'Priority: medium'
			},
			{
				name: 'priority:high',
				color: this.colorScheme.priority.high,
				description: 'Priority: high'
			},
			{
				name: 'priority:critical',
				color: this.colorScheme.priority.critical,
				description: 'Priority: critical'
			},
			// Difficulty
			{
				name: 'difficulty:easy',
				color: this.colorScheme.difficulty.easy,
				description: 'Difficulty: easy'
			},
			{
				name: 'difficulty:medium',
				color: this.colorScheme.difficulty.medium,
				description: 'Difficulty: medium'
			},
			{
				name: 'difficulty:hard',
				color: this.colorScheme.difficulty.hard,
				description: 'Difficulty: hard'
			},
			// Impact
			{
				name: 'impact:low',
				color: this.colorScheme.impact.low,
				description: 'Impact: low'
			},
			{
				name: 'impact:medium',
				color: this.colorScheme.impact.medium,
				description: 'Impact: medium'
			},
			{
				name: 'impact:high',
				color: this.colorScheme.impact.high,
				description: 'Impact: high'
			},
			// Comment types
			{
				name: 'comment:todo',
				color: this.colorScheme.commentType.todo,
				description: 'Code comment type: TODO'
			},
			{
				name: 'comment:hack',
				color: this.colorScheme.commentType.hack,
				description: 'Code comment type: HACK'
			},
			{
				name: 'comment:debug',
				color: this.colorScheme.commentType.debug,
				description: 'Code comment type: DEBUG'
			}
		];
	}

	/**
	 * Analyze task title for suggested labels
	 *
	 * Uses keyword matching to suggest additional labels.
	 *
	 * @param title - Task title
	 * @returns Array of suggested label names
	 */
	private analyzeTitleForLabels(title: string): string[] {
		const labels: string[] = [];
		const lowerTitle = title.toLowerCase();

		// Priority keywords
		if (lowerTitle.includes('critical') || lowerTitle.includes('urgent')) {
			labels.push('priority:critical');
		} else if (lowerTitle.includes('important') || lowerTitle.includes('high priority')) {
			labels.push('priority:high');
		}

		// Type keywords
		if (lowerTitle.includes('bug') || lowerTitle.includes('fix')) {
			// Don't add type label - already added by main logic
		}

		if (lowerTitle.includes('security')) {
			labels.push('security');
		}

		if (lowerTitle.includes('performance') || lowerTitle.includes('optimize')) {
			labels.push('performance');
		}

		if (lowerTitle.includes('test')) {
			labels.push('testing');
		}

		if (lowerTitle.includes('docs') || lowerTitle.includes('documentation')) {
			labels.push('documentation');
		}

		if (lowerTitle.includes('refactor')) {
			labels.push('refactoring');
		}

		return labels;
	}

	/**
	 * Analyze comment text for suggested labels
	 *
	 * @param text - Comment text
	 * @returns Array of suggested label names
	 */
	private analyzeCommentForLabels(text: string): string[] {
		const labels: string[] = [];
		const lowerText = text.toLowerCase();

		if (lowerText.includes('bug') || lowerText.includes('error')) {
			labels.push('bug');
		}

		if (lowerText.includes('security') || lowerText.includes('vulnerability')) {
			labels.push('security');
		}

		if (lowerText.includes('performance') || lowerText.includes('slow')) {
			labels.push('performance');
		}

		if (lowerText.includes('technical debt') || lowerText.includes('tech debt')) {
			labels.push('technical-debt');
		}

		if (lowerText.includes('temporary') || lowerText.includes('workaround')) {
			labels.push('temporary');
		}

		return labels;
	}

	/**
	 * Convert estimate (hours) to priority label
	 *
	 * Heuristic: More time = higher priority (bigger impact)
	 *
	 * @param estimate - Estimated hours
	 * @returns Priority label name or undefined
	 */
	private estimateToPriority(estimate: number): string | undefined {
		if (estimate >= 16) {
			return 'priority:critical';
		}
		if (estimate >= 8) {
			return 'priority:high';
		}
		if (estimate >= 4) {
			return 'priority:medium';
		}
		return 'priority:low';
	}

	/**
	 * Convert estimate (hours) to difficulty label
	 *
	 * @param estimate - Estimated hours
	 * @returns Difficulty label name or undefined
	 */
	private estimateToDifficulty(estimate: number): string | undefined {
		if (estimate >= 8) {
			return 'difficulty:hard';
		}
		if (estimate >= 4) {
			return 'difficulty:medium';
		}
		return 'difficulty:easy';
	}

	/**
	 * Get the color scheme being used
	 *
	 * @returns Current color scheme
	 */
	getColorScheme(): ColorScheme {
		return this.colorScheme;
	}
}

/**
 * Export default color scheme for reuse
 */
export { DEFAULT_COLOR_SCHEME };
