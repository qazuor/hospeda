import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0174-hos-1810-backfill-location-keys.js';

const base = {
    ownerId: 'o1',
    destinationId: 'd1',
    publicationStatus: 'PUBLISHED',
    hasException: false
} as const;

describe('0174 backfill of location keys (HOS-1810)', () => {
    it('is required, additive and names the columns it needs', () => {
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.requiresColumns).toContainEqual({
            table: 'venues',
            column: 'location_key'
        });
        expect(migration.meta.requiresColumns).toContainEqual({
            table: 'accommodations',
            column: 'location_key'
        });
    });

    it('keys rows with a comparable address and counts the rest', () => {
        const plan = migration.planLocationKeys({
            occupied: new Set(),
            rows: [
                { ...base, id: 'a', location: { street: 'Av. San Martín', number: '10' } },
                { ...base, id: 'b', location: { street: 'Camino al arroyo', number: 's/n' } },
                { ...base, id: 'c', location: null },
                { ...base, id: 'd', location: { street: 'Mitre', number: '5', floor: '2' } }
            ]
        });
        expect(plan.keys.get('a')).toBe('av san martin|10|d1');
        expect(plan.keys.get('d')).toBe('mitre|5|d1|2|');
        expect(plan.keys.has('b')).toBe(false);
        expect(plan.keys.has('c')).toBe(false);
        expect(plan.withoutKey).toBe(2);
    });

    it('uses the same key as the services (the accent and prefix variants collapse)', () => {
        const plan = migration.planLocationKeys({
            occupied: new Set(),
            rows: [
                {
                    ...base,
                    id: 'x',
                    publicationStatus: 'DRAFT',
                    location: { street: 'AVENIDA SAN MARTIN', number: '10' }
                },
                {
                    ...base,
                    id: 'y',
                    publicationStatus: 'DRAFT',
                    location: { street: 'Av. San Martín', number: '10' }
                }
            ]
        });
        expect(plan.keys.get('x')).toBe(plan.keys.get('y'));
    });

    it('never gives a second PUBLISHED listing of one owner the same key (unique index)', () => {
        const plan = migration.planLocationKeys({
            occupied: new Set(),
            rows: [
                { ...base, id: 'first', location: { street: 'Mitre', number: '1' } },
                { ...base, id: 'second', location: { street: 'Mitre', number: '1' } },
                {
                    ...base,
                    id: 'draft',
                    publicationStatus: 'DRAFT',
                    location: { street: 'Mitre', number: '1' }
                },
                {
                    ...base,
                    id: 'other-owner',
                    ownerId: 'o2',
                    location: { street: 'Mitre', number: '1' }
                },
                {
                    ...base,
                    id: 'excepted',
                    hasException: true,
                    location: { street: 'Mitre', number: '1' }
                }
            ]
        });
        expect([...plan.keys.keys()].sort()).toEqual(['draft', 'excepted', 'first', 'other-owner']);
        expect(plan.skippedDuplicates).toEqual(['second']);
    });

    it('respects keys already held by existing published rows', () => {
        const plan = migration.planLocationKeys({
            occupied: new Set(['o1|mitre|1|d1']),
            rows: [{ ...base, id: 'late', location: { street: 'Mitre', number: '1' } }]
        });
        expect(plan.keys.size).toBe(0);
        expect(plan.skippedDuplicates).toEqual(['late']);
    });

    it('writes keys and reports what it did; a second run (no pending rows) writes nothing', async () => {
        const written: unknown[] = [];
        let call = 0;
        const db = {
            execute: async (query: unknown) => {
                call += 1;
                const text = JSON.stringify(query);
                if (text.includes('UPDATE')) {
                    written.push(query);
                    return { rows: [{ id: 'x' }] };
                }
                if (text.includes('location_key IS NULL')) {
                    return call <= 2
                        ? {
                              rows: [
                                  {
                                      id: 'a',
                                      owner_id: 'o1',
                                      destination_id: 'd1',
                                      location: { street: 'Mitre', number: '1' },
                                      publication_status: 'PUBLISHED',
                                      location_exception_at: null
                                  }
                              ]
                          }
                        : { rows: [] };
                }
                return { rows: [] };
            }
        };
        const result = await migration.up({ db } as never);
        expect(written.length).toBeGreaterThan(0);
        expect(result.counts?.written).toBeGreaterThan(0);

        written.length = 0;
        call = 100;
        const again = await migration.up({ db } as never);
        expect(written).toHaveLength(0);
        expect(again.counts?.written).toBe(0);
    });
});
