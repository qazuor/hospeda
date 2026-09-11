/**
 * HOS-1283 — pure-function coverage for the vertical-copy resolvers.
 *
 * The template and end-to-end tests elsewhere already prove the RENDERED
 * effect; this file pins the resolvers' own contract in isolation, notably
 * the fail-open convention (`null`/`undefined`/unrecognized → accommodation).
 *
 * @module test/utils/product-domain-copy
 */

import { describe, expect, it } from 'vitest';
import {
    resolveRenewalReminderFooter,
    resolveTrialSeriesCopy
} from '../../src/utils/product-domain-copy.js';

describe('resolveTrialSeriesCopy (HOS-1283)', () => {
    it('resolves gastronomy copy', () => {
        const copy = resolveTrialSeriesCopy('gastronomy');
        expect(copy.possessive).toBe('tu local');
        expect(copy.searchIntent).toBe('dónde comer');
    });

    it('resolves experience copy', () => {
        const copy = resolveTrialSeriesCopy('experience');
        expect(copy.possessive).toBe('tu experiencia');
    });

    it('fails open to accommodation for accommodation itself, null, undefined and an unrecognized value', () => {
        const accommodation = resolveTrialSeriesCopy('accommodation');
        expect(resolveTrialSeriesCopy(null)).toEqual(accommodation);
        expect(resolveTrialSeriesCopy(undefined)).toEqual(accommodation);
        expect(resolveTrialSeriesCopy('tourist')).toEqual(accommodation);
        expect(resolveTrialSeriesCopy('partner')).toEqual(accommodation);
        expect(resolveTrialSeriesCopy('addon')).toEqual(accommodation);
        expect(resolveTrialSeriesCopy('not-a-real-domain')).toEqual(accommodation);
    });

    it('gastronomy and experience copy differ from accommodation in every field', () => {
        // Guards against a resolver that "branches" but returns the same
        // object for every case — every field must actually change.
        const accommodation = resolveTrialSeriesCopy('accommodation');
        const gastronomy = resolveTrialSeriesCopy('gastronomy');
        const experience = resolveTrialSeriesCopy('experience');

        for (const key of Object.keys(accommodation) as (keyof typeof accommodation)[]) {
            expect(gastronomy[key], `gastronomy.${key}`).not.toBe(accommodation[key]);
            expect(experience[key], `experience.${key}`).not.toBe(accommodation[key]);
        }
    });
});

describe('resolveRenewalReminderFooter (HOS-1283)', () => {
    it('has a distinct sentence per business vertical', () => {
        const sentences = [
            resolveRenewalReminderFooter('accommodation'),
            resolveRenewalReminderFooter('gastronomy'),
            resolveRenewalReminderFooter('experience'),
            resolveRenewalReminderFooter('tourist'),
            resolveRenewalReminderFooter('partner')
        ];
        expect(new Set(sentences).size).toBe(sentences.length);
    });

    it('fails open to the accommodation sentence for null, undefined and an unrecognized value', () => {
        const accommodation = resolveRenewalReminderFooter('accommodation');
        expect(resolveRenewalReminderFooter(null)).toBe(accommodation);
        expect(resolveRenewalReminderFooter(undefined)).toBe(accommodation);
        expect(resolveRenewalReminderFooter('addon')).toBe(accommodation);
    });
});
