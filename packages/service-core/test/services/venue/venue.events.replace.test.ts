/**
 * venue.events.replace.test.ts
 *
 * Regression tests for HOS-2291: `replaceVenueEvents` must DIFF the submitted
 * agenda against the stored one instead of deleting everything and re-inserting
 * it, so an event keeps its id (and its `created_at`) across saves.
 *
 * The event model is an in-memory fake that behaves like the table: `create`
 * mints a fresh id, `update` is scoped by `{ id, venueId }`, `hardDelete` by
 * its filter. A "delete everything and recreate" implementation therefore
 * changes every id and turns the id assertions red.
 *
 * What these must catch, as mutations:
 *  - going back to delete-and-reinsert (ids change, `created_at` changes);
 *  - dropping the ownership check on ids (a foreign id would be updated or
 *    re-parented into this venue);
 *  - deleting rows the payload still mentions, or keeping rows it dropped.
 *
 * No live DB is touched.
 */

const store = new Map<string, Record<string, unknown>>();
let nextId = 1;
const calls: string[] = [];

const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => row[key] === value);

const mockEventModel = {
    findAll: vi.fn(async (where: Record<string, unknown>) => ({
        items: [...store.values()].filter((row) => matches(row, where)).map((row) => ({ ...row })),
        total: 0
    })),
    create: vi.fn(async (data: Record<string, unknown>) => {
        calls.push('create');
        const id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
        const row = { createdAt: new Date('2030-01-01T00:00:00Z'), ...data, id };
        store.set(id, row);
        return row;
    }),
    update: vi.fn(async (where: Record<string, unknown>, data: Record<string, unknown>) => {
        calls.push('update');
        const row = [...store.values()].find((r) => matches(r, where));
        if (!row) return null;
        Object.assign(row, data);
        return row;
    }),
    hardDelete: vi.fn(async (where: Record<string, unknown>) => {
        calls.push('delete');
        let count = 0;
        for (const [id, row] of [...store.entries()]) {
            if (matches(row, where)) {
                store.delete(id);
                count++;
            }
        }
        return count;
    })
};

const withTransactionSpy = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        VenueEventModel: vi.fn(function () {
            return mockEventModel;
        }),
        withTransaction: (fn: (tx: unknown) => Promise<unknown>) => withTransactionSpy(fn)
    };
});

vi.mock('../../../src/services/listing/listing-owner-act', () => ({
    recordListingSubEntityEdit: vi.fn(async () => undefined)
}));

vi.mock('../../../src/services/venue/venue.permissions', () => ({
    checkVenueCanEditFaqs: vi.fn()
}));

import { ServiceErrorCode, type VenueEventInput } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceVenueEvents } from '../../../src/services/venue/venue.events';
import type { Actor } from '../../../src/types';

const VENUE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_VENUE_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = { id: ACTOR_ID, role: 'USER', permissions: [] } as unknown as Actor;
const MODEL = {
    findById: vi.fn(async () => ({ id: VENUE_ID, ownerId: ACTOR_ID, deletedAt: null }))
} as unknown as Parameters<typeof replaceVenueEvents>[0];

const weekly = (title: string, extra: Record<string, unknown> = {}) => ({
    title,
    recurrence: 'weekly' as const,
    weekday: 4,
    startTime: '21:00',
    isActive: true,
    ...extra
});

const seed = (id: string, venueId: string, title: string, displayOrder: number) => {
    store.set(id, {
        id,
        venueId,
        title,
        description: null,
        recurrence: 'weekly',
        date: null,
        weekday: 4,
        startTime: '21:00:00',
        endTime: null,
        ticketUrl: null,
        isActive: true,
        displayOrder,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        createdById: ACTOR_ID,
        updatedById: ACTOR_ID
    });
};

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FOREIGN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('replaceVenueEvents: stable ids (HOS-2291)', () => {
    beforeEach(() => {
        store.clear();
        calls.length = 0;
        nextId = 1;
        vi.clearAllMocks();
    });

    it('keeps the id and created_at of an event saved with its id, and applies the edit', async () => {
        // Arrange
        seed(A, VENUE_ID, 'Jueves de jazz', 0);

        // Act
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Jueves de jazz y blues', { id: A })] }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.events).toHaveLength(1);
        expect(result.data?.events[0]?.id).toBe(A);
        expect(result.data?.events[0]?.title).toBe('Jueves de jazz y blues');
        expect(store.get(A)?.createdAt).toStrictEqual(new Date('2026-01-01T00:00:00Z'));
        expect(calls).toStrictEqual(['update']);
    });

    it('creates events without id, deletes the ones that are missing, and reorders by position', async () => {
        // Arrange
        seed(A, VENUE_ID, 'Uno', 0);
        seed(B, VENUE_ID, 'Dos', 1);

        // Act: B moves first, A is dropped, one new event is appended.
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Dos', { id: B }), weekly('Nuevo')] }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(store.has(A)).toBe(false);
        expect(store.get(B)?.displayOrder).toBe(0);
        const created = [...store.values()].find((row) => row.title === 'Nuevo');
        expect(created?.displayOrder).toBe(1);
        expect(created?.id).not.toBe(A);
        expect(result.data?.events.map((e) => e.title)).toStrictEqual(['Dos', 'Nuevo']);
    });

    it('an empty agenda still takes every event down', async () => {
        seed(A, VENUE_ID, 'Uno', 0);

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [] }
        });

        expect(result.error).toBeUndefined();
        expect(store.size).toBe(0);
    });

    it('answers NOT_FOUND for an id that belongs to ANOTHER venue and leaves it untouched', async () => {
        // Arrange
        seed(A, VENUE_ID, 'Mio', 0);
        seed(FOREIGN, OTHER_VENUE_ID, 'Ajeno', 0);

        // Act
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Secuestrado', { id: FOREIGN })] }
        });

        // Assert: nothing was updated, re-parented or deleted.
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(store.get(FOREIGN)).toMatchObject({ venueId: OTHER_VENUE_ID, title: 'Ajeno' });
        expect(store.get(A)?.title).toBe('Mio');
        expect(calls).toStrictEqual([]);
    });

    it('answers NOT_FOUND for an id that does not exist, writing nothing', async () => {
        seed(A, VENUE_ID, 'Mio', 0);

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Mio', { id: A }), weekly('Fantasma', { id: FOREIGN })] }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(calls).toStrictEqual([]);
        expect(store.get(A)?.title).toBe('Mio');
    });

    it('rejects the same id twice in one payload', async () => {
        seed(A, VENUE_ID, 'Mio', 0);

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Uno', { id: A }), weekly('Dos', { id: A })] }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(calls).toStrictEqual([]);
    });

    it('runs the whole diff inside ONE transaction', async () => {
        seed(A, VENUE_ID, 'Uno', 0);

        await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Uno', { id: A }), weekly('Dos')] }
        });

        expect(withTransactionSpy).toHaveBeenCalledTimes(1);
    });
});

