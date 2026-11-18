/**
 * HOS-2335 §6.9 (HOS-2348) — the owner's history query and item.
 *
 * - The query is strict: a `userId`, `actorId` or `scope` param fails, so the
 *   own scope cannot be widened by input (AC-C45, AC-C54).
 * - The "mostrar también consultas" toggle maps to the `access` filter: off is
 *   writes only, on is both (D-12, AC-C50a).
 * - The owner item carries no `actorId` and no key outside the allowlist (AC-C46).
 */
import { describe, expect, it } from 'vitest';
import {
    MCP_ACTIVITY_OWN_MAX_PAGE_SIZE,
    McpActivityOwnItemSchema,
    McpActivityOwnQuerySchema,
    toMcpActivityOwnFilter
} from '../../src/index.js';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';

describe('McpActivityOwnQuerySchema', () => {
    it('defaults to page 1 of 20 with reads hidden', () => {
        // Arrange / Act
        const parsed = McpActivityOwnQuerySchema.parse({});

        // Assert
        expect(parsed).toEqual({ page: 1, pageSize: 20, includeReads: false });
        expect(MCP_ACTIVITY_OWN_MAX_PAGE_SIZE).toBe(20);
    });

    it.each([
        'userId',
        'actorId',
        'scope',
        'tool',
        'access',
        'limit'
    ])('refuses a %s param', (key) => {
        expect(McpActivityOwnQuerySchema.safeParse({ [key]: USER_ID }).success).toBe(false);
    });

    it('caps the page size at 20', () => {
        expect(McpActivityOwnQuerySchema.safeParse({ pageSize: '20' }).success).toBe(true);
        expect(McpActivityOwnQuerySchema.safeParse({ pageSize: '21' }).success).toBe(false);
    });

    it('reads includeReads strictly: only the literals true and false', () => {
        expect(McpActivityOwnQuerySchema.parse({ includeReads: 'true' }).includeReads).toBe(true);
        expect(McpActivityOwnQuerySchema.parse({ includeReads: 'false' }).includeReads).toBe(false);
        expect(McpActivityOwnQuerySchema.safeParse({ includeReads: '1' }).success).toBe(false);
    });

    it('takes a bare toDate as the end of that day', () => {
        const parsed = McpActivityOwnQuerySchema.parse({ toDate: '2026-11-18' });
        expect(parsed.toDate?.toISOString()).toBe('2026-11-18T23:59:59.999Z');
    });
});

describe('toMcpActivityOwnFilter (D-12)', () => {
    it('lists writes only when the toggle is off', () => {
        expect(toMcpActivityOwnFilter({ query: { includeReads: false } })).toEqual({
            access: 'write'
        });
    });

    it('lists reads and writes when the toggle is on', () => {
        expect(toMcpActivityOwnFilter({ query: { includeReads: true } })).toEqual({});
    });

    it('carries the other filters through and never a user', () => {
        // Arrange
        const fromDate = new Date('2026-11-01T00:00:00.000Z');
        const toDate = new Date('2026-11-18T23:59:59.999Z');

        // Act
        const filter = toMcpActivityOwnFilter({
            query: { includeReads: false, clientId: 'client-1', outcome: 'error', fromDate, toDate }
        });

        // Assert
        expect(filter).toEqual({
            access: 'write',
            clientId: 'client-1',
            outcome: 'error',
            fromDate,
            toDate
        });
        expect(Object.keys(filter)).not.toContain('userId');
    });
});

describe('McpActivityOwnItemSchema (AC-C46)', () => {
    const item = {
        id: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
        loggedAt: new Date('2026-11-18T10:00:00.000Z'),
        tool: 'reply_inquiry',
        isWrite: true,
        outcome: 'success',
        step: 'send',
        client: { id: 'client-1', name: 'Claude' },
        target: { type: 'conversation', id: 'c-1' }
    };

    it('accepts an allowlisted item', () => {
        expect(McpActivityOwnItemSchema.safeParse(item).success).toBe(true);
    });

    it.each([
        ['actorId', USER_ID],
        ['text', 'hola'],
        ['guestName', 'Ana'],
        ['contentLength', 12]
    ])('refuses %s', (key, value) => {
        expect(McpActivityOwnItemSchema.safeParse({ ...item, [key]: value }).success).toBe(false);
    });
});
