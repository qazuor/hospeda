import { describe, expect, it } from 'vitest';
import {
    AiConnectionClientIdSchema,
    AiConnectionListSchema,
    AiConnectionSchema
} from '../../../src/entities/ai-connection/ai-connection.schema.js';

describe('AiConnectionClientIdSchema', () => {
    it('accepts an opaque DCR id and an https CIMD id', () => {
        expect(AiConnectionClientIdSchema.safeParse('abc123_DEF-456').success).toBe(true);
        expect(
            AiConnectionClientIdSchema.safeParse('https://claude.ai/oauth/metadata.json').success
        ).toBe(true);
    });

    it('rejects empty and oversized ids', () => {
        expect(AiConnectionClientIdSchema.safeParse('').success).toBe(false);
        expect(AiConnectionClientIdSchema.safeParse('x'.repeat(2049)).success).toBe(false);
    });

    it('treats the id as opaque: it is never trimmed', () => {
        expect(AiConnectionClientIdSchema.parse(' padded ')).toBe(' padded ');
    });
});

describe('AiConnectionSchema', () => {
    const base = {
        clientId: 'c1',
        name: null,
        uri: null,
        logoUri: null,
        scopes: ['mcp'],
        connectedAt: '2026-11-01T10:00:00.000Z',
        lastUsedAt: null
    };

    it('coerces ISO dates and keeps nulls', () => {
        const parsed = AiConnectionSchema.parse(base);
        expect(parsed.connectedAt).toBeInstanceOf(Date);
        expect(parsed.lastUsedAt).toBeNull();
    });

    it('wraps items in a list', () => {
        expect(AiConnectionListSchema.safeParse({ items: [base] }).success).toBe(true);
        expect(
            AiConnectionListSchema.safeParse({ items: [{ ...base, scopes: 'mcp' }] }).success
        ).toBe(false);
    });
});
