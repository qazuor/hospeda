import { describe, expect, it } from 'vitest';
import {
    isNoChangesToSaveError,
    NoChangesToSaveError,
    pickChangedFields
} from '../changed-fields.utils';

const reader =
    (source: Record<string, unknown>) =>
    (id: string): unknown =>
        source[id];

describe('pickChangedFields (HOS-1493)', () => {
    it('keeps only the fields whose value changed', () => {
        // Arrange
        const initial = { name: 'A', visibility: 'PUBLIC', description: 'old' };
        const current = { name: 'A', visibility: 'PUBLIC', description: 'new' };

        // Act
        const { changed } = pickChangedFields({
            fieldIds: ['name', 'visibility', 'description'],
            readCurrent: reader(current),
            readInitial: reader(initial)
        });

        // Assert
        expect(changed).toStrictEqual({ description: 'new' });
    });

    it('compares objects and arrays structurally, not by reference', () => {
        // Arrange
        const initial = { faqs: [{ q: 'a', tags: ['x'] }], seo: { title: 't' } };
        const current = { faqs: [{ q: 'a', tags: ['x'] }], seo: { title: 't', extra: undefined } };

        // Act
        const { changed } = pickChangedFields({
            fieldIds: ['faqs', 'seo'],
            readCurrent: reader(current),
            readInitial: reader(initial)
        });

        // Assert
        expect(changed).toStrictEqual({});
    });

    it('detects a reordered array and a changed date', () => {
        // Arrange
        const initial = { amenityIds: ['a', 'b'], startsAt: new Date('2026-10-01T00:00:00Z') };
        const current = { amenityIds: ['b', 'a'], startsAt: new Date('2026-10-02T00:00:00Z') };

        // Act
        const { changed } = pickChangedFields({
            fieldIds: ['amenityIds', 'startsAt'],
            readCurrent: reader(current),
            readInitial: reader(initial)
        });

        // Assert
        expect(Object.keys(changed)).toStrictEqual(['amenityIds', 'startsAt']);
    });

    it('treats equal dates as unchanged', () => {
        const { changed } = pickChangedFields({
            fieldIds: ['startsAt'],
            readCurrent: () => new Date('2026-10-01T00:00:00Z'),
            readInitial: () => new Date('2026-10-01T00:00:00Z')
        });
        expect(changed).toStrictEqual({});
    });

    it('sends the whole dot-notation group when one member changed, and never undefined', () => {
        // Arrange
        const initial = { 'location.city': 'Colón', 'location.state': 'ER', 'seo.title': 't' };
        const current = {
            'location.city': 'Paraná',
            'location.state': 'ER',
            'location.zip': undefined,
            'seo.title': 't'
        };

        // Act
        const { changed } = pickChangedFields({
            fieldIds: ['location.city', 'location.state', 'location.zip', 'seo.title'],
            readCurrent: reader(current),
            readInitial: reader(initial)
        });

        // Assert
        expect(changed).toStrictEqual({ 'location.city': 'Paraná', 'location.state': 'ER' });
    });

    it('flags a cleared value (initial set, now empty or null) as changed', () => {
        const { changed } = pickChangedFields({
            fieldIds: ['summary', 'website'],
            readCurrent: reader({ summary: '', website: null }),
            readInitial: reader({ summary: 'x', website: 'https://a.test' })
        });
        expect(changed).toStrictEqual({ summary: '', website: null });
    });
});

describe('NoChangesToSaveError', () => {
    it('is recognised by its guard and nothing else is', () => {
        expect(isNoChangesToSaveError(new NoChangesToSaveError())).toBe(true);
        expect(isNoChangesToSaveError(new Error('No changes to save'))).toBe(false);
    });
});
