#!/usr/bin/env tsx
/**
 * Code Registry Generator
 *
 * Generates .code-registry.json from all planning sessions.
 * The registry provides quick lookup of planning codes and their task codes.
 *
 * Usage:
 *   tsx .claude/scripts/generate-code-registry.ts
 *
 * Output:
 *   .claude/sessions/planning/.code-registry.json
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface RegistrySession {
  code: string;
  type: 'feature' | 'refactor' | 'bugfix';
  fullCode: string;
  sessionPath: string;
  status: 'active' | 'completed' | 'archived' | 'cancelled';
  createdAt?: string;
  completedAt?: string;
  archivedAt?: string;
  tasks: string[];
}

interface CodeRegistry {
  version: string;
  generatedAt: string;
  lastPlanningNumber: number;
  registry: RegistrySession[];
}

const PLANNING_ROOT = resolve(process.cwd(), '.claude/sessions/planning');
const REGISTRY_PATH = join(PLANNING_ROOT, '.code-registry.json');

/**
 * Extract task codes from TODOs.md content
 */
function extractTaskCodes(content: string): string[] {
  const taskCodes: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match heading: ### PF004-1: Task Title or ### PF004-1 Task Title
    const headingMatch = line.match(/^###\s+(P[FRB]\d{3,4}-\d+(?:\.\d+)?)/);
    if (headingMatch) {
      taskCodes.push(headingMatch[1]);
    }
  }

  return taskCodes;
}

/**
 * Determine session status from checkpoint or TODOs
 */
function determineStatus(sessionPath: string): RegistrySession['status'] {
  const checkpointPath = join(sessionPath, '.checkpoint.json');

  try {
    if (existsSync(checkpointPath)) {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8'));
      if (checkpoint.currentPhase === 4 && checkpoint.status === 'completed') {
        return 'completed';
      }
      return 'active';
    }
  } catch (error) {
    console.warn(`  Warning: Could not read checkpoint at ${checkpointPath}`);
  }

  // Fallback: check if all tasks in TODOs are completed
  const todosPath = join(sessionPath, 'TODOs.md');
  try {
    if (existsSync(todosPath)) {
      const content = readFileSync(todosPath, 'utf-8');
      const hasIncompleteTasks = /^-\s+\[\s\]/m.test(content);
      return hasIncompleteTasks ? 'active' : 'completed';
    }
  } catch (error) {
    console.warn(`  Warning: Could not read TODOs at ${todosPath}`);
  }

  return 'active';
}

/**
 * Extract planning code and type from session directory name
 */
function parsePlanningCode(dirName: string): { code: string; type: RegistrySession['type']; fullCode: string } {
  // Pattern: P-001, PF-004, PR-002, PB-042
  const match = dirName.match(/^(P([FRB])?-\d{3,4})/);
  if (!match) {
    return { code: 'UNKNOWN', type: 'feature', fullCode: dirName };
  }

  const code = match[1];
  const prefix = match[2];

  let type: RegistrySession['type'] = 'feature';
  if (prefix === 'R') type = 'refactor';
  if (prefix === 'B') type = 'bugfix';
  if (!prefix) type = 'feature'; // P-XXX defaults to feature

  return { code, type, fullCode: dirName };
}

/**
 * Extract creation date from git or filesystem
 */
function getCreationDate(sessionPath: string): string | undefined {
  try {
    const stat = statSync(sessionPath);
    // Format as ISO 8601 date-time
    const date = stat.birthtime || stat.mtime;
    return date.toISOString();
  } catch (error) {
    return undefined;
  }
}

/**
 * Find all planning sessions (excluding archived)
 */
function findPlanningSessions(baseDir: string): string[] {
  const sessions: string[] = [];

  try {
    const entries = readdirSync(baseDir);

    for (const entry of entries) {
      const fullPath = join(baseDir, entry);

      // Skip non-directories, hidden files, and archived folder
      if (entry.startsWith('.') || entry === 'archived' || !statSync(fullPath).isDirectory()) {
        continue;
      }

      // Must match planning code pattern
      if (/^P[FRB]?-\d{3,4}/.test(entry)) {
        sessions.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading planning directory: ${error}`);
  }

  return sessions;
}

/**
 * Calculate last planning number from all sessions
 */
function calculateLastPlanningNumber(sessions: RegistrySession[]): number {
  let maxNumber = 0;

  for (const session of sessions) {
    const match = session.code.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return maxNumber;
}

/**
 * Generate code registry
 */
function generateRegistry(): CodeRegistry {
  const sessionPaths = findPlanningSessions(PLANNING_ROOT);
  const sessions: RegistrySession[] = [];

  console.log(`Found ${sessionPaths.length} planning sessions\n`);

  for (const sessionPath of sessionPaths) {
    const dirName = sessionPath.split('/').pop()!;
    const { code, type, fullCode } = parsePlanningCode(dirName);
    const status = determineStatus(sessionPath);
    const createdAt = getCreationDate(sessionPath);

    // Extract task codes from TODOs.md
    let tasks: string[] = [];
    const todosPath = join(sessionPath, 'TODOs.md');
    try {
      if (existsSync(todosPath)) {
        const content = readFileSync(todosPath, 'utf-8');
        tasks = extractTaskCodes(content);
      }
    } catch (error) {
      console.warn(`  Warning: Could not read TODOs.md for ${code}`);
    }

    sessions.push({
      code,
      type,
      fullCode,
      sessionPath: dirName,
      status,
      createdAt,
      tasks
    });

    console.log(`  ✓ ${code} (${type}) - ${tasks.length} tasks - ${status}`);
  }

  // Sort sessions by code
  sessions.sort((a, b) => a.code.localeCompare(b.code));

  const lastPlanningNumber = calculateLastPlanningNumber(sessions);

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    lastPlanningNumber,
    registry: sessions
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Generating code registry from planning sessions...\n');

  const registry = generateRegistry();

  console.log(`\n✅ Registry generated successfully!`);
  console.log(`   Version: ${registry.version}`);
  console.log(`   Sessions: ${registry.registry.length}`);
  console.log(`   Last Planning Number: ${registry.lastPlanningNumber}`);
  console.log(`   Output: ${REGISTRY_PATH}\n`);

  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

  // Print summary by status
  const statusCounts = registry.registry.reduce((acc, session) => {
    acc[session.status] = (acc[session.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Status summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  // Print summary by type
  const typeCounts = registry.registry.reduce((acc, session) => {
    acc[session.type] = (acc[session.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📋 Type summary:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  // Total tasks
  const totalTasks = registry.registry.reduce((sum, session) => sum + session.tasks.length, 0);
  console.log(`\n📝 Total tasks: ${totalTasks}`);
}

main();
