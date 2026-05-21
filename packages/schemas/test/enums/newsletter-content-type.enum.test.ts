/**
 * @file newsletter-content-type.enum.test.ts
 * @description Locks the wire values and default preferences shape for
 * `NewsletterContentTypeEnum`. The enum values are stored as JSONB keys on
 * `newsletter_subscribers.preferences` AND are persisted into
 * `newsletter_campaigns.contentType`, so any drift is a breaking change.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DEFAULT_NEWSLETTER_PREFERENCES,
    NewsletterContentTypeEnum,
    NewsletterContentTypeEnumSchema
} from '../../src/enums/index.js';

describe('NewsletterContentTypeEnum', () => {
    it('locks the exact set of wire values (additive-only changes from here on)', () => {
        expect(Object.values(NewsletterContentTypeEnum).sort()).toEqual(
            ['events', 'guides', 'offers', 'productNews'].sort()
        );
    });

    it('exposes the four members under stable TS-side keys', () => {
        expect(NewsletterContentTypeEnum.OFFERS).toBe('offers');
        expect(NewsletterContentTypeEnum.EVENTS).toBe('events');
        expect(NewsletterContentTypeEnum.GUIDES).toBe('guides');
        expect(NewsletterContentTypeEnum.PRODUCT_NEWS).toBe('productNews');
    });
});

describe('NewsletterContentTypeEnumSchema', () => {
    it('accepts every enum value', () => {
        for (const value of Object.values(NewsletterContentTypeEnum)) {
            expect(() => NewsletterContentTypeEnumSchema.parse(value)).not.toThrow();
        }
    });

    it('rejects anything outside the enum', () => {
        const invalid = ['OFFERS', 'product_news', '', null, undefined, 0, 'unknown'];
        for (const value of invalid) {
            expect(() => NewsletterContentTypeEnumSchema.parse(value)).toThrow(ZodError);
        }
    });
});

describe('DEFAULT_NEWSLETTER_PREFERENCES', () => {
    it('opts every content type IN by default', () => {
        for (const value of Object.values(NewsletterContentTypeEnum)) {
            expect(DEFAULT_NEWSLETTER_PREFERENCES[value]).toBe(true);
        }
    });

    it('contains exactly the enum keys (no stale or extra entries)', () => {
        expect(Object.keys(DEFAULT_NEWSLETTER_PREFERENCES).sort()).toEqual(
            Object.values(NewsletterContentTypeEnum).sort()
        );
    });
});
