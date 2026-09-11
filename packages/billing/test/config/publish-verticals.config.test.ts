/**
 * @file publish-verticals.config.test.ts
 * @description Unit tests for the publish-vertical → limit-key resolver
 * (HOS-1156 T-005).
 *
 * Every expectation below names its LimitKey LITERALLY. Asserting against a
 * spread of the constant under test — `expect(map).toEqual({ ...SOURCE })` — is
 * vacuous: it passes for whatever the constant happens to hold, including a
 * wrong value, because both sides move together.
 */

import { describe, expect, it } from 'vitest';
import {
    isCommercePublishVertical,
    LIMIT_KEY_BY_PUBLISH_VERTICAL,
    parsePublishVertical
} from '../../src/config/publish-verticals.config.js';
import { LimitKey } from '../../src/types/plan.types.js';

describe('LIMIT_KEY_BY_PUBLISH_VERTICAL', () => {
    it('caps accommodation with max_accommodations', () => {
        expect(LIMIT_KEY_BY_PUBLISH_VERTICAL.accommodation).toBe(LimitKey.MAX_ACCOMMODATIONS);
    });

    it('caps gastronomy with max_gastronomies', () => {
        expect(LIMIT_KEY_BY_PUBLISH_VERTICAL.gastronomy).toBe(LimitKey.MAX_GASTRONOMIES);
    });

    it('caps experience with max_experiences', () => {
        expect(LIMIT_KEY_BY_PUBLISH_VERTICAL.experience).toBe(LimitKey.MAX_EXPERIENCES);
    });

    it('covers exactly the three publish verticals and nothing else', () => {
        // A fourth key here means somebody widened the union without deciding
        // what caps it; a missing one means a vertical resolves to `undefined`,
        // which every layer beneath reads as "unlimited".
        expect(Object.keys(LIMIT_KEY_BY_PUBLISH_VERTICAL).sort()).toEqual([
            'accommodation',
            'experience',
            'gastronomy'
        ]);
    });

    it('gives every vertical a distinct cap', () => {
        // Two verticals sharing a LimitKey would pool their caps — the exact
        // thing HOS-688 §6.8 refused. AC-10 depends on this being false.
        const keys = Object.values(LIMIT_KEY_BY_PUBLISH_VERTICAL);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('isCommercePublishVertical', () => {
    it('accepts the two commerce verticals', () => {
        expect(isCommercePublishVertical('gastronomy')).toBe(true);
        expect(isCommercePublishVertical('experience')).toBe(true);
    });

    it('rejects accommodation', () => {
        expect(isCommercePublishVertical('accommodation')).toBe(false);
    });
});

describe('parsePublishVertical', () => {
    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('narrows %s unchanged', (value) => {
        expect(parsePublishVertical(value, 'test')).toBe(value);
    });

    it('throws for an unknown vertical, naming the caller and the value', () => {
        expect(() => parsePublishVertical('partner', 'precheck route')).toThrow(
            "precheck route: unsupported publish vertical 'partner'"
        );
    });

    it('throws for the empty string', () => {
        expect(() => parsePublishVertical('', 'test')).toThrow();
    });

    it.each([
        'toString',
        'constructor',
        'valueOf',
        '__proto__',
        'hasOwnProperty'
    ])('rejects the inherited property %s', (inherited) => {
        // The value reaching this function comes from a URL path param. Had
        // the membership test been written with `in` instead of
        // `Object.hasOwn`, every one of these would have been accepted as a
        // valid vertical and then indexed the map to `undefined` — read as
        // "no cap" by every layer beneath.
        expect(() => parsePublishVertical(inherited, 'test')).toThrow(
            `test: unsupported publish vertical '${inherited}'`
        );
    });
});
