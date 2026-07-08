/**
 * @file env-boolean-and-format.test.ts
 * @description HOS-105 — regression tests for the boolean env parsing footgun
 * fix (`=false` must parse to `false`, not `true`) and the env-aware console
 * log-format resolution.
 */

import { describe, expect, it } from 'vitest';
import { boolEnv } from '../../src/utils/env-schema';
import { resolveLogFormat } from '../../src/utils/resolve-log-format';

describe('boolEnv (string→boolean env parser)', () => {
    it("parses the literal 'false' as false (the z.coerce.boolean footgun)", () => {
        expect(boolEnv(true).parse('false')).toBe(false);
    });

    it("parses the literal 'true' as true", () => {
        expect(boolEnv(false).parse('true')).toBe(true);
    });

    it('is case-insensitive on the literal', () => {
        expect(boolEnv(false).parse('TRUE')).toBe(true);
        expect(boolEnv(true).parse('FALSE')).toBe(false);
    });

    it('treats other truthy-looking strings as false', () => {
        // The old z.coerce.boolean() turned every one of these into true.
        expect(boolEnv(true).parse('0')).toBe(false);
        expect(boolEnv(true).parse('no')).toBe(false);
        expect(boolEnv(true).parse('yes')).toBe(false);
        expect(boolEnv(true).parse('')).toBe(false);
    });

    it('falls back to the default when unset', () => {
        expect(boolEnv(true).parse(undefined)).toBe(true);
        expect(boolEnv(false).parse(undefined)).toBe(false);
    });
});

describe('resolveLogFormat (console format resolution)', () => {
    it('uses an explicit value regardless of environment', () => {
        expect(resolveLogFormat({ explicit: 'pretty', nodeEnv: 'production' })).toBe('pretty');
        expect(resolveLogFormat({ explicit: 'json', nodeEnv: 'development' })).toBe('json');
    });

    it('defaults to json in production when unset', () => {
        expect(resolveLogFormat({ explicit: undefined, nodeEnv: 'production' })).toBe('json');
    });

    it('defaults to pretty in development and test when unset', () => {
        expect(resolveLogFormat({ explicit: undefined, nodeEnv: 'development' })).toBe('pretty');
        expect(resolveLogFormat({ explicit: undefined, nodeEnv: 'test' })).toBe('pretty');
    });
});
