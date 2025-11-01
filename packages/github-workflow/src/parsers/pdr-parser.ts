/**
 * PDR.md parser for planning sessions
 *
 * Extracts planning metadata from PDR (Product Design Requirements) files.
 *
 * @module parsers/pdr-parser
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { PlanningMetadata } from './types';

/**
 * Regular expression patterns for parsing PDR
 */
const PATTERNS = {
    /** Planning code in directory name (e.g., P-003) */
    PLANNING_CODE: /^(P-\d{3})/,
    /** Level-1 heading (# Title) */
    FEATURE_NAME: /^#\s+(.+)$/m,
    /** Executive Summary section with optional numbering */
    EXECUTIVE_SUMMARY: /##\s+(?:\d+\.\s+)?Executive Summary\s*\n+([\s\S]+?)(?=\n##|$)/i
} as const;

/**
 * Parse PDR.md file to extract planning metadata
 *
 * Extracts:
 * - Planning code from session path (e.g., P-003)
 * - Feature name from main title (# heading)
 * - Summary from Executive Summary section
 *
 * @param sessionPath - Path to planning session directory
 * @returns Planning metadata
 * @throws {Error} If PDR.md not found or path format invalid
 *
 * @example
 * ```typescript
 * const metadata = await parsePDR('.claude/sessions/planning/P-003-feature');
 * console.log(metadata.planningCode); // "P-003"
 * console.log(metadata.featureName); // "Feature Name"
 * ```
 */
export async function parsePDR(sessionPath: string): Promise<PlanningMetadata> {
    // Validate path format first (before trying to read file)
    const planningCode = extractPlanningCode(sessionPath);

    const pdrPath = path.join(sessionPath, 'PDR.md');

    try {
        const content = await fs.readFile(pdrPath, 'utf-8');

        return {
            planningCode,
            featureName: extractFeatureName(content),
            summary: extractSummary(content)
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new Error(`PDR.md not found in ${sessionPath}`);
        }
        throw error;
    }
}

/**
 * Extract planning code from session directory path
 *
 * Expects path format: `.../P-XXX-feature-name/`
 *
 * @param sessionPath - Path to planning session directory
 * @returns Planning code (e.g., P-003)
 * @throws {Error} If path doesn't match expected format
 *
 * @example
 * ```typescript
 * extractPlanningCode('.../P-003-feature'); // "P-003"
 * extractPlanningCode('.../invalid'); // throws Error
 * ```
 */
function extractPlanningCode(sessionPath: string): string {
    const dirname = path.basename(sessionPath);
    const match = dirname.match(PATTERNS.PLANNING_CODE);

    if (!match?.[1]) {
        throw new Error(
            `Invalid planning session path: ${sessionPath}. Expected format: P-XXX-feature-name (e.g., P-003-user-auth)`
        );
    }

    return match[1];
}

/**
 * Extract feature name from PDR main title
 *
 * Looks for the first level-1 heading (# Title).
 *
 * @param content - PDR.md file content
 * @returns Feature name from title
 * @throws {Error} If no title found
 *
 * @example
 * ```typescript
 * const content = "# User Authentication\\n\\nFeature description...";
 * extractFeatureName(content); // "User Authentication"
 * ```
 */
function extractFeatureName(content: string): string {
    // Find first level-1 heading
    const match = content.match(PATTERNS.FEATURE_NAME);

    if (!match?.[1]) {
        throw new Error('Feature name not found in PDR. Expected a level-1 heading (# Title).');
    }

    return match[1].trim();
}

/**
 * Extract summary from Executive Summary section
 *
 * Looks for "## Executive Summary" or "## 1. Executive Summary"
 * and extracts the first paragraph.
 *
 * @param content - PDR.md file content
 * @returns Summary text (first paragraph) or empty string if not found
 *
 * @example
 * ```typescript
 * const content = `## 1. Executive Summary
 *
 * This is the summary paragraph.
 *
 * Second paragraph...`;
 * extractSummary(content); // "This is the summary paragraph."
 * ```
 */
function extractSummary(content: string): string {
    // Find Executive Summary section (with or without numbering)
    const summaryMatch = content.match(PATTERNS.EXECUTIVE_SUMMARY);

    if (!summaryMatch?.[1]) {
        return '';
    }

    // Get first paragraph (skip headings)
    const paragraphs = summaryMatch[1]
        .split('\n\n')
        .filter((p) => p.trim() && !p.startsWith('#'))
        .map((p) => p.trim());

    return paragraphs[0] ?? '';
}
