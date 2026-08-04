/**
 * @file transform-editor-content-cards.test.ts
 * @description Unit tests for the editor own-content list transforms
 * (HOS-374 Phase 2 2C-1): `transformPostEditCard(List)` and
 * `transformEventEditCard(List)`.
 */

import { describe, expect, it } from 'vitest';
import {
    transformEventEditCard,
    transformEventEditCardList,
    transformPostEditCard,
    transformPostEditCardList
} from '../../../src/lib/api/transforms';

describe('transformPostEditCard', () => {
    it('transforms a complete raw post item', () => {
        const item = {
            id: 'post-uuid',
            slug: 'mi-articulo',
            title: 'Mi artículo',
            moderationState: 'PENDING',
            visibility: 'PRIVATE',
            lifecycleState: 'DRAFT',
            updatedAt: '2026-01-01T00:00:00.000Z'
        };

        const result = transformPostEditCard({ item });

        expect(result).toEqual({
            id: 'post-uuid',
            slug: 'mi-articulo',
            title: 'Mi artículo',
            moderationState: 'PENDING',
            visibility: 'PRIVATE',
            lifecycleState: 'DRAFT',
            updatedAt: '2026-01-01T00:00:00.000Z'
        });
    });

    it('falls back to createdAt when updatedAt is missing', () => {
        const item = {
            id: 'post-uuid',
            slug: 'mi-articulo',
            title: 'Mi artículo',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE',
            createdAt: '2025-06-01T00:00:00.000Z'
        };

        const result = transformPostEditCard({ item });

        expect(result.updatedAt).toBe('2025-06-01T00:00:00.000Z');
    });

    it('defaults missing/nullish fields to the most conservative values', () => {
        const result = transformPostEditCard({ item: {} });

        expect(result.id).toBe('');
        expect(result.slug).toBe('');
        expect(result.title).toBe('');
        // Never default to a value that would read as "safe to show publicly".
        expect(result.moderationState).toBe('PENDING');
        expect(result.visibility).toBe('PRIVATE');
        expect(result.lifecycleState).toBe('DRAFT');
        expect(result.updatedAt).toBe('');
    });

    it('coerces non-string id/title values via String()', () => {
        // Record<string, unknown> already accepts any value shape, so no `any`
        // cast is needed to exercise the defensive String() coercion path.
        const item: Record<string, unknown> = {
            id: 123,
            title: null,
            moderationState: 'REJECTED',
            visibility: 'RESTRICTED',
            lifecycleState: 'ARCHIVED'
        };

        const result = transformPostEditCard({ item });

        expect(result.id).toBe('123');
        expect(result.title).toBe('');
    });
});

describe('transformPostEditCardList', () => {
    it('maps every item through transformPostEditCard', () => {
        const items = [
            {
                id: '1',
                slug: 'a',
                title: 'A',
                moderationState: 'PENDING',
                visibility: 'PRIVATE',
                lifecycleState: 'DRAFT'
            },
            {
                id: '2',
                slug: 'b',
                title: 'B',
                moderationState: 'APPROVED',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            }
        ];

        const result = transformPostEditCardList({ items });

        expect(result).toHaveLength(2);
        expect(result[0]?.id).toBe('1');
        expect(result[1]?.moderationState).toBe('APPROVED');
    });

    it('returns an empty array for an empty list', () => {
        expect(transformPostEditCardList({ items: [] })).toEqual([]);
    });
});

describe('transformEventEditCard', () => {
    it('transforms a complete raw event item, reading name (not title)', () => {
        const item = {
            id: 'event-uuid',
            slug: 'mi-evento',
            name: 'Mi evento',
            moderationState: 'REJECTED',
            visibility: 'RESTRICTED',
            lifecycleState: 'ARCHIVED',
            updatedAt: '2026-02-01T00:00:00.000Z'
        };

        const result = transformEventEditCard({ item });

        expect(result).toEqual({
            id: 'event-uuid',
            slug: 'mi-evento',
            name: 'Mi evento',
            moderationState: 'REJECTED',
            visibility: 'RESTRICTED',
            lifecycleState: 'ARCHIVED',
            updatedAt: '2026-02-01T00:00:00.000Z'
        });
    });

    it('falls back to createdAt when updatedAt is missing', () => {
        const item = {
            id: 'event-uuid',
            name: 'Mi evento',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE',
            createdAt: '2025-07-01T00:00:00.000Z'
        };

        const result = transformEventEditCard({ item });

        expect(result.updatedAt).toBe('2025-07-01T00:00:00.000Z');
    });

    it('defaults missing/nullish fields to the most conservative values', () => {
        const result = transformEventEditCard({ item: {} });

        expect(result.id).toBe('');
        expect(result.slug).toBe('');
        expect(result.name).toBe('');
        expect(result.moderationState).toBe('PENDING');
        expect(result.visibility).toBe('PRIVATE');
        expect(result.lifecycleState).toBe('DRAFT');
        expect(result.updatedAt).toBe('');
    });
});

describe('transformEventEditCardList', () => {
    it('maps every item through transformEventEditCard', () => {
        const items = [
            {
                id: '1',
                slug: 'a',
                name: 'A',
                moderationState: 'PENDING',
                visibility: 'PRIVATE',
                lifecycleState: 'DRAFT'
            },
            {
                id: '2',
                slug: 'b',
                name: 'B',
                moderationState: 'APPROVED',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            }
        ];

        const result = transformEventEditCardList({ items });

        expect(result).toHaveLength(2);
        expect(result[0]?.id).toBe('1');
        expect(result[1]?.moderationState).toBe('APPROVED');
    });

    it('returns an empty array for an empty list', () => {
        expect(transformEventEditCardList({ items: [] })).toEqual([]);
    });
});
