/**
 * Integration tests for planning session parser
 *
 * @module test/parsers/planning-session
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePlanningSession } from '../../src/parsers/planning-session';

const FIXTURES_DIR = path.join(__dirname, '../fixtures/planning-sessions');

describe('PlanningSessionParser (Integration)', () => {
    it('should parse complete planning session', async () => {
        // Arrange
        const sessionPath = path.join(FIXTURES_DIR, 'P-003-valid');

        // Act
        const session = await parsePlanningSession(sessionPath);

        // Assert
        expect(session.metadata.planningCode).toBe('P-003');
        expect(session.metadata.featureName).toBeTruthy();
        expect(session.metadata.summary).toBeTruthy();
        expect(session.tasks.length).toBeGreaterThan(0);
        expect(session.sessionPath).toBe(sessionPath);
    });

    it('should extract all tasks with hierarchy', async () => {
        // Arrange
        const sessionPath = path.join(FIXTURES_DIR, 'P-003-valid');

        // Act
        const session = await parsePlanningSession(sessionPath);

        // Assert
        expect(session.tasks.length).toBeGreaterThan(0);

        // Check that at least one task has the expected structure
        const firstTask = session.tasks[0];
        expect(firstTask.id).toBeTruthy();
        expect(firstTask.code).toMatch(/^T-003-\d{3}$/);
        expect(firstTask.title).toBeTruthy();
        expect(firstTask.level).toBe(0); // Top-level task
    });

    it('should generate unique task codes', async () => {
        // Arrange
        const sessionPath = path.join(FIXTURES_DIR, 'P-003-valid');

        // Act
        const session = await parsePlanningSession(sessionPath);

        // Assert
        const allTasks = flattenTasks(session.tasks);
        const codes = allTasks.map((t) => t.code);
        const uniqueCodes = new Set(codes);

        expect(codes.length).toBe(uniqueCodes.size); // All codes should be unique
    });

    it('should maintain task metadata', async () => {
        // Arrange - Use simple fixture with metadata
        const sessionPath = path.join(FIXTURES_DIR, 'P-999-simple');

        // Act
        const session = await parsePlanningSession(sessionPath);

        // Assert
        const allTasks = flattenTasks(session.tasks);
        const tasksWithPhase = allTasks.filter((t: { phase?: number }) => t.phase !== undefined);
        expect(tasksWithPhase.length).toBeGreaterThan(0);
    });
});

/**
 * Flatten task hierarchy to array
 */
function flattenTasks(tasks: Array<{ subtasks?: unknown[] }>): unknown[] {
    const result: unknown[] = [];

    for (const task of tasks) {
        result.push(task);
        if (task.subtasks && Array.isArray(task.subtasks)) {
            result.push(...flattenTasks(task.subtasks));
        }
    }

    return result;
}
