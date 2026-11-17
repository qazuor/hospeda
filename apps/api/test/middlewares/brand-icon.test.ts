/**
 * HOS-2324 — the API answers `/favicon.ico` and `/icon.png` with the real
 * Hospeda image instead of the old emoji `text/plain`.
 *
 * @module test/middlewares/brand-icon
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { serveBrandIcon } from '../../src/middlewares/brand-icon';
import type { AppBindings } from '../../src/types';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const ICO_SIGNATURE = [0x00, 0x00, 0x01, 0x00];

const buildApp = () => {
    const app = new Hono<AppBindings>();
    app.use(serveBrandIcon());
    app.get('/other', (c) => c.text('other'));
    return app;
};

describe('serveBrandIcon', () => {
    it('serves /favicon.ico as an image with a non-empty ICO body', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/favicon.ico');
        const bytes = new Uint8Array(await res.arrayBuffer());

        // Assert
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/^image\//);
        expect(bytes.byteLength).toBeGreaterThan(0);
        expect([...bytes.slice(0, 4)]).toEqual(ICO_SIGNATURE);
    });

    it('serves /icon.png as image/png with a PNG body', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/icon.png');
        const bytes = new Uint8Array(await res.arrayBuffer());

        // Assert
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
        expect(res.headers.get('content-length')).toBe(String(bytes.byteLength));
    });

    it('answers HEAD without a body', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/icon.png', { method: 'HEAD' });

        // Assert
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        expect(await res.text()).toBe('');
    });

    it('does not intercept other paths or non-GET methods', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const other = await app.request('/other');
        const post = await app.request('/favicon.ico', { method: 'POST' });

        // Assert
        expect(await other.text()).toBe('other');
        expect(post.status).toBe(404);
    });
});
