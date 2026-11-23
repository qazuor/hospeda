import { describe, expect, it } from 'vitest';
import en from '../../src/locales/en/accommodations.json';
import es from '../../src/locales/es/accommodations.json';
import pt from '../../src/locales/pt/accommodations.json';

function structure(group: unknown): unknown {
    if (typeof group === 'string') {
        expect(group.trim()).not.toBe('');
        return [...group.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
    }
    if (!group || typeof group !== 'object')
        throw new Error('Missing listing contact translations');
    return Object.fromEntries(Object.entries(group).map(([key, value]) => [key, structure(value)]));
}

describe('listingContact copy', () => {
    it('keeps group and interpolation parity across es, en and pt', () => {
        const spanish = structure(es.detail.listingContact);

        expect(spanish).toMatchObject({
            bar: { inquire: [], contact: [], viewMenu: [], priceOnRequest: [] },
            panel: {
                title: ['name'],
                shortcuts: { whatsapp: [], phone: [], email: [] },
                trust: []
            },
            fields: { checkIn: [], checkOut: [], guests: [] },
            errors: {
                checkOutAfterCheckIn: [],
                invalidDate: [],
                guestsRange: ['capacity'],
                guestsCapacityUnavailable: []
            },
            inquiry: {
                dates: ['checkIn', 'checkOut'],
                guests_one: ['count'],
                guests_other: ['count']
            },
            summary: { title: [] },
            units: { perNight: [], perDay: [], perHour: [], perPerson: [], perGroup: [] }
        });
        expect(structure(en.detail.listingContact)).toEqual(spanish);
        expect(structure(pt.detail.listingContact)).toEqual(spanish);
    });
});
