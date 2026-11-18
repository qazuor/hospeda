/**
 * HOS-2335 §5.6 — assistant activity schemas: the own filter refuses any user
 * filter (AC-C45, AC-C54), the retention constants match D-13, and an item
 * accepts no key outside its allowlist (AC-C46).
 */
import { describe, expect, it } from 'vitest';
import {
    MCP_AUDIT_RETENTION_MONTHS,
    MCP_TOOL_CALL_EVENT_TYPE,
    McpActivityAllFilterSchema,
    McpActivityItemSchema,
    McpActivityOwnFilterSchema,
    McpActivityPageSchema
} from '../../src/index.js';

const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';

describe('assistant activity schemas', () => {
    it('keeps MCP rows 12 months, scoped to mcp.tool.call (D-13)', () => {
        expect(MCP_AUDIT_RETENTION_MONTHS).toBe(12);
        expect(MCP_TOOL_CALL_EVENT_TYPE).toBe('mcp.tool.call');
    });

    it.each(['userId', 'actorId'])('the own filter refuses %s', (key) => {
        expect(McpActivityOwnFilterSchema.safeParse({ [key]: USER_ID }).success).toBe(false);
    });

    it('the all filter takes a userId but no actorId', () => {
        expect(McpActivityAllFilterSchema.safeParse({ userId: USER_ID }).success).toBe(true);
        expect(McpActivityAllFilterSchema.safeParse({ actorId: USER_ID }).success).toBe(false);
    });

    it('accepts each filter and coerces the dates', () => {
        const parsed = McpActivityOwnFilterSchema.parse({
            tool: 'reply_inquiry',
            outcome: 'denied',
            access: 'read',
            clientId: 'https://claude.ai/oauth/mcp-client-metadata',
            fromDate: '2026-11-01T00:00:00Z',
            toDate: '2026-11-30T00:00:00Z',
            sortDirection: 'asc'
        });
        expect(parsed.fromDate).toBeInstanceOf(Date);
        expect(McpActivityOwnFilterSchema.safeParse({ outcome: 'ok' }).success).toBe(false);
        expect(McpActivityOwnFilterSchema.safeParse({ access: 'both' }).success).toBe(false);
        expect(McpActivityOwnFilterSchema.safeParse({ tool: 'Drop Table' }).success).toBe(false);
    });

    it('bounds the page at 100 and refuses limit', () => {
        expect(McpActivityPageSchema.safeParse({ page: 1, pageSize: 100 }).success).toBe(true);
        expect(McpActivityPageSchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false);
        expect(McpActivityPageSchema.safeParse({ page: 1, pageSize: 5, limit: 5 }).success).toBe(
            false
        );
    });

    it('an item refuses any key outside its allowlist (AC-C46)', () => {
        const item = {
            id: USER_ID,
            loggedAt: new Date(),
            tool: 'reply_inquiry',
            isWrite: true,
            outcome: 'success',
            client: { id: 'c' }
        };
        expect(McpActivityItemSchema.safeParse(item).success).toBe(true);
        expect(McpActivityItemSchema.safeParse({ ...item, text: 'hola' }).success).toBe(false);
        expect(
            McpActivityItemSchema.safeParse({ ...item, client: { id: 'c', uri: 'x' } }).success
        ).toBe(false);
    });
});
