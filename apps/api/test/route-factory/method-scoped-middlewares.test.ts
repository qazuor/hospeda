/**
 * @file method-scoped-middlewares.test.ts
 * @description HOS-1908 — a route's middlewares run for its own method only.
 *
 * The factory used to register each route's middlewares with
 * `app.use(path, mw)`, which matches every method. Mounted next to each other,
 * `GET /{id}` and `PATCH /{id}` then ran BOTH gates on a PATCH, so an actor
 * holding exactly what PATCH declares was refused by GET's gate.
 *
 * These tests mount sibling routes on one path and check two directions: a
 * method never runs a sibling's gate, and it still runs its own (no fail-open).
 *
 * @module test/route-factory/method-scoped-middlewares
 */

import type { MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRouter } from '../../src/utils/create-app';
import { createCRUDRoute, createSimpleRoute } from '../../src/utils/route-factory';
import { createStreamingRoute } from '../../src/utils/streaming-route-factory';

/** Records which gate ran and refuses unless the request carries its grant. */
const createGate = ({
    name,
    calls
}: {
    readonly name: string;
    readonly calls: string[];
}): MiddlewareHandler => {
    return async (c, next) => {
        calls.push(name);
        const grants = (c.req.header('x-grants') ?? '').split(',');
        if (!grants.includes(name)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', gate: name } }, 403);
        }
        await next();
        return undefined;
    };
};

const responseSchema = z.object({ ok: z.boolean() });

/**
 * Mounts GET, PUT, PATCH and DELETE on `/items/{id}`, each with its own gate,
 * in the order the attraction admin router uses.
 */
const buildSiblingApp = ({ calls }: { readonly calls: string[] }) => {
    const shared = {
        path: '/{id}',
        summary: 'sibling',
        description: 'sibling',
        tags: ['Test'],
        requestParams: { id: z.string() },
        responseSchema,
        handler: async () => ({ ok: true })
    };
    const app = createRouter();
    for (const method of ['get', 'put', 'patch', 'delete'] as const) {
        app.route(
            '/items',
            createCRUDRoute({
                ...shared,
                method,
                requestBody:
                    method === 'put' || method === 'patch'
                        ? z.object({ name: z.string() })
                        : undefined,
                options: { middlewares: [createGate({ name: method, calls })] }
            })
        );
    }
    return app;
};

const send = ({
    app,
    method,
    grants
}: {
    readonly app: ReturnType<typeof buildSiblingApp>;
    readonly method: 'GET' | 'PUT' | 'PATCH' | 'DELETE';
    readonly grants: readonly string[];
}) =>
    app.request('/items/abc', {
        method,
        headers: { 'content-type': 'application/json', 'x-grants': grants.join(',') },
        body: method === 'PUT' || method === 'PATCH' ? JSON.stringify({ name: 'x' }) : undefined
    });

describe('route factory — middlewares are scoped to the route method (HOS-1908)', () => {
    it.each([
        ['GET', 'get'],
        ['PUT', 'put'],
        ['PATCH', 'patch'],
        ['DELETE', 'delete']
    ] as const)('%s runs only its own gate and passes with only its own grant', async (method, gate) => {
        // Arrange
        const calls: string[] = [];
        const app = buildSiblingApp({ calls });

        // Act
        const res = await send({ app, method, grants: [gate] });

        // Assert
        expect(res.status).toBe(200);
        expect(calls).toEqual([gate]);
    });

    it.each([
        ['GET', 'get'],
        ['PUT', 'put'],
        ['PATCH', 'patch'],
        ['DELETE', 'delete']
    ] as const)('%s still runs its own gate — no fail-open', async (method, gate) => {
        // Arrange: every grant EXCEPT the route's own.
        const calls: string[] = [];
        const app = buildSiblingApp({ calls });
        const others = ['get', 'put', 'patch', 'delete'].filter((name) => name !== gate);

        // Act
        const res = await send({ app, method, grants: others });

        // Assert
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ error: { gate } });
        expect(calls).toEqual([gate]);
    });

    it('HEAD is served through the GET route and runs the GET gate', async () => {
        const calls: string[] = [];
        const app = buildSiblingApp({ calls });

        const res = await app.request('/items/abc', { method: 'HEAD' });

        expect(res.status).toBe(403);
        expect(calls).toEqual(['get']);
    });

    it('a method with no route on the path runs no sibling gate', async () => {
        const calls: string[] = [];
        const app = buildSiblingApp({ calls });

        const res = await app.request('/items/abc', { method: 'POST' });

        expect(res.status).toBe(404);
        expect(calls).toEqual([]);
    });

    it('simple routes sharing a path keep their middlewares apart', async () => {
        // Arrange: GET also declares a per-route rate limit; POST declares none.
        const calls: string[] = [];
        const app = createRouter();
        app.route(
            '/r',
            createSimpleRoute({
                method: 'get',
                path: '/',
                summary: 's',
                description: 's',
                tags: ['Test'],
                responseSchema,
                handler: async () => ({ ok: true }),
                options: {
                    middlewares: [createGate({ name: 'get', calls })],
                    customRateLimit: { requests: 1, windowMs: 60_000 }
                }
            })
        );
        app.route(
            '/r',
            createSimpleRoute({
                method: 'post',
                path: '/',
                summary: 's',
                description: 's',
                tags: ['Test'],
                responseSchema,
                handler: async () => ({ ok: true }),
                options: { middlewares: [createGate({ name: 'post', calls })] }
            })
        );

        // Act
        const res = await app.request('/r', { method: 'POST', headers: { 'x-grants': 'post' } });

        // Assert
        expect(res.status).toBe(200);
        expect(calls).toEqual(['post']);
    });

    it('streaming routes scope their middlewares to their method', async () => {
        const calls: string[] = [];
        const app = createRouter();
        app.route(
            '/s',
            createCRUDRoute({
                method: 'get',
                path: '/',
                summary: 's',
                description: 's',
                tags: ['Test'],
                responseSchema,
                handler: async () => ({ ok: true }),
                options: { middlewares: [createGate({ name: 'get', calls })] }
            })
        );
        app.route(
            '/s',
            createStreamingRoute({
                path: '/',
                summary: 's',
                description: 's',
                tags: ['Test'],
                streamHandler: async () => ({ stream: (async function* () {})() }),
                options: { middlewares: [createGate({ name: 'stream', calls })] }
            })
        );

        const denied = await app.request('/s', { method: 'POST', headers: { 'x-grants': 'get' } });
        expect(denied.status).toBe(403);
        expect(calls).toEqual(['stream']);

        calls.length = 0;
        const allowed = await app.request('/s', {
            method: 'POST',
            headers: { 'x-grants': 'stream' }
        });
        expect(allowed.status).toBe(200);
        expect(calls).toEqual(['stream']);
    });
});
