import { describe, expect, it } from 'vitest';
import {
    type BusinessLineRules,
    type BusinessLineValidationReason,
    normalizeBusinessLines,
    resolveBusinessLineDefaults,
    resolveBusinessLineOptions,
    validateBusinessLines
} from '../../src/catalog/index.js';

const testRules = {
    vertical: 'venue',
    maxPerListing: 1,
    excludes: [['food', 'nightlife']],
    typeRules: {
        BAR: { allowed: ['food', 'nightlife'], preselect: ['food'] },
        HELADERIA: { allowed: ['food'], preselect: ['food'] }
    }
} as unknown as BusinessLineRules<'venue'>;

const validate = (businessLines: string[], type = 'BAR', rules?: BusinessLineRules<'venue'>) =>
    validateBusinessLines({ vertical: 'venue', type, businessLines, rules });
const options = (selected: string[], type = 'BAR', rules?: BusinessLineRules<'venue'>) =>
    resolveBusinessLineOptions({ vertical: 'venue', type, selected, rules });

describe('TEST:2.4:1 validateBusinessLines', () => {
    const cases: readonly {
        readonly lines: string[];
        readonly expected: BusinessLineValidationReason;
        readonly type?: string;
        readonly rules?: BusinessLineRules<'venue'>;
    }[] = [
        { lines: [], expected: 'EMPTY' },
        { lines: ['food', 'food'], expected: 'DUPLICATE' },
        { lines: ['standard'], expected: 'NOT_IN_VERTICAL' },
        { lines: ['nightlife'], expected: 'NOT_ALLOWED_FOR_TYPE', type: 'HELADERIA' },
        { lines: ['food', 'nightlife'], expected: 'MAX_EXCEEDED', rules: testRules },
        {
            lines: ['food', 'nightlife'],
            expected: 'EXCLUDED_PAIR',
            rules: { ...testRules, maxPerListing: undefined } as BusinessLineRules<'venue'>
        }
    ];
    it.each(cases)('returns $expected', ({ lines, expected, type, rules }) => {
        const result = validate(lines, type ?? 'BAR', rules);
        expect(result).toEqual({ ok: false, reason: expected });
    });

    it('returns EXCLUDED_PAIR when the test catalog excludes the selected pair', () => {
        const result = validate(['food', 'nightlife'], 'BAR', {
            ...testRules,
            maxPerListing: undefined
        } as BusinessLineRules<'venue'>);
        expect(result).toEqual({ ok: false, reason: 'EXCLUDED_PAIR' });
    });
});

describe('TEST:2.4:1 resolveBusinessLineOptions', () => {
    it('returns every vertical option in catalog order, with type, maximum and exclusion reasons', () => {
        const normal = options([], 'BAR');
        expect(normal.map(({ value }) => value)).toEqual(['food', 'nightlife']);
        expect(normal.every(({ selectable }) => selectable)).toBe(true);
        expect(options(['food', 'food']).map(({ value }) => value)).toEqual(['food', 'nightlife']);
        expect(options(['standard']).map(({ value }) => value)).toEqual(['food', 'nightlife']);
        expect(options([], 'HELADERIA')[1]).toMatchObject({
            value: 'nightlife',
            selectable: false,
            reason: 'NOT_ALLOWED_FOR_TYPE'
        });
        expect(options(['food'], 'BAR', testRules)[1]).toMatchObject({
            value: 'nightlife',
            selectable: false,
            reason: 'MAX_EXCEEDED'
        });
        expect(
            options(['nightlife'], 'BAR', {
                ...testRules,
                maxPerListing: undefined
            } as BusinessLineRules<'venue'>)[0]
        ).toMatchObject({
            value: 'food',
            selectable: false,
            reason: 'EXCLUDED_PAIR'
        });
    });
});

describe('TEST:5.6:1 resolveBusinessLineOptions selected flag', () => {
    it('marks the selected options and only those', () => {
        const options = resolveBusinessLineOptions({
            vertical: 'venue',
            type: 'BAR',
            selected: ['food']
        });

        expect(options.map(({ value, selected }) => ({ value, selected }))).toEqual([
            { value: 'food', selected: true },
            { value: 'nightlife', selected: false }
        ]);
    });

    it('marks nothing when the selection is empty', () => {
        expect(
            resolveBusinessLineOptions({ vertical: 'venue', type: 'BAR', selected: [] }).map(
                ({ selected }) => selected
            )
        ).toEqual([false, false]);
    });

    it('keeps a selected option flagged even when the type does not allow it', () => {
        const nightlife = resolveBusinessLineOptions({
            vertical: 'venue',
            type: 'HELADERIA',
            selected: ['nightlife']
        }).find(({ value }) => value === 'nightlife');

        expect(nightlife).toMatchObject({ selected: true, selectable: false });
    });
});

describe('TEST:5.7:1 resolveBusinessLineOptions removable', () => {
    it('does not let a BOLICHE remove its only allowed business line', () => {
        const options = resolveBusinessLineOptions({
            vertical: 'venue',
            type: 'BOLICHE',
            selected: ['nightlife']
        });

        expect(options.find(({ value }) => value === 'nightlife')).toMatchObject({
            selected: true,
            removable: false,
            removeReason: 'EMPTY'
        });
    });

    it('lets a BAR remove either of its two lines', () => {
        const options = resolveBusinessLineOptions({
            vertical: 'venue',
            type: 'BAR',
            selected: ['food', 'nightlife']
        });

        expect(options.map(({ value, removable }) => ({ value, removable }))).toEqual([
            { value: 'food', removable: true },
            { value: 'nightlife', removable: true }
        ]);
    });

    it('lets a RESTAURANT remove either of its two lines', () => {
        const options = resolveBusinessLineOptions({
            vertical: 'venue',
            type: 'RESTAURANT',
            selected: ['food', 'nightlife']
        });

        expect(options.every(({ removable }) => removable)).toBe(true);
    });
});

describe('TEST:5.6:1 resolveBusinessLineDefaults', () => {
    it('returns the BAR defaults', () => {
        expect(resolveBusinessLineDefaults({ vertical: 'venue', type: 'BAR' })).toEqual({
            preselect: ['food', 'nightlife'],
            fieldDefaults: {}
        });
    });

    it('returns the RESTAURANT defaults', () => {
        expect(resolveBusinessLineDefaults({ vertical: 'venue', type: 'RESTAURANT' })).toEqual({
            preselect: ['food'],
            fieldDefaults: {}
        });
    });

    it('returns the BOLICHE preselection and its minAge suggestion (DEC-FAC-050)', () => {
        expect(resolveBusinessLineDefaults({ vertical: 'venue', type: 'BOLICHE' })).toEqual({
            preselect: ['nightlife'],
            fieldDefaults: { policies: { minAge: 18 } }
        });
    });

    it('returns empty defaults for an unknown type', () => {
        expect(resolveBusinessLineDefaults({ vertical: 'venue', type: 'NOT_A_TYPE' })).toEqual({
            preselect: [],
            fieldDefaults: {}
        });
    });
});

it('normalizes writes to stable catalog order', () => {
    expect(
        normalizeBusinessLines({ vertical: 'venue', businessLines: ['nightlife', 'food'] })
    ).toEqual(['food', 'nightlife']);
});
