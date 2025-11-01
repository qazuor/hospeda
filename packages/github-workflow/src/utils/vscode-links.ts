/**
 * VSCode protocol links utilities
 *
 * Utilities for creating VSCode protocol links (vscode://file/...) to enable
 * opening files directly from GitHub issues in VSCode.
 *
 * @module utils/vscode-links
 */

import { basename, isAbsolute, resolve } from 'node:path';

/**
 * Options for creating VSCode file link
 */
export type VSCodeFileLinkOptions = {
	/** Absolute or relative file path */
	filePath: string;
	/** Link text (defaults to filename) */
	linkText?: string;
	/** Optional line number (1-indexed) */
	line?: number;
	/** Optional column number (1-indexed) */
	column?: number;
};

/**
 * Planning session VSCode links
 */
export type SessionLinks = {
	/** Link to PDR.md */
	pdr: string;
	/** Link to tech-analysis.md */
	techAnalysis: string;
	/** Link to TODOs.md */
	todos: string;
	/** Formatted markdown section with all links */
	formatted: string;
};

/**
 * Format a VSCode protocol link
 *
 * Creates a vscode://file/ link that opens the file in VSCode.
 * Supports line and column numbers for precise navigation.
 *
 * @param filePath - File path (relative or absolute)
 * @param line - Optional line number (1-indexed)
 * @param column - Optional column number (1-indexed)
 * @returns VSCode protocol link
 *
 * @example
 * ```typescript
 * formatVSCodeLink('/path/to/file.ts')
 * // Returns: 'vscode://file/path/to/file.ts'
 *
 * formatVSCodeLink('/path/to/file.ts', 42)
 * // Returns: 'vscode://file/path/to/file.ts:42'
 *
 * formatVSCodeLink('/path/to/file.ts', 42, 10)
 * // Returns: 'vscode://file/path/to/file.ts:42:10'
 * ```
 */
export function formatVSCodeLink(filePath: string, line?: number, column?: number): string {
	// Check if it's a Windows absolute path (e.g., C:\... or D:\...)
	const isWindowsAbsolute = /^[a-zA-Z]:\\/.test(filePath);

	// Convert to absolute path if relative (and not Windows absolute)
	let absolutePath: string;
	if (isAbsolute(filePath) || isWindowsAbsolute) {
		absolutePath = filePath;
	} else {
		absolutePath = resolve(filePath);
	}

	// Normalize Windows paths (backslashes to forward slashes)
	const normalizedPath = absolutePath.replace(/\\/g, '/');

	// Ensure path starts with / for VSCode protocol
	const pathWithLeadingSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

	// Build VSCode protocol link
	let link = `vscode://file${pathWithLeadingSlash}`;

	if (line !== undefined) {
		link += `:${line}`;

		if (column !== undefined) {
			link += `:${column}`;
		}
	}

	return link;
}

/**
 * Create a markdown link with VSCode protocol
 *
 * Generates a clickable markdown link that opens the file in VSCode.
 * The link text defaults to the filename if not provided.
 *
 * @param input - Link creation options
 * @returns Markdown link string
 *
 * @example
 * ```typescript
 * createVSCodeFileLink({
 *   filePath: '/path/to/PDR.md',
 *   linkText: 'Product Design Requirements'
 * })
 * // Returns: '[Product Design Requirements](vscode://file/path/to/PDR.md)'
 *
 * createVSCodeFileLink({
 *   filePath: '/path/to/file.ts',
 *   line: 42
 * })
 * // Returns: '[file.ts](vscode://file/path/to/file.ts:42)'
 * ```
 */
export function createVSCodeFileLink(input: VSCodeFileLinkOptions): string {
	const { filePath, linkText, line, column } = input;

	// Use filename as default link text
	const text = linkText ?? basename(filePath);

	// Generate VSCode link
	const vscodeLink = formatVSCodeLink(filePath, line, column);

	// Return markdown link
	return `[${text}](${vscodeLink})`;
}

/**
 * Create VSCode links for planning session files
 *
 * Generates markdown links for PDR.md, tech-analysis.md, and TODOs.md
 * in a planning session directory. Returns both individual links and
 * a formatted section ready to include in GitHub issues.
 *
 * @param sessionPath - Path to planning session directory
 * @returns Session links object
 *
 * @example
 * ```typescript
 * const links = createVSCodeSessionLinks('.claude/sessions/planning/P-001-feature');
 *
 * console.log(links.pdr);
 * // [PDR.md](vscode://file/absolute/path/to/P-001-feature/PDR.md)
 *
 * console.log(links.formatted);
 * // **Planning Files**
 * // - PDR: [PDR.md](vscode://file/...)
 * // - Technical Analysis: [tech-analysis.md](vscode://file/...)
 * // - Tasks: [TODOs.md](vscode://file/...)
 * ```
 */
export function createVSCodeSessionLinks(sessionPath: string): SessionLinks {
	// Convert to absolute path
	const absoluteSessionPath = isAbsolute(sessionPath) ? sessionPath : resolve(sessionPath);

	// Create individual file links
	const pdrPath = `${absoluteSessionPath}/PDR.md`;
	const techAnalysisPath = `${absoluteSessionPath}/tech-analysis.md`;
	const todosPath = `${absoluteSessionPath}/TODOs.md`;

	const pdr = createVSCodeFileLink({ filePath: pdrPath });
	const techAnalysis = createVSCodeFileLink({ filePath: techAnalysisPath });
	const todos = createVSCodeFileLink({ filePath: todosPath });

	// Create formatted section
	const formatted = [
		'**Planning Files**',
		'',
		`- PDR: ${pdr}`,
		`- Technical Analysis: ${techAnalysis}`,
		`- Tasks: ${todos}`
	].join('\n');

	return {
		pdr,
		techAnalysis,
		todos,
		formatted
	};
}
