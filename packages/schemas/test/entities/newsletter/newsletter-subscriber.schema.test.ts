/**
 * @file newsletter-subscriber.schema.test.ts
 * @description Locks the wire shape of the per-content preferences schemas
 * introduced in feat/newsletter-polish. The preferences object is persisted
 * on `newsletter_subscribers.preferences` (JSONB), so silent drift in keys or
 * partial-vs-strict semantics would corrupt the campaign segmentation.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { UpdateNewsletterPreferencesInputSchema } from '../../../src/entities/newsletter/newsletter-subscriber.crud.schema.js';
import { NewsletterContentPreferencesSchema } from '../../../src/entities/newsletter/newsletter-subscriber.schema.js';

describe('NewsletterContentPreferencesSchema', () => {
    const allTrue = {
        offers: true,
        events: true,
        guides: true,
        productNews: true
    };

    it('accepts a complete all-true preferences object', () => {
        const parsed = NewsletterContentPreferencesSchema.parse(allTrue);
        expect(parsed).toEqual(allTrue);
    });

    it('accepts mixed boolean values', () => {
        const mixed = { offers: false, events: true, guides: false, productNews: true };
        expect(NewsletterContentPreferencesSchema.parse(mixed)).toEqual(mixed);
    });

    it('rejects payloads missing any key (DB contract requires all four)', () => {
        const { productNews: _omit, ...missingOne } = allTrue;
        expect(() => NewsletterContentPreferencesSchema.parse(missingOne)).toThrow(ZodError);
    });

    it('rejects non-boolean values', () => {
        expect(() =>
            NewsletterContentPreferencesSchema.parse({ ...allTrue, offers: 'yes' })
        ).toThrow(ZodError);
    });
});

describe('UpdateNewsletterPreferencesInputSchema', () => {
    it('accepts a single-key flip', () => {
        const parsed = UpdateNewsletterPreferencesInputSchema.parse({ offers: false });
        expect(parsed).toEqual({ offers: false });
    });

    it('accepts a multi-key partial', () => {
        const parsed = UpdateNewsletterPreferencesInputSchema.parse({
            offers: false,
            guides: true
        });
        expect(parsed).toEqual({ offers: false, guides: true });
    });

    it('rejects an empty body (at least one key required)', () => {
        expect(() => UpdateNewsletterPreferencesInputSchema.parse({})).toThrow(ZodError);
    });

    it('rejects unknown keys (.strict())', () => {
        expect(() =>
            UpdateNewsletterPreferencesInputSchema.parse({ offers: true, marketing: true })
        ).toThrow(ZodError);
    });

    it('rejects non-boolean values for known keys', () => {
        expect(() => UpdateNewsletterPreferencesInputSchema.parse({ offers: 1 })).toThrow(ZodError);
    });
});
