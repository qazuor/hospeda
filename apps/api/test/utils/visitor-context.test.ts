/**
 * Tests for getVisitorContext (HOS-2119, T-071).
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { getVisitorContext, type VisitorContext } from '../../src/utils/visitor-context.js';

async function read(headers: Record<string, string>): Promise<VisitorContext | undefined> {
    let result: VisitorContext | undefined;
    const app = new Hono();
    app.get('/', (c) => {
        result = getVisitorContext(c);
        return c.text('ok');
    });
    await app.request('/', { headers });
    return result;
}

describe('getVisitorContext', () => {
    it('should prefer cf-connecting-ip over x-forwarded-for', async () => {
        const result = await read({
            'cf-connecting-ip': '9.9.9.9',
            'x-forwarded-for': '1.1.1.1',
            'user-agent': 'UA/1'
        });
        expect(result).toEqual({ ip: '9.9.9.9', userAgent: 'UA/1' });
    });

    it('should use the first x-forwarded-for entry', async () => {
        const result = await read({
            'x-forwarded-for': '1.1.1.1, 2.2.2.2',
            'user-agent': 'UA/1'
        });
        expect(result?.ip).toBe('1.1.1.1');
    });

    it('should trim whitespace', async () => {
        const result = await read({
            'x-forwarded-for': '  3.3.3.3  , 2.2.2.2',
            'user-agent': '  UA/1  '
        });
        expect(result).toEqual({ ip: '3.3.3.3', userAgent: 'UA/1' });
    });

    it('should return undefined when the user agent is missing', async () => {
        expect(await read({ 'cf-connecting-ip': '9.9.9.9' })).toBeUndefined();
    });

    it('should return undefined when no ip header is present', async () => {
        expect(await read({ 'user-agent': 'UA/1' })).toBeUndefined();
    });

    it('should return undefined for blank values', async () => {
        expect(await read({ 'cf-connecting-ip': '   ', 'user-agent': 'UA/1' })).toBeUndefined();
        expect(await read({ 'cf-connecting-ip': '9.9.9.9', 'user-agent': '   ' })).toBeUndefined();
    });

    it('should fall back to x-forwarded-for when cf-connecting-ip is blank', async () => {
        const result = await read({
            'cf-connecting-ip': '  ',
            'x-forwarded-for': '4.4.4.4',
            'user-agent': 'UA/1'
        });
        expect(result?.ip).toBe('4.4.4.4');
    });
});