describe('replaceVenueEvents: the ceiling counts non-past entries (HOS-2254)', () => {
    // 2026-11-17 12:00 in AR (UTC-3).
    const NOW = new Date('2026-11-17T15:00:00Z');

    beforeEach(() => {
        store.clear();
        calls.length = 0;
        nextId = 1;
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const oneOff = (title: string, date: string) => ({
        title,
        recurrence: 'once' as const,
        date,
        startTime: '21:00',
        endTime: '23:00',
        isActive: true
    });
    const many = (count: number, make: (index: number) => VenueEventInput): VenueEventInput[] =>
        Array.from({ length: count }, (_, index) => make(index));

    it('refuses a 31st non-past entry with 400 VALIDATION_ERROR and writes nothing', async () => {
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: many(31, (i) => weekly(`Semanal ${i}`)) }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toBe('zodError.venue.events.max');
        expect(calls).toStrictEqual([]);
    });

    const seedPast = (count: number): string[] =>
        Array.from({ length: count }, (_, i) => {
            const pastId = `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`;
            store.set(pastId, {
                id: pastId,
                venueId: VENUE_ID,
                title: `Pasado ${i}`,
                description: null,
                recurrence: 'once',
                date: '2026-10-01',
                weekday: null,
                startTime: '21:00:00',
                endTime: '23:00:00',
                isActive: true,
                displayOrder: i,
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z')
            });
            return pastId;
        });

    it('saves 30 non-past entries together with 25 EXISTING past ones re-sent with their id', async () => {
        const ids = seedPast(25);
        const events = [
            ...many(30, (i) => weekly(`Semanal ${i}`)),
            ...ids.map((pastId, i) => ({ ...oneOff(`Pasado ${i}`, '2026-10-01'), id: pastId }))
        ];

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events }
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.events).toHaveLength(55);
    });

    it('refuses a NEW past entry (no id): it would bypass the ceiling', async () => {
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [oneOff('Nuevo pasado', '2026-10-01')] }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(calls).toStrictEqual([]);
    });

    it('treats a past entry whose id the cron already deleted as gone, saving the rest', async () => {
        const vanished = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: {
                events: [weekly('Semanal'), { ...oneOff('Ya borrado', '2026-10-01'), id: vanished }]
            }
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.events.map((e) => e.title)).toEqual(['Semanal']);
        expect(store.has(vanished)).toBe(false);
    });

    it('still answers 404 for an unknown id of a NON-past entry (foreign ids are never accepted)', async () => {
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [{ ...weekly('Ajeno'), id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(calls).toStrictEqual([]);
    });

    it('answers with stable i18n keys: newPast and the live ceiling are distinct', async () => {
        const newPast = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [oneOff('Nuevo pasado', '2026-10-01')] }
        });
        expect(newPast.error?.message).toBe('zodError.venue.events.newPast');
    });

    it('refuses an unbounded number of past entries (hard cap on the document)', async () => {
        const ids = seedPast(101);
        const events = ids.map((pastId, i) => ({
            ...oneOff(`Pasado ${i}`, '2026-10-01'),
            id: pastId
        }));

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(calls).toStrictEqual([]);
    });

    it('counts a switched-off future entry against the ceiling', async () => {
        const events = [
            ...many(30, (i) => weekly(`Semanal ${i}`)),
            { ...oneOff('Apagado', '2026-12-01'), isActive: false }
        ];

        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});

describe('replaceVenueEvents: ticket link (HOS-2255)', () => {
    beforeEach(() => {
        store.clear();
        calls.length = 0;
        nextId = 1;
        vi.clearAllMocks();
    });

    it('persists the link on create and on update, and returns it', async () => {
        // Arrange
        seed(A, VENUE_ID, 'Uno', 0);
        const link = 'https://www.passline.com/e/x';

        // Act
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: {
                events: [
                    weekly('Uno', { id: A, ticketUrl: link }),
                    weekly('Dos', { ticketUrl: link })
                ]
            }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.events.map((e) => e.ticketUrl)).toStrictEqual([link, link]);
    });

    it('stores an empty or absent link as null', async () => {
        // Act
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Uno', { ticketUrl: '' }), weekly('Dos')] }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.events.map((e) => e.ticketUrl)).toStrictEqual([null, null]);
    });

    it('refuses an http link and writes nothing', async () => {
        // Act
        const result = await replaceVenueEvents(MODEL, ACTOR, {
            venueId: VENUE_ID,
            agenda: { events: [weekly('Uno', { ticketUrl: 'http://x.com/e' })] }
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(store.size).toBe(0);
    });
});
