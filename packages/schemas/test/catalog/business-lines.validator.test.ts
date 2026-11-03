import { describe, expect, it } from 'vitest';
import {
    type BusinessLineRules,
    type BusinessLineValidationReason,
    normalizeBusinessLines,
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

it('normalizes writes to stable catalog order', () => {
    expect(
        normalizeBusinessLines({ vertical: 'venue', businessLines: ['nightlife', 'food'] })
    ).toEqual(['food', 'nightlife']);
});
