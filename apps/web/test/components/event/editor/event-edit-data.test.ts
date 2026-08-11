/**
 * @file event-edit-data.test.ts
 * @description Unit tests for the event editor's PATCH-diff contract and its
 * datetime-local formatting (HOS-374 Phase 2 2C-3).
 *
 * @module test/components/event/editor/event-edit-data
 */

import { describe, expect, it } from 'vitest';
import type { EventEditFormData } from '../../../../src/components/event/editor/event-edit-data';
import {
    buildEventEditFormData,
    buildEventPatchPayload,
    toDateTimeLocal
} from '../../../../src/components/event/editor/event-edit-data';
import type { EventEditDetail } from '../../../../src/lib/api/types';

const DETAIL: EventEditDetail = {
    id: 'event-1',
    slug: 'una-fiesta',
    name: 'Una fiesta',
    description: 'x'.repeat(120),
    category: 'MUSIC',
    startDate: '2026-09-10T21:00:00.000Z',
    endDate: '2026-09-11T02:00:00.000Z',
    datePrecision: 'EXACT',
    organizerName: 'Club Social',
    locationName: 'Sala Mayo',
    moderationState: 'PENDING',
    visibility: 'PRIVATE',
    lifecycleState: 'ACTIVE'
};

/** Builds a form state from the shared detail, overriding the given fields. */
function formData(overrides: Partial<EventEditFormData> = {}): EventEditFormData {
    return { ...buildEventEditFormData({ detail: DETAIL }), ...overrides };
}

describe('toDateTimeLocal', () => {
    it('formats an ISO timestamp using the LOCAL calendar fields', () => {
        // Not `toISOString().slice(0, 16)`: that converts to UTC first, so in
        // Argentina (UTC-3) a 21:00 event would render as 00:00 the next day.
        const iso = '2026-09-10T21:00:00.000Z';
        const local = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        const expected =
            `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}` +
            `T${pad(local.getHours())}:${pad(local.getMinutes())}`;

        expect(toDateTimeLocal(iso)).toBe(expected);
    });

    it('round-trips through the input value without shifting the instant', () => {
        const iso = '2026-09-10T21:00:00.000Z';

        expect(new Date(toDateTimeLocal(iso)).toISOString()).toBe(iso);
    });

    it('returns an empty string for null, undefined and unparseable input', () => {
        expect(toDateTimeLocal(null)).toBe('');
        expect(toDateTimeLocal(undefined)).toBe('');
        expect(toDateTimeLocal('not a date')).toBe('');
    });
});

describe('buildEventEditFormData', () => {
    it('seeds every editable field, with the dates as input values', () => {
        const data = buildEventEditFormData({ detail: DETAIL });

        expect(data.name).toBe('Una fiesta');
        expect(data.category).toBe('MUSIC');
        expect(data.startDate).toBe(toDateTimeLocal(DETAIL.startDate));
        expect(data.endDate).toBe(toDateTimeLocal(DETAIL.endDate));
    });

    it('maps a missing end date to the empty input value', () => {
        const data = buildEventEditFormData({ detail: { ...DETAIL, endDate: null } });

        expect(data.endDate).toBe('');
    });
});

describe('buildEventPatchPayload', () => {
    it('is empty when nothing changed', () => {
        const baseline = formData();

        expect(buildEventPatchPayload({ current: baseline, baseline })).toEqual({});
    });

    it('sends only the fields that changed', () => {
        const baseline = formData();
        const current = formData({ name: 'Otra fiesta' });

        expect(buildEventPatchPayload({ current, baseline })).toEqual({ name: 'Otra fiesta' });
    });

    it('sends the start date whenever EITHER bound changed', () => {
        const baseline = formData();
        const current = formData({ endDate: '2026-09-11T04:00' });

        const payload = buildEventPatchPayload({ current, baseline });

        // `httpToDomainEventUpdate` only emits a `date` object when `startDate`
        // is present, so an end-only payload is silently discarded — the same
        // trap the accommodation editor's latitude/longitude pair hit.
        expect(payload).toHaveProperty('startDate');
        expect(payload).toHaveProperty('endDate');
    });

    it('drops the end date from the payload when the author cleared it', () => {
        const baseline = formData();
        const current = formData({ endDate: '' });

        const payload = buildEventPatchPayload({ current, baseline });

        expect(payload).toHaveProperty('startDate');
        expect(payload).not.toHaveProperty('endDate');
    });

    it('emits ISO timestamps, not the raw input values', () => {
        const baseline = formData();
        const current = formData({ startDate: '2026-10-01T20:30' });

        const payload = buildEventPatchPayload({ current, baseline });

        expect(payload.startDate).toBe(new Date('2026-10-01T20:30').toISOString());
    });

    it('omits the dates entirely when the start was cleared', () => {
        // The orchestrator refuses this submit outright (a cleared start would
        // otherwise vanish from the diff and the old date would survive), so
        // the builder must not invent a `startDate` of its own here.
        const baseline = formData();
        const current = formData({ startDate: '' });

        expect(buildEventPatchPayload({ current, baseline })).toEqual({});
    });

    it('never emits a field the server update silently drops', () => {
        const baseline = formData();
        const current = formData({
            name: 'N',
            description: 'D',
            category: 'THEATER',
            startDate: '2026-10-01T20:30'
        });

        const payload = buildEventPatchPayload({ current, baseline });

        // `httpToDomainEventUpdate` maps none of these, so a field that looked
        // saved would persist nothing at all.
        for (const key of [
            'price',
            'currency',
            'capacity',
            'isVirtual',
            'isPrivate',
            'requiresRegistration',
            'registrationUrl'
        ]) {
            expect(payload).not.toHaveProperty(key);
        }
        // Publication state and curation never travel in the generic PATCH.
        expect(payload).not.toHaveProperty('visibility');
        expect(payload).not.toHaveProperty('moderationState');
        expect(payload).not.toHaveProperty('lifecycleState');
        expect(payload).not.toHaveProperty('isFeatured');
        expect(payload).not.toHaveProperty('slug');
        // `summary` is derived server-side from `description`.
        expect(payload).not.toHaveProperty('summary');
    });

    it('detects a revert against the resynced baseline, not the load-time values', () => {
        const saved = formData({ name: 'Nombre guardado' });
        const revertedToOriginal = formData();

        expect(buildEventPatchPayload({ current: revertedToOriginal, baseline: saved })).toEqual({
            name: 'Una fiesta'
        });
    });
});
