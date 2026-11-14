import { describe, expect, it } from 'vitest';
import { aiConversationsQueryKeys, buildAiConversationsListPath } from '../hooks';
import { AiConversationsSearchSchema, buildAiConversationsSearchParams } from '../types';

describe('buildAiConversationsListPath', () => {
    it('includes only the provided filters plus pagination', () => {
        const path = buildAiConversationsListPath({
            entityType: 'venue',
            from: '2026-11-01',
            page: 2,
            pageSize: 20
        });
        const qs = new URLSearchParams(path.split('?')[1]);
        expect(path.startsWith('/api/v1/admin/ai/conversations?')).toBe(true);
        expect(Object.fromEntries(qs)).toEqual({
            entityType: 'venue',
            from: '2026-11-01',
            page: '2',
            pageSize: '20'
        });
    });

    it('drops empty and undefined values', () => {
        const params = buildAiConversationsSearchParams({ a: '', b: undefined, c: 1 });
        expect(params.toString()).toBe('c=1');
    });
});

describe('AiConversationsSearchSchema', () => {
    it('degrades malformed values instead of throwing', () => {
        const r = AiConversationsSearchSchema.parse({
            entityId: 'nope',
            entityType: 'hotel',
            from: 'yesterday',
            page: 'x'
        });
        expect(r.entityId).toBeUndefined();
        expect(r.entityType).toBeUndefined();
        expect(r.from).toBeUndefined();
        expect(r.page).toBe(1);
        expect(r.pageSize).toBe(20);
    });
});

describe('aiConversationsQueryKeys', () => {
    it('keys detail by id', () => {
        expect(aiConversationsQueryKeys.detail('x')).toEqual(['ai-conversations', 'detail', 'x']);
    });
});
