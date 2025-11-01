/**
 * Enrichment types
 *
 * @module enrichment/types
 */

/**
 * Planning context extracted from session
 */
export type PlanningContext = {
	/** Session directory path */
	sessionPath: string;

	/** PDR content */
	pdr?: {
		/** Feature overview */
		overview: string;

		/** User stories */
		userStories: string[];

		/** Acceptance criteria */
		acceptanceCriteria: string[];
	};

	/** Technical analysis content */
	techAnalysis?: {
		/** Architecture decisions */
		architectureDecisions: string[];

		/** Technical requirements */
		technicalRequirements: string[];

		/** Dependencies */
		dependencies: string[];
	};

	/** Tasks from TODOs.md */
	tasks: EnrichmentTask[];
};

/**
 * Task information for enrichment
 */
export type EnrichmentTask = {
	/** Task code (e.g., T-001-001) */
	code: string;

	/** Task title */
	title: string;

	/** Task estimate */
	estimate?: string;

	/** Task dependencies */
	dependencies: string[];
};

/**
 * Enrichment options
 */
export type EnrichmentOptions = {
	/** Original issue body */
	body: string;

	/** Planning session path */
	sessionPath: string;

	/** Task code */
	taskCode: string;

	/** Include user stories (default: true) */
	includeUserStories?: boolean;

	/** Include architecture decisions (default: true) */
	includeArchitectureDecisions?: boolean;

	/** Include acceptance criteria (default: true) */
	includeAcceptanceCriteria?: boolean;

	/** Include dependencies (default: true) */
	includeDependencies?: boolean;
};
