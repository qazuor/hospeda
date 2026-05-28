/**
 * Unit tests for the admin system-health route — SPEC-155 follow-up (card E).
 *
 * Verifies:
 *  - status "up" when DB + Redis are reachable.
 *  - Redis "unknown" (not an error) when Redis is not configured.
 *  - status "degraded" when Redis ping fails but DB is fine.
 *  - status "down" when the DB check throws.
 *  - handler registered on path `/health`.
 *
 * Pattern: mock `createAdminRoute` to capture the raw handler, then invoke it
 * directly — same approach as admin-pending-count.test.ts (avoids booting Hono).
 *
 * @module test/routes/system/admin-system-health
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs — available inside vi.mock() factory closures.
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, () => Promise<unknown>>()
}));

const { mockExecute, mockGetDb, mockGetRedisClient } = vi.hoisted(() => ({
    mockExecute: vi.fn(),
    mockGetDb: vi.fn(),
    mockGetRedisClient: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: { path: string; handler: () => Promise<unknown> }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    // `sql` is used as a tagged template (sql`SELECT 1`); a passthrough is enough.
    sql: vi.fn((strings: TemplateStringsArray) => strings)
}));

vi.mock('../../../src/utils/redis', () => ({
    getRedisClient: mockGetRedisClient
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn(), log: vi.fn() }
}));

// Trigger module execution → createAdminRoute captures the handler.
await import('../../../src/routes/system/admin/health');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHealthHandler(): () => Promise<unknown> {
    const handler = capturedHandlers.get('/health');
    if (!handler) {
        throw new Error('No handler captured for path: /health');
    }
    return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminSystemHealthRoute handler — SPEC-155 card E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDb.mockReturnValue({ execute: mockExecute });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns status "up" when DB and Redis are reachable', async () => {
        mockExecute.mockResolvedValue(undefined);
        mockGetRedisClient.mockResolvedValue({ ping: vi.fn().mockResolvedValue('PONG') });

        const result = (await getHealthHandler()()) as {
            status: string;
            db: string;
            redis: string;
        };

        expect(result).toMatchObject({ status: 'up', db: 'connected', redis: 'connected' });
    });

    it('reports Redis "unknown" (not an error) when Redis is not configured', async () => {
        mockExecute.mockResolvedValue(undefined);
        mockGetRedisClient.mockResolvedValue(undefined);

        const result = (await getHealthHandler()()) as { status: string; redis: string };

        // Redis unconfigured is a valid in-memory-fallback mode, not a failure.
        expect(result.status).toBe('up');
        expect(result.redis).toBe('unknown');
    });

    it('returns status "degraded" when Redis ping fails but DB is fine', async () => {
        mockExecute.mockResolvedValue(undefined);
        mockGetRedisClient.mockResolvedValue({
            ping: vi.fn().mockRejectedValue(new Error('redis down'))
        });

        const result = (await getHealthHandler()()) as { status: string; redis: string };

        expect(result.status).toBe('degraded');
        expect(result.redis).toBe('disconnected');
    });

    it('returns status "down" when the DB check throws', async () => {
        mockExecute.mockRejectedValue(new Error('db down'));
        mockGetRedisClient.mockResolvedValue({ ping: vi.fn().mockResolvedValue('PONG') });

        const result = (await getHealthHandler()()) as { status: string; db: string };

        // DB is the only hard dependency → its failure brings the system down.
        expect(result.status).toBe('down');
        expect(result.db).toBe('disconnected');
    });

    it('includes uptime and an ISO timestamp', async () => {
        mockExecute.mockResolvedValue(undefined);
        mockGetRedisClient.mockResolvedValue(undefined);

        const result = (await getHealthHandler()()) as { uptime: number; timestamp: string };

        expect(typeof result.uptime).toBe('number');
        expect(typeof result.timestamp).toBe('string');
    });

    it('is registered on path /health', () => {
        expect(capturedHandlers.has('/health')).toBe(true);
    });
});
