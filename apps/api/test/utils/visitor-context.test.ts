/**
 * Tests for getVisitorContext (HOS-2119, T-071).
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
    getVisitorContext,
    getVisitorContextFromHeaders,
    markHeadersAsNotVisitor,
    type VisitorContext
} from '../../src/utils/visitor-context.js';

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

describe('getVisitorContextFromHeaders', () => {
    it('should read ip and user agent from Headers', () => {
        const headers = new Headers({ 'cf-connecting-ip': '9.9.9.9', 'user-agent': 'UA/1' });
        expect(getVisitorContextFromHeaders({ headers })).toEqual({
            ip: '9.9.9.9',
            userAgent: 'UA/1'
        });
    });

    it('should use the first x-forwarded-for entry when cf-connecting-ip is absent', () => {
        const headers = new Headers({
            'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2',
            'user-agent': 'UA'
        });
        expect(getVisitorContextFromHeaders({ headers })?.ip).toBe('1.1.1.1');
    });

    it('should return undefined when headers are null or undefined', () => {
        expect(getVisitorContextFromHeaders({ headers: null })).toBeUndefined();
        expect(getVisitorContextFromHeaders({ headers: undefined })).toBeUndefined();
    });

    it('should return undefined when the ip or user agent is missing or blank', () => {
        expect(
            getVisitorContextFromHeaders({ headers: new Headers({ 'user-agent': 'UA' }) })
        ).toBeUndefined();
        expect(
            getVisitorContextFromHeaders({
                headers: new Headers({ 'cf-connecting-ip': '1.1.1.1', 'user-agent': '  ' })
            })
        ).toBeUndefined();
    });
});

describe('getVisitorContextFromHeaders hardening (HOS-2119, T-072)', () => {
    it('should return undefined for a plain-object headers instead of throwing', () => {
        const plain = { 'cf-connecting-ip': '1.1.1.1', 'user-agent': 'UA' } as unknown as Headers;
        expect(getVisitorContextFromHeaders({ headers: plain })).toBeUndefined();
    });

    it('should return undefined for headers marked as not originated by the visitor', () => {
        const marked = markHeadersAsNotVisitor({
            headers: new Headers({ 'cf-connecting-ip': '1.1.1.1', 'user-agent': 'UA' })
        });
        expect(getVisitorContextFromHeaders({ headers: marked })).toBeUndefined();
        expect(marked.get('user-agent')).toBe('UA');
    });

    it('should not mutate the original headers when marking', () => {
        const original = new Headers({ 'cf-connecting-ip': '1.1.1.1', 'user-agent': 'UA' });
        markHeadersAsNotVisitor({ headers: original });
        expect(getVisitorContextFromHeaders({ headers: original })).toEqual({
            ip: '1.1.1.1',
            userAgent: 'UA'
        });
    });
});
