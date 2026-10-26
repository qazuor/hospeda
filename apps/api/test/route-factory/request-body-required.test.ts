import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createCRUDRoute } from '../../src/utils/route-factory';

const base = {
    method: 'post' as const,
    summary: 'request body required',
    description: 'request body required',
    tags: ['Test'],
    requestBody: z.strictObject({ reason: z.enum(['ONE', 'TWO']) }),
    successStatusCode: 200 as const,
    responseSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
    options: { skipAuth: true }
};

describe('createCRUDRoute requestBodyRequired', () => {
    it('accepts a missing body when requestBodyRequired is false', async () => {
        const app = createCRUDRoute({
            ...base,
            path: '/optional-body',
            requestBodyRequired: false
        });
        const response = await app.request('/optional-body', { method: 'POST' });
        expect(response.status).toBe(200);
    });

    it('accepts an empty JSON body when requestBodyRequired is false', async () => {
        const app = createCRUDRoute({
            ...base,
            path: '/optional-empty-json',
            requestBodyRequired: false
        });
        const response = await app.request('/optional-empty-json', {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.status).toBe(200);
    });

    it('still rejects an invalid body when the body is optional', async () => {
        const app = createCRUDRoute({
            ...base,
            path: '/optional-body-invalid',
            requestBodyRequired: false
        });
        const response = await app.request('/optional-body-invalid', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason: 'INVALID' })
        });
        expect(response.status).toBe(400);
    });

    it('keeps the previous behaviour when the flag is omitted', async () => {
        const app = createCRUDRoute({ ...base, path: '/required-body' });
        const response = await app.request('/required-body', { method: 'POST' });
        expect(response.status).toBe(200);

        const document = app.getOpenAPIDocument({
            openapi: '3.0.0',
            info: { title: 'test', version: '1.0.0' }
        });
        const body = document.paths?.['/required-body']?.post?.requestBody as
            | { required?: boolean }
            | undefined;
        expect(body).toBeDefined();
        expect(Object.hasOwn(body ?? {}, 'required')).toBe(false);
    });

    it('requires the body and documents it when the flag is true', async () => {
        const app = createCRUDRoute({
            ...base,
            path: '/explicitly-required-body',
            requestBodyRequired: true
        });
        const response = await app.request('/explicitly-required-body', { method: 'POST' });
        expect(response.status).toBe(400);

        const document = app.getOpenAPIDocument({
            openapi: '3.0.0',
            info: { title: 'test', version: '1.0.0' }
        });
        const body = document.paths?.['/explicitly-required-body']?.post?.requestBody as
            | { required?: boolean }
            | undefined;
        expect(body?.required).toBe(true);
    });
});
