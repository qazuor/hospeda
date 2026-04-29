/**
 * Unit tests for response helpers.
 *
 * Covers the SPEC-062 / SPEC-087 runtime response-schema enforcement pieces:
 * - `stripWithSchema`: strip success, no-op (no schema), strict throw on
 *   parse failure (SPEC-087 — drift between handler payload and declared
 *   responseSchema is treated as a server bug).
 * - `createResponse` threading the `responseSchema` parameter.
 * - `createPaginatedResponse` applying the schema per item and leaving
 *   pagination metadata untouched.
 */

import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test',
        HOSPEDA_API_DEBUG_ERRORS: false
    },
    validateApiEnv: vi.fn()
}));

import { apiLogger } from '../../src/utils/logger';
import {
    createPaginatedResponse,
    createResponse,
    stripWithSchema
} from '../../src/utils/response-helpers';

type JsonCall = {
    body: unknown;
    status: number | undefined;
};

const createMockContext = (): { ctx: Context; calls: JsonCall[] } => {
    const calls: JsonCall[] = [];
    const ctx = {
        get: (key: string) => (key === 'requestId' ? 'req-test-1' : undefined),
        json: (body: unknown, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

describe('stripWithSchema', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns data unchanged when no schema is provided', () => {
        const data = { id: '1', name: 'foo', secret: 'keep-me' };
        const result = stripWithSchema(data);
        expect(result).toBe(data);
    });

    it('strips fields not declared in the schema on parse success', () => {
        const schema = z.object({ id: z.string(), name: z.string() });
        const data = { id: '1', name: 'foo', secret: 'gone', adminInfo: { x: 1 } };

        const result = stripWithSchema(data, schema);

        expect(result).toEqual({ id: '1', name: 'foo' });
        expect((result as Record<string, unknown>).secret).toBeUndefined();
        expect((result as Record<string, unknown>).adminInfo).toBeUndefined();
    });

    it('throws ServiceError(INTERNAL_ERROR) and logs an error on parse failure (SPEC-087 strict mode)', () => {
        const schema = z.object({ id: z.string(), required: z.string() });
        const data = { id: '1' };

        expect(() => stripWithSchema(data, schema)).toThrow(/Response payload does not match/i);
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const call = (apiLogger.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        expect(call).toBeDefined();
        const payload = call?.[0] as { message: string; issues: unknown };
        expect(payload.message).toMatch(/stripping failed/i);
        expect(Array.isArray(payload.issues)).toBe(true);
    });
});

describe('createResponse with responseSchema', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends stripped data when a responseSchema is provided', () => {
        const { ctx, calls } = createMockContext();
        const schema = z.object({ id: z.string(), name: z.string() });
        const data = { id: '1', name: 'foo', adminInfo: 'secret' };

        createResponse(data, ctx, 200, schema);

        expect(calls).toHaveLength(1);
        const envelope = calls[0]?.body as { success: true; data: Record<string, unknown> };
        expect(envelope.success).toBe(true);
        expect(envelope.data).toEqual({ id: '1', name: 'foo' });
        expect(envelope.data.adminInfo).toBeUndefined();
    });

    it('sends data unchanged when no responseSchema is provided (backward compatible)', () => {
        const { ctx, calls } = createMockContext();
        const data = { id: '1', name: 'foo', anything: 'stays' };

        createResponse(data, ctx, 200);

        const envelope = calls[0]?.body as { data: Record<string, unknown> };
        expect(envelope.data).toEqual(data);
    });

    it('throws ServiceError when handler payload does not match declared responseSchema (SPEC-087 strict mode)', () => {
        const { ctx, calls } = createMockContext();
        const schema = z.object({ id: z.string(), required: z.string() });
        const data = { id: '1', extra: 'preserved' };

        expect(() => createResponse(data, ctx, 200, schema)).toThrow(
            /Response payload does not match/i
        );
        expect(calls).toHaveLength(0);
        expect(apiLogger.error).toHaveBeenCalled();
    });
});

describe('createPaginatedResponse with responseSchema', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const pagination = {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
    };

    it('strips each item individually and leaves pagination untouched', () => {
        const { ctx, calls } = createMockContext();
        const schema = z.object({ id: z.string(), name: z.string() });
        const items = [
            { id: '1', name: 'a', secret: 'x' },
            { id: '2', name: 'b', adminInfo: { sensitive: true } }
        ];

        createPaginatedResponse(items, pagination, ctx, 200, schema);

        const envelope = calls[0]?.body as {
            data: { items: Record<string, unknown>[]; pagination: typeof pagination };
        };
        expect(envelope.data.items).toEqual([
            { id: '1', name: 'a' },
            { id: '2', name: 'b' }
        ]);
        expect(envelope.data.pagination).toEqual(pagination);
    });

    it('returns items unchanged when no responseSchema is provided', () => {
        const { ctx, calls } = createMockContext();
        const items = [{ id: '1', keep: 'yes' }];

        createPaginatedResponse(items, pagination, ctx, 200);

        const envelope = calls[0]?.body as { data: { items: unknown[] } };
        expect(envelope.data.items).toEqual(items);
    });

    it('handles empty items array without stripping errors', () => {
        const { ctx, calls } = createMockContext();
        const schema = z.object({ id: z.string() });

        createPaginatedResponse([], pagination, ctx, 200, schema);

        const envelope = calls[0]?.body as { data: { items: unknown[] } };
        expect(envelope.data.items).toEqual([]);
        expect(apiLogger.warn).not.toHaveBeenCalled();
    });

    it('throws on first per-item parse failure and prevents response emission (SPEC-087 strict mode)', () => {
        const { ctx, calls } = createMockContext();
        const schema = z.object({ id: z.string(), required: z.string() });
        const items = [
            { id: '1', required: 'ok', name: 'stripped' },
            { id: '2', name: 'kept-as-is' }
        ];

        expect(() => createPaginatedResponse(items, pagination, ctx, 200, schema)).toThrow(
            /Response payload does not match/i
        );
        expect(calls).toHaveLength(0);
        expect(apiLogger.error).toHaveBeenCalled();
    });
});
