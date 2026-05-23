/**
 * @file motion.test.ts
 * @description Unit tests for the motion tokens. Web-anchored values
 * verified byte-for-byte against the Phase 0 seed; doc 05 scale verified
 * against doc 05 §5.6.
 */

import { describe, expect, it } from 'vitest';

import { motion, motionDuration, motionEasing, webDuration, webEasing } from './motion.ts';

describe('motionDuration — doc 05 §5.6 reference scale', () => {
    it.each([
        ['fast', '150ms'],
        ['base', '200ms'],
        ['slow', '300ms'],
        ['slower', '500ms']
    ])('%s = %s', (key, expected) => {
        expect(motionDuration[key as keyof typeof motionDuration]).toBe(expected);
    });

    it('declares 4 durations', () => {
        expect(Object.keys(motionDuration)).toHaveLength(4);
    });
});

describe('motionEasing — doc 05 §5.6', () => {
    it.each([
        ['out', 'cubic-bezier(0.16, 1, 0.3, 1)'],
        ['inOut', 'cubic-bezier(0.65, 0, 0.35, 1)'],
        ['spring', 'cubic-bezier(0.34, 1.56, 0.64, 1)']
    ])('%s = %s', (key, expected) => {
        expect(motionEasing[key as keyof typeof motionEasing]).toBe(expected);
    });

    it('declares 3 easings', () => {
        expect(Object.keys(motionEasing)).toHaveLength(3);
    });
});

describe('webDuration — anchored to web seed byte-for-byte', () => {
    it.each([
        ['fast', '0.2s'],
        ['normal', '0.4s'],
        ['slow', '0.5s'],
        ['reveal', '450ms']
    ])('%s = %s', (key, expected) => {
        expect(webDuration[key as keyof typeof webDuration]).toBe(expected);
    });

    it('has DIFFERENT values for overlapping keys vs the doc 05 scale', () => {
        // Sanity check that the two scales are intentionally distinct —
        // a future refactor that "unifies" them would break web's pixel-diff.
        expect(webDuration.fast).not.toBe(motionDuration.fast);
        expect(webDuration.slow).not.toBe(motionDuration.slow);
    });
});

describe('webEasing — anchored to web seed byte-for-byte', () => {
    it.each([
        ['bounce', 'cubic-bezier(0.1, 0, 0.3, 1)'],
        ['reveal', 'cubic-bezier(0.22, 1, 0.36, 1)']
    ])('%s = %s', (key, expected) => {
        expect(webEasing[key as keyof typeof webEasing]).toBe(expected);
    });

    it('declares 2 web-specific easings', () => {
        expect(Object.keys(webEasing)).toHaveLength(2);
    });
});

describe('motion aggregate', () => {
    it('groups duration + easing + web', () => {
        expect(Object.keys(motion).sort()).toEqual(['duration', 'easing', 'web']);
    });

    it('groups web sub-namespaces by reference', () => {
        expect(motion.duration).toBe(motionDuration);
        expect(motion.easing).toBe(motionEasing);
        expect(motion.web.duration).toBe(webDuration);
        expect(motion.web.easing).toBe(webEasing);
    });
});
