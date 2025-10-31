#!/usr/bin/env node
/**
 * Code Registry Generator
 * Generates .code-registry.json from all TODOs.md files in planning sessions
 */

const fs = require('fs');
const path = require('path');

const PLANNING_ROOT = path.resolve(process.cwd(), '.claude/sessions/planning');
const REGISTRY_PATH = path.join(PLANNING_ROOT, '.code-registry.json');

function extractTaskCodes(content, planningCode, sessionPath) {
  const tasks = [];
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
      let status = 'pending';

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

function findPlanningSessions(baseDir) {
  const sessions = [];

  try {
    const entries = fs.readdirSync(baseDir);

    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry);

      if (entry.startsWith('.') || !fs.statSync(fullPath).isDirectory()) {
        continue;
      }

      const todosPath = path.join(fullPath, 'TODOs.md');
      if (fs.existsSync(todosPath)) {
        sessions.push({
          path: fullPath,
          todosFile: todosPath
        });
      }
    }
  } catch (error) {
    console.error(`Error reading planning directory: ${error.message}`);
  }

  return sessions;
}

function extractPlanningCode(sessionPath) {
  const match = sessionPath.match(/P-?\d{3,4}[^/]*$/);
  return match ? match[0] : 'UNKNOWN';
}

function generateRegistry() {
  const sessions = findPlanningSessions(PLANNING_ROOT);
  const allTasks = [];

  console.log(`Found ${sessions.length} planning sessions with TODOs.md`);

  for (const session of sessions) {
    const planningCode = extractPlanningCode(session.path);
    const relativePath = session.path.replace(PLANNING_ROOT + '/', '');

    try {
      const content = fs.readFileSync(session.todosFile, 'utf-8');
      const tasks = extractTaskCodes(content, planningCode, relativePath);

      console.log(`  ${planningCode}: ${tasks.length} tasks found`);
      allTasks.push(...tasks);
    } catch (error) {
      console.error(`  Error reading ${session.todosFile}: ${error.message}`);
    }
  }

  allTasks.sort((a, b) => a.code.localeCompare(b.code));

  return {
    generatedAt: new Date().toISOString(),
    totalSessions: sessions.length,
    totalTasks: allTasks.length,
    tasks: allTasks
  };
}

function main() {
  console.log('🔍 Generating code registry from TODOs.md files...\n');

  const registry = generateRegistry();

  console.log(`\n✅ Registry generated successfully!`);
  console.log(`   Sessions: ${registry.totalSessions}`);
  console.log(`   Tasks: ${registry.totalTasks}`);
  console.log(`   Output: ${REGISTRY_PATH}\n`);

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

  const statusCounts = registry.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Status summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
}

main();
