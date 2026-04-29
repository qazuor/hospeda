/**
 * SPEC-087 AC-087-03 — integration tests for factory-level response strip.
 *
 * Builds tiny synthetic apps that exercise the real route factories
 * (`createSimpleRoute`, `createCRUDRoute`, `createListRoute`) with a stable
 * `responseSchema` and a handler that intentionally returns extra fields.
 * Verifies that:
 *
 *  1. Single-resource routes strip extra fields before serialization.
 *  2. List routes strip every item in the paginated response.
 *  3. Nested relation objects validate correctly when declared in the schema.
 *  4. Unknown-field injection in the handler payload is dropped end-to-end.
 *  5. A drift between handler payload and declared schema returns HTTP 500
 *     under SPEC-087 strict mode (no leak).
 *
 * Tier-aware factories (`createPublicRoute`, `createPublicListRoute`,
 * `createProtectedRoute`, `createProtectedListRoute`, `createAdminRoute`,
 * `createAdminListRoute`) all delegate to the two factories tested here, so
 * coverage transitively applies.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { createCRUDRoute, createListRoute, createSimpleRoute } from '../../src/utils/route-factory';

const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    owner: z
        .object({
            id: z.string(),
            displayName: z.string()
        })
        .optional()
});

const FACTORY_OPTS = {
    skipAuth: true,
    skipValidation: true
} as const;

describe('SPEC-087 AC-087-03 — factory-level response strip', () => {
    describe('createSimpleRoute', () => {
        it('strips extra fields from a single-resource payload', async () => {
            const app = createSimpleRoute({
                method: 'get',
                path: '/health-strip',
                summary: 'strip simple',
                description: 'strip simple',
                tags: ['Test'],
                responseSchema: z.object({ status: z.string() }),
                handler: () => ({ status: 'ok', secret: 'leak', adminFlag: true }),
                options: FACTORY_OPTS
            });

            const res = await app.request('/health-strip');
            expect(res.status).toBe(200);

            const body = (await res.json()) as { data: Record<string, unknown> };
            expect(body.data).toEqual({ status: 'ok' });
            expect(body.data.secret).toBeUndefined();
            expect(body.data.adminFlag).toBeUndefined();
        });

        it('returns 500 without leaking the payload when schema parse fails', async () => {
            const app = createSimpleRoute({
                method: 'get',
                path: '/strict-fail',
                summary: 'strict fail',
                description: 'strict fail',
                tags: ['Test'],
                responseSchema: z.object({ status: z.string(), required: z.string() }),
                handler: () => ({ status: 'ok', leaked: 'should-not-appear' }),
                options: FACTORY_OPTS
            });

            const res = await app.request('/strict-fail');
            expect(res.status).toBe(500);

            const text = await res.text();
            expect(text).not.toContain('should-not-appear');

            const body = JSON.parse(text) as { success: false; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('createCRUDRoute', () => {
        it('strips extra fields from the response envelope', async () => {
            const app = createCRUDRoute({
                method: 'get',
                path: '/items/:id',
                summary: 'get item',
                description: 'get item',
                tags: ['Test'],
                requestParams: { id: z.string() },
                responseSchema: ItemSchema,
                handler: async (_ctx, params) => ({
                    id: params.id,
                    name: 'item-1',
                    secret: 'do-not-leak',
                    adminAuditTrail: ['x']
                }),
                options: FACTORY_OPTS
            });

            const res = await app.request('/items/abc');
            expect(res.status).toBe(200);

            const body = (await res.json()) as { data: Record<string, unknown> };
            expect(body.data).toEqual({ id: 'abc', name: 'item-1' });
            expect(body.data.secret).toBeUndefined();
            expect(body.data.adminAuditTrail).toBeUndefined();
        });

        it('keeps nested relation fields declared in the schema and drops the rest', async () => {
            const app = createCRUDRoute({
                method: 'get',
                path: '/items/:id',
                summary: 'get item',
                description: 'get item',
                tags: ['Test'],
                requestParams: { id: z.string() },
                responseSchema: ItemSchema,
                handler: async (_ctx, params) => ({
                    id: params.id,
                    name: 'item-1',
                    owner: {
                        id: 'owner-1',
                        displayName: 'Public Name',
                        email: 'leak@example.com',
                        passwordHash: '$2a$leak'
                    }
                }),
                options: FACTORY_OPTS
            });

            const res = await app.request('/items/xyz');
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data: { owner?: Record<string, unknown> };
            };
            expect(body.data.owner).toEqual({ id: 'owner-1', displayName: 'Public Name' });
            expect(body.data.owner?.email).toBeUndefined();
            expect(body.data.owner?.passwordHash).toBeUndefined();
        });
    });

    describe('createListRoute', () => {
        it('strips every item in a paginated response and leaves pagination intact', async () => {
            const app = createListRoute({
                method: 'get',
                path: '/items',
                summary: 'list items',
                description: 'list items',
                tags: ['Test'],
                responseSchema: ItemSchema,
                handler: async () => ({
                    items: [
                        { id: '1', name: 'a', secret: 'x' },
                        { id: '2', name: 'b', adminInfo: { sensitive: true } }
                    ],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 2,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                }),
                options: FACTORY_OPTS
            });

            const res = await app.request('/items');
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data: {
                    items: Record<string, unknown>[];
                    pagination: { total: number; page: number };
                };
            };
            expect(body.data.items).toEqual([
                { id: '1', name: 'a' },
                { id: '2', name: 'b' }
            ]);
            expect(body.data.pagination.total).toBe(2);
            expect(body.data.pagination.page).toBe(1);
        });

        it('returns 500 without leaking when any item drifts from the schema', async () => {
            const app = createListRoute({
                method: 'get',
                path: '/items',
                summary: 'list items',
                description: 'list items',
                tags: ['Test'],
                responseSchema: ItemSchema,
                handler: async () => ({
                    items: [
                        { id: '1', name: 'a' },
                        { id: '2', leaked: 'must-not-appear' }
                    ],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 2,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                }),
                options: FACTORY_OPTS
            });

            const res = await app.request('/items');
            expect(res.status).toBe(500);
            const text = await res.text();
            expect(text).not.toContain('must-not-appear');
        });
    });
});
