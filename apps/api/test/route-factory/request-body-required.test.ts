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

    it('keeps the default required-body behavior when the flag is omitted', async () => {
        const app = createCRUDRoute({ ...base, path: '/required-body' });
        const response = await app.request('/required-body', { method: 'POST' });
        expect(response.status).toBe(400);
    });
});
