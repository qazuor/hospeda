import { sql } from '@repo/db';
import { testDb } from './test-database.js';

/**
 * E2E test cleanup utilities
 * Provides helpers for cleaning test data
 */

/**
 * Clean specific entities by ID
 * @param tableName - Name of the table to clean
 * @param ids - Array of entity IDs to delete
 */
export async function cleanupEntity(tableName: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const db = testDb.getDb();

    await db.execute(
        sql.raw(
            `DELETE FROM "${tableName}" WHERE id = ANY(ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[])`
        )
    );
}

/**
 * Clean all test data created during test
 * Uses the TestDatabaseManager's clean method
 */
export async function cleanupAllTestData(): Promise<void> {
    await testDb.clean();
}

/**
 * Setup cleanup tracking for automatic cleanup
 * Tracks entities created during tests for cleanup
 */
export class CleanupTracker {
    private entities: Map<string, Set<string>> = new Map();

    /**
     * Track entity for cleanup
     * @param tableName - Table name
     * @param id - Entity ID
     */
    track(tableName: string, id: string) {
        if (!this.entities.has(tableName)) {
            this.entities.set(tableName, new Set());
        }
        this.entities.get(tableName)!.add(id);
    }

    /**
     * Track multiple entities for cleanup
     * @param tableName - Table name
     * @param ids - Array of entity IDs
     */
    trackMany(tableName: string, ids: string[]) {
        for (const id of ids) {
            this.track(tableName, id);
        }
    }

    /**
     * Clean all tracked entities
     */
    async cleanAll() {
        for (const [tableName, ids] of this.entities.entries()) {
            await cleanupEntity(tableName, Array.from(ids));
        }
        this.entities.clear();
    }

    /**
     * Get count of tracked entities
     */
    getTrackedCount(): number {
        let count = 0;
        for (const ids of this.entities.values()) {
            count += ids.size;
        }
        return count;
    }

    /**
     * Get count of tracked entities by table
     */
    getTrackedCountByTable(tableName: string): number {
        return this.entities.get(tableName)?.size || 0;
    }

    /**
     * Clear tracked entities without cleaning
     */
    clear() {
        this.entities.clear();
    }
}
