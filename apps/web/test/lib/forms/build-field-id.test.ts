/**
 * @file build-field-id.test.ts
 * @description Tests for the single source of form-field DOM ids (HOS-385).
 *
 * These matter more than their size suggests: this function is what makes the
 * render site and the focus site agree, so its output IS the contract that
 * replaced the deleted `field-input-id-contract` guard.
 */

import { describe, expect, it } from 'vitest';
import { buildFieldId } from '@/lib/forms/build-field-id';

describe('buildFieldId', () => {
    it('should join the prefix and the Zod key with a hyphen', () => {
        expect(buildFieldId({ prefix: 'acc', name: 'facebook' })).toBe('acc-facebook');
    });

    it('should append the suffix when one control of several is targeted', () => {
        // `phone` is one Zod key rendered as a country combobox plus a number
        // input; focus belongs on the number.
        expect(buildFieldId({ prefix: 'acc', name: 'phone', suffix: 'number' })).toBe(
            'acc-phone-number'
        );
    });

    it('should omit the trailing hyphen when no suffix is given', () => {
        expect(buildFieldId({ prefix: 'ce', name: 'menuUrl' })).not.toMatch(/-$/);
    });

    it('should normalise dots in a nested path to hyphens', () => {
        // An id containing `.` is legal HTML but `querySelector('#a.b')` reads
        // the dot as a class selector, so nested paths must not keep it.
        expect(buildFieldId({ prefix: 'ce', name: 'contactInfo.workEmail' })).toBe(
            'ce-contactInfo-workEmail'
        );
    });

    it('should normalise every dot in a deeply nested path', () => {
        expect(buildFieldId({ prefix: 'ce', name: 'a.b.c' })).toBe('ce-a-b-c');
    });

    it('should produce an id usable with querySelector', () => {
        // The whole reason dots are normalised: this must not throw.
        const id = buildFieldId({ prefix: 'ce', name: 'contactInfo.mobilePhone' });
        expect(() => document.querySelector(`#${id}`)).not.toThrow();
    });

    it('should be deterministic — same inputs, same id', () => {
        // The render site and the focus site call this separately and must
        // agree; if it were ever non-deterministic, focus would silently miss.
        const params = { prefix: 'acc', name: 'destinationId' } as const;
        expect(buildFieldId(params)).toBe(buildFieldId(params));
    });

    it('should give different Zod keys different ids', () => {
        // Guards against a collision quietly pointing two fields at one element.
        const a = buildFieldId({ prefix: 'acc', name: 'phone' });
        const b = buildFieldId({ prefix: 'acc', name: 'whatsapp' });
        expect(a).not.toBe(b);
    });

    it('should namespace the two editors apart', () => {
        // Both editors can render a `name` field; ids must not collide if a
        // page ever mounted both.
        expect(buildFieldId({ prefix: 'acc', name: 'name' })).not.toBe(
            buildFieldId({ prefix: 'ce', name: 'name' })
        );
    });
});
