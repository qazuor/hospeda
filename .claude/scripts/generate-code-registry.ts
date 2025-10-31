#!/usr/bin/env tsx
/**
 * Code Registry Generator
 *
 * Generates .code-registry.json from all TODOs.md files in planning sessions.
 * The registry is a computed value (not source of truth) that provides quick
 * lookup of task codes to their planning sessions.
 *
 * Usage:
 *   tsx .claude/scripts/generate-code-registry.ts
 *
 * Output:
 *   .claude/sessions/planning/.code-registry.json
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface TaskCode {
  code: string;
  planningCode: string;
  sessionPath: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped';
  estimatedHours: number;
  phase?: number;
}

interface CodeRegistry {
  generatedAt: string;
  totalSessions: number;
  totalTasks: number;
  tasks: TaskCode[];
}

const PLANNING_ROOT = resolve(process.cwd(), '.claude/sessions/planning');
const REGISTRY_PATH = join(PLANNING_ROOT, '.code-registry.json');

/**
 * Extract task codes from TODOs.md content
 */
function extractTaskCodes(content: string, planningCode: string, sessionPath: string): TaskCode[] {
  const tasks: TaskCode[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match heading: ### PF004-1: Task Title
    const headingMatch = line.match(/^###\s+(PF\d{3,4}(?:-\d+)?(?:\.\d+)?)[:\s]+(.+)$/);
    if (headingMatch) {
      const code = headingMatch[1];
      const headingTitle = headingMatch[2].trim();

      // Look for task item in next few lines: - [ ] **[1h]** Task description
      let taskTitle = headingTitle;
      let estimatedHours = 1;
      let status: TaskCode['status'] = 'pending';

      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const taskMatch = lines[j].match(/^-\s+\[([ xX])\]\s+\*\*\[(\d+(?:\.\d+)?)h\]\*\*\s+(.+)$/);
        if (taskMatch) {
          status = taskMatch[1].toLowerCase() === 'x' ? 'completed' : 'pending';
          estimatedHours = parseFloat(taskMatch[2]);
          taskTitle = taskMatch[3].trim();
          break;
        }
      }

      tasks.push({
        code,
        planningCode,
        sessionPath,
        title: taskTitle,
        status,
        estimatedHours
      });
    }
  }

  return tasks;
}

/**
 * Find all planning sessions with TODOs.md
 */
function findPlanningSessions(baseDir: string): Array<{ path: string; todosFile: string }> {
  const sessions: Array<{ path: string; todosFile: string }> = [];

  try {
    const entries = readdirSync(baseDir);

    for (const entry of entries) {
      const fullPath = join(baseDir, entry);

      // Skip non-directories and hidden files
      if (entry.startsWith('.') || !statSync(fullPath).isDirectory()) {
        continue;
      }

      // Check if TODOs.md exists
      const todosPath = join(fullPath, 'TODOs.md');
      try {
        if (statSync(todosPath).isFile()) {
          sessions.push({
            path: fullPath,
            todosFile: todosPath
          });
        }
      } catch {
        // TODOs.md doesn't exist, skip
      }
    }
  } catch (error) {
    console.error(`Error reading planning directory: ${error}`);
  }

  return sessions;
}

/**
 * Extract planning code from session path
 */
function extractPlanningCode(sessionPath: string): string {
  const match = sessionPath.match(/P-?\d{3,4}[^/]*$/);
  return match ? match[0] : 'UNKNOWN';
}

/**
 * Generate code registry
 */
function generateRegistry(): CodeRegistry {
  const sessions = findPlanningSessions(PLANNING_ROOT);
  const allTasks: TaskCode[] = [];

  console.log(`Found ${sessions.length} planning sessions with TODOs.md`);

  for (const session of sessions) {
    const planningCode = extractPlanningCode(session.path);
    const relativePath = session.path.replace(PLANNING_ROOT + '/', '');

    try {
      const content = readFileSync(session.todosFile, 'utf-8');
      const tasks = extractTaskCodes(content, planningCode, relativePath);

      console.log(`  ${planningCode}: ${tasks.length} tasks found`);
      allTasks.push(...tasks);
    } catch (error) {
      console.error(`  Error reading ${session.todosFile}: ${error}`);
    }
  }

  // Sort tasks by code
  allTasks.sort((a, b) => a.code.localeCompare(b.code));

  return {
    generatedAt: new Date().toISOString(),
    totalSessions: sessions.length,
    totalTasks: allTasks.length,
    tasks: allTasks
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Generating code registry from TODOs.md files...\n');

  const registry = generateRegistry();

  console.log(`\n✅ Registry generated successfully!`);
  console.log(`   Sessions: ${registry.totalSessions}`);
  console.log(`   Tasks: ${registry.totalTasks}`);
  console.log(`   Output: ${REGISTRY_PATH}\n`);

  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

  // Print summary by status
  const statusCounts = registry.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Status summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
}

main();
