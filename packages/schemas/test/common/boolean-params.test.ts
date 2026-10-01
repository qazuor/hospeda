import { describe, expect, it } from 'vitest';
import {
    createBooleanQueryParam,
    createBooleanQueryParamWithDefault,
    httpBodyBoolean
} from '../../src/common/boolean-params.js';

describe('createBooleanQueryParam (HOS-410)', () => {
    const schema = createBooleanQueryParam('test flag');

    it('parses "true" to true', () => {
        expect(schema.parse('true')).toBe(true);
    });

    it('parses "false" to false, NOT true (the z.coerce.boolean bug)', () => {
        expect(schema.parse('false')).toBe(false);
    });

    it('keeps an absent parameter undefined', () => {
        expect(schema.parse(undefined)).toBeUndefined();
    });

    it.each([
        '',
        '1',
        '0',
        'yes',
        'no',
        'TRUE',
        'False',
        ' true'
    ])('rejects the ambiguous value %j', (value) => {
        expect(schema.safeParse(value).success).toBe(false);
    });
});

describe('createBooleanQueryParamWithDefault (HOS-410)', () => {
    const defaultsTrue = createBooleanQueryParamWithDefault('test flag', true);
    const defaultsFalse = createBooleanQueryParamWithDefault('test flag', false);

    it('applies the default only when the parameter is absent', () => {
        expect(defaultsTrue.parse(undefined)).toBe(true);
        expect(defaultsFalse.parse(undefined)).toBe(false);
    });

    it('lets an explicit "false" override a true default', () => {
        expect(defaultsTrue.parse('false')).toBe(false);
    });

    it('lets an explicit "true" override a false default', () => {
        expect(defaultsFalse.parse('true')).toBe(true);
    });

    it.each(['', '1', 'yes'])('rejects %j instead of falling back to the default', (value) => {
        expect(defaultsTrue.safeParse(value).success).toBe(false);
    });
});

describe('httpBodyBoolean (HOS-410)', () => {
    const schema = httpBodyBoolean();

    it.each([
        [true, true],
        [false, false],
        ['true', true],
        ['false', false]
    ])('parses %j to %j', (input, expected) => {
        expect(schema.parse(input)).toBe(expected);
    });

    it.each(['', '1', 'yes', 0, 1, null])('rejects %j', (value) => {
        expect(schema.safeParse(value).success).toBe(false);
    });
});

describe('idempotent re-parse of already-parsed booleans (HOS-410)', () => {
    it('lets real booleans through the query parsers', () => {
        expect(createBooleanQueryParam('x').parse(false)).toBe(false);
        expect(createBooleanQueryParam('x').parse(true)).toBe(true);
        expect(createBooleanQueryParamWithDefault('x', true).parse(false)).toBe(false);
    });
});
