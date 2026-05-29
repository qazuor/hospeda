/**
 * @file announcements.test.ts
 * @description Unit tests for the announcement display helpers
 * (SPEC-156 PR-4 T-041).
 */

import type { AnnouncementItem } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { filterActiveByDate, pickAnnouncementText } from '../../src/lib/announcements';

function makeItem(overrides: Partial<AnnouncementItem> = {}): AnnouncementItem {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        text: { es: 'Hola', en: 'Hello', pt: 'Olá' },
        variant: 'info',
        dismissible: true,
        ...overrides
    };
}

const NOW = new Date('2026-06-01T12:00:00.000Z');

describe('filterActiveByDate', () => {
    it('returns [] when input is empty', () => {
        expect(filterActiveByDate([], NOW)).toEqual([]);
    });

    it('keeps items with no startsAt and no endsAt (always on)', () => {
        const item = makeItem();
        expect(filterActiveByDate([item], NOW)).toEqual([item]);
    });

    it('keeps items whose startsAt is in the past + no endsAt', () => {
        const item = makeItem({ startsAt: '2026-01-01T00:00:00.000Z' });
        expect(filterActiveByDate([item], NOW)).toEqual([item]);
    });

    it('filters out items whose startsAt is still in the future', () => {
        const item = makeItem({ startsAt: '2026-07-01T00:00:00.000Z' });
        expect(filterActiveByDate([item], NOW)).toEqual([]);
    });

    it('filters out items whose endsAt is already in the past', () => {
        const item = makeItem({ endsAt: '2026-05-01T00:00:00.000Z' });
        expect(filterActiveByDate([item], NOW)).toEqual([]);
    });

    it('keeps items whose [startsAt, endsAt] window includes now', () => {
        const item = makeItem({
            startsAt: '2026-05-01T00:00:00.000Z',
            endsAt: '2026-07-01T00:00:00.000Z'
        });
        expect(filterActiveByDate([item], NOW)).toEqual([item]);
    });

    it('preserves input order across kept items', () => {
        const a = makeItem({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
        const b = makeItem({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
        const c = makeItem({
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            endsAt: '2020-01-01T00:00:00.000Z' // filtered out
        });
        expect(filterActiveByDate([a, c, b], NOW)).toEqual([a, b]);
    });
});

describe('pickAnnouncementText', () => {
    it('returns the requested locale when present', () => {
        const item = makeItem();
        expect(pickAnnouncementText(item, 'en')).toBe('Hello');
        expect(pickAnnouncementText(item, 'pt')).toBe('Olá');
    });

    it('returns Spanish for locale=es', () => {
        const item = makeItem();
        expect(pickAnnouncementText(item, 'es')).toBe('Hola');
    });

    it('falls back to Spanish when the requested locale is empty', () => {
        const item = makeItem({ text: { es: 'Hola', en: '', pt: 'Olá' } });
        expect(pickAnnouncementText(item, 'en')).toBe('Hola');
    });

    it('falls back through en when Spanish is empty', () => {
        const item = makeItem({ text: { es: '', en: 'Hello', pt: 'Olá' } });
        expect(pickAnnouncementText(item, 'es')).toBe('Hello');
    });

    it('returns the empty string only when every locale is blank', () => {
        const item = makeItem({ text: { es: '', en: '', pt: '' } });
        expect(pickAnnouncementText(item, 'es')).toBe('');
    });

    it('falls back to Spanish for an unrecognized locale code', () => {
        const item = makeItem();
        expect(pickAnnouncementText(item, 'fr')).toBe('Hola');
    });
});
