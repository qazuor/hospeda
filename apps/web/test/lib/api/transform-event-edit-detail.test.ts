/**
 * @file transform-event-edit-detail.test.ts
 * @description Unit tests for `transformEventEditDetail` (HOS-374 Phase 2
 * 2C-3), the raw `GET /protected/events/:id` → `EventEditDetail` mapping.
 *
 * The `date` sub-object is flattened here, and `precision` decides whether the
 * schedule fields are editable at all — so its fallback is load-bearing, not
 * cosmetic.
 */

import { describe, expect, it } from 'vitest';
import { transformEventEditDetail } from '../../../src/lib/api/transforms';

const RAW = {
    id: 'event-1',
    slug: 'una-fiesta',
    name: 'Una fiesta',
    description: 'Una descripción',
    category: 'MUSIC',
    date: {
        start: '2026-09-10T21:00:00.000Z',
        end: '2026-09-11T02:00:00.000Z',
        precision: 'EXACT'
    },
    organizer: { name: 'Club Social' },
    location: { name: 'Sala Mayo' },
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE'
};

describe('transformEventEditDetail', () => {
    it('flattens the date sub-object and maps the relations', () => {
        expect(transformEventEditDetail({ item: RAW })).toEqual({
            id: 'event-1',
            slug: 'una-fiesta',
            name: 'Una fiesta',
            description: 'Una descripción',
            category: 'MUSIC',
            startDate: '2026-09-10T21:00:00.000Z',
            endDate: '2026-09-11T02:00:00.000Z',
            datePrecision: 'EXACT',
            organizerName: 'Club Social',
            locationName: 'Sala Mayo',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });
    });

    it('reads MONTH precision through', () => {
        const result = transformEventEditDetail({
            item: { ...RAW, date: { ...RAW.date, precision: 'MONTH' } }
        });

        expect(result.datePrecision).toBe('MONTH');
    });

    it('falls back to EXACT when precision is absent', () => {
        const result = transformEventEditDetail({
            item: { ...RAW, date: { start: RAW.date.start } }
        });

        // Matches the schema's own default for every event that predates the
        // column (HOS-280) — and any other fallback would silently lock the
        // date fields of an ordinary event.
        expect(result.datePrecision).toBe('EXACT');
    });

    it('accepts Date instances as well as ISO strings', () => {
        const result = transformEventEditDetail({
            item: { ...RAW, date: { start: new Date('2026-09-10T21:00:00.000Z') } }
        });

        expect(result.startDate).toBe('2026-09-10T21:00:00.000Z');
    });

    it('maps a missing date, organizer and location to null', () => {
        const result = transformEventEditDetail({ item: { id: 'event-1' } });

        expect(result.startDate).toBeNull();
        expect(result.endDate).toBeNull();
        expect(result.organizerName).toBeNull();
        expect(result.locationName).toBeNull();
    });

    it('falls back to the most conservative state values when they are missing', () => {
        const result = transformEventEditDetail({ item: { id: 'event-1' } });

        expect(result.moderationState).toBe('PENDING');
        expect(result.visibility).toBe('PRIVATE');
        expect(result.lifecycleState).toBe('DRAFT');
    });
});
