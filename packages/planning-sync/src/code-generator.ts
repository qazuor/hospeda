/**
 * Code Generator
 * Generates planning codes (P-XXX) and task codes (T-XXX-XXX)
 */

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Code registry stored in .code-registry.json
 */
interface CodeRegistry {
    /** Last used planning number */
    lastPlanningNumber: number;
    /** Map of planning codes to their last task number */
    plannings: Record<string, number>;
}

/**
 * Gets or creates a planning code for a session
 *
 * @param sessionPath - Path to planning session directory
 * @param featureName - Feature name (for reference)
 * @returns Planning code (e.g., P-001)
 *
 * @example
 * const code = await getPlanningCode('.claude/sessions/planning/user-auth', 'User Authentication');
 * // Returns: P-001
 *
 * @example
 * const code = await getPlanningCode('.claude/sessions/planning/P-004-user-auth', 'User Authentication');
 * // Returns: P-004 (extracted from folder name)
 */
export async function getPlanningCode(sessionPath: string, _featureName: string): Promise<string> {
    const registry = await loadCodeRegistry(sessionPath);
    const syncFile = join(sessionPath, 'issues-sync.json');

    // Check if planning already has a code in sync file
    try {
        const syncContent = await fs.readFile(syncFile, 'utf-8');
        const syncData = JSON.parse(syncContent);
        if (syncData.planningCode) {
            return syncData.planningCode;
        }
    } catch {
        // File doesn't exist or invalid, proceed to check folder name
    }

    // Try to extract planning code from folder name (format: P-XXX-feature-name)
    const folderName = sessionPath.split('/').pop() || '';
    const folderCodeMatch = folderName.match(/^(P-\d{3})-/);

    if (folderCodeMatch?.[1]) {
        const planningCode = folderCodeMatch[1];
        const planningNumber = parsePlanningCode(planningCode);

        // Update registry to ensure this code is tracked
        if (!registry.plannings[planningCode]) {
            registry.plannings[planningCode] = 0;
        }

        // Update lastPlanningNumber if this is higher
        if (planningNumber > registry.lastPlanningNumber) {
            registry.lastPlanningNumber = planningNumber;
            await saveCodeRegistry(sessionPath, registry);
        }

        return planningCode;
    }

    // Generate new planning code
    registry.lastPlanningNumber += 1;
    const planningCode = formatPlanningCode(registry.lastPlanningNumber);

    // Initialize task counter for this planning
    registry.plannings[planningCode] = 0;

    // Save registry
    await saveCodeRegistry(sessionPath, registry);

    return planningCode;
}

/**
 * Generates task codes for a planning session
 *
 * @param sessionPath - Path to planning session directory
 * @param planningCode - Planning code (e.g., P-001)
 * @param taskCount - Number of tasks to generate codes for
 * @returns Array of task codes (e.g., ['T-001-001', 'T-001-002', ...])
 *
 * @example
 * const codes = await generateTaskCodes('.claude/sessions/planning/user-auth', 'P-001', 5);
 * // Returns: ['T-001-001', 'T-001-002', 'T-001-003', 'T-001-004', 'T-001-005']
 */
export async function generateTaskCodes(
    sessionPath: string,
    planningCode: string,
    taskCount: number
): Promise<string[]> {
    const registry = await loadCodeRegistry(sessionPath);

    // Get current task number for this planning
    let currentTaskNumber = registry.plannings[planningCode] || 0;

    // Generate codes
    const codes: string[] = [];
    for (let i = 0; i < taskCount; i++) {
        currentTaskNumber += 1;
        codes.push(formatTaskCode(planningCode, currentTaskNumber));
    }

    // Update registry
    registry.plannings[planningCode] = currentTaskNumber;
    await saveCodeRegistry(sessionPath, registry);

    return codes;
}

/**
 * Gets the next task code for a planning
 *
 * @param sessionPath - Path to planning session directory
 * @param planningCode - Planning code (e.g., P-001)
 * @returns Next task code (e.g., T-001-042)
 */
export async function getNextTaskCode(sessionPath: string, planningCode: string): Promise<string> {
    const codes = await generateTaskCodes(sessionPath, planningCode, 1);
    const code = codes[0];
    if (!code) {
        throw new Error('Failed to generate task code');
    }
    return code;
}

/**
 * Formats a planning code
 *
 * @param number - Planning number
 * @returns Formatted code (e.g., P-001)
 */
function formatPlanningCode(number: number): string {
    return `P-${number.toString().padStart(3, '0')}`;
}

/**
 * Formats a task code
 *
 * @param planningCode - Planning code (e.g., P-001)
 * @param taskNumber - Task number
 * @returns Formatted code (e.g., T-001-042)
 */
function formatTaskCode(planningCode: string, taskNumber: number): string {
    // Extract planning number from code (P-001 -> 001)
    const planningNumber = planningCode.split('-')[1];
    return `T-${planningNumber}-${taskNumber.toString().padStart(3, '0')}`;
}

/**
 * Loads code registry from .code-registry.json
 * Creates new registry if it doesn't exist
 *
 * @param sessionPath - Path to planning session directory
 * @returns Code registry
 */
async function loadCodeRegistry(sessionPath: string): Promise<CodeRegistry> {
    // Look for registry in parent planning directory
    const planningDir = dirname(sessionPath);
    const registryPath = join(planningDir, '.code-registry.json');

    try {
        const content = await fs.readFile(registryPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        // Registry doesn't exist, create new one
        return {
            lastPlanningNumber: 0,
            plannings: {}
        };
    }
}

/**
 * Saves code registry to .code-registry.json
 *
 * @param sessionPath - Path to planning session directory
 * @param registry - Code registry to save
 */
async function saveCodeRegistry(sessionPath: string, registry: CodeRegistry): Promise<void> {
    // Save registry in parent planning directory
    const planningDir = dirname(sessionPath);
    const registryPath = join(planningDir, '.code-registry.json');

    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * Parses planning code to get planning number
 *
 * @param planningCode - Planning code (e.g., P-001)
 * @returns Planning number (e.g., 1)
 */
export function parsePlanningCode(planningCode: string): number {
    const match = planningCode.match(/^P-(\d+)$/);
    if (!match?.[1]) {
        throw new Error(`Invalid planning code: ${planningCode}`);
    }
    return Number.parseInt(match[1], 10);
}

/**
 * Parses task code to get planning and task numbers
 *
 * @param taskCode - Task code (e.g., T-001-042)
 * @returns Object with planningNumber and taskNumber
 */
export function parseTaskCode(taskCode: string): {
    planningNumber: number;
    taskNumber: number;
} {
    const match = taskCode.match(/^T-(\d+)-(\d+)$/);
    if (!match?.[1] || !match?.[2]) {
        throw new Error(`Invalid task code: ${taskCode}`);
    }
    return {
        planningNumber: Number.parseInt(match[1], 10),
        taskNumber: Number.parseInt(match[2], 10)
    };
}
