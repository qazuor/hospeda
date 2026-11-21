/**
 * Tests for the kit gallery gate (HOS-2413 T-029, OD-6).
 */

import { describe, expect, it } from 'vitest';
import { serverEnvBaseSchema } from '../../src/env-schema';

const parse = (value?: string) =>
    serverEnvBaseSchema.parse(value === undefined ? {} : { HOSPEDA_ACCOUNT_KIT_GALLERY: value })
        .HOSPEDA_ACCOUNT_KIT_GALLERY;

describe('HOSPEDA_ACCOUNT_KIT_GALLERY', () => {
    it('defaults to false when unset, so staging and production answer 404', () => {
        expect(parse()).toBe(false);
    });

    it("accepts the literal 'true' as true", () => {
        expect(parse('true')).toBe(true);
    });

    it("keeps 'false' false (the string must never be truthy)", () => {
        expect(parse('false')).toBe(false);
    });

    it('treats anything else as off', () => {
        expect(parse('1')).toBe(false);
        expect(parse('TRUE')).toBe(false);
        expect(parse('')).toBe(false);
    });
});
