/**
 * Regression tests for HOS-1262 — clearing a `socialNetworks` key must be
 * expressible, on the way in AND on the way out.
 *
 * `socialNetworks` is now a MERGEABLE JSONB column on every model that owns one
 * (accommodation, experience, gastronomy, partner, postSponsor, user,
 * eventOrganizer). Merge semantics invert how a key is CLEARED: an omitted key
 * means "leave it alone", so deleting a link is an explicit `null` — exactly the
 * contract `contactInfo` adopted in HOS-375. Before this change every key was
 * `.optional()` but not `.nullable()`, so a cleared link could not be expressed
 * at all: `null` was rejected by Zod and `''` failed the URL regex. That was the
 * reason `PartnerModel` refused the merge, and the same dead-end sat unnoticed on
 * accommodation (whose flat HTTP fields rejected both).
 *
 * Widening `string | undefined` to `string | null | undefined` is ADDITIVE, so
 * no payload that validated before stops validating; the non-null bounds are
 * untouched, which the second block pins.
 *
 * @module test/common/social-clearable.hos1262
 */
import { describe, expect, it } from 'vitest';
import { SocialNetworkReadSchema, SocialNetworkSchema } from '../../src/common/social.schema.js';
import {
    AccommodationUpdateHttpSchema,
    httpToDomainAccommodationUpdate
} from '../../src/entities/accommodation/accommodation.http.schema.js';
import {
    EventOrganizerUpdateHttpSchema,
    httpToDomainEventOrganizerUpdate
} from '../../src/entities/eventOrganizer/eventOrganizer.http.schema.js';
import { GastronomyUpdateHttpSchema } from '../../src/entities/gastronomy/gastronomy.http.schema.js';

/** Every key of the shared social JSONB value. */
const SOCIAL_FIELDS = [
    'facebook',
    'instagram',
    'twitter',
    'linkedIn',
    'tiktok',
    'youtube'
] as const;

describe('SocialNetworkSchema (WRITE) — an explicit null clears a key', () => {
    for (const field of SOCIAL_FIELDS) {
        it(`accepts \`${field}: null\``, () => {
            expect(SocialNetworkSchema.safeParse({ [field]: null }).success).toBe(true);
        });
    }

    it('accepts a null on every key at once', () => {
        const allNull = Object.fromEntries(SOCIAL_FIELDS.map((f) => [f, null]));

        expect(SocialNetworkSchema.safeParse(allNull).success).toBe(true);
    });

    it('accepts a null next to a valid link', () => {
        const result = SocialNetworkSchema.safeParse({
            facebook: null,
            instagram: 'https://instagram.com/acme'
        });

        expect(result.success).toBe(true);
    });
});

describe('SocialNetworkSchema — the non-null bounds are unchanged', () => {
    it('still rejects the empty string, so `null` is the only way to clear', () => {
        expect(SocialNetworkSchema.safeParse({ facebook: '' }).success).toBe(false);
    });

    it('still rejects a value that is not a URL', () => {
        expect(SocialNetworkSchema.safeParse({ facebook: 'not-a-url' }).success).toBe(false);
    });

    it('still rejects a URL of the wrong platform', () => {
        expect(SocialNetworkSchema.safeParse({ facebook: 'https://example.com/x' }).success).toBe(
            false
        );
    });
});

describe('SocialNetworkReadSchema (READ) — a stored JSON null must not 500 the GET', () => {
    // The stored `null` is what comes BACK on every later read, and the API
    // strips responses against the declared schema, FAIL-CLOSING to HTTP 500.
    it('accepts a null on every key', () => {
        const allNull = Object.fromEntries(SOCIAL_FIELDS.map((f) => [f, null]));

        expect(SocialNetworkReadSchema.safeParse(allNull).success).toBe(true);
    });

    it('keeps the null in the parsed value instead of dropping it', () => {
        expect(SocialNetworkReadSchema.parse({ facebook: null })).toStrictEqual({ facebook: null });
    });
});

describe('flat HTTP social fields accept null (accommodation, gastronomy, event organizer)', () => {
    it('accommodation update accepts `facebook: null` and rejects `""`', () => {
        expect(AccommodationUpdateHttpSchema.safeParse({ facebook: null }).success).toBe(true);
        expect(AccommodationUpdateHttpSchema.safeParse({ facebook: '' }).success).toBe(false);
    });

    it('gastronomy update accepts `instagram: null`', () => {
        expect(GastronomyUpdateHttpSchema.safeParse({ instagram: null }).success).toBe(true);
    });

    it('event organizer update accepts `twitter: null`', () => {
        expect(EventOrganizerUpdateHttpSchema.safeParse({ twitter: null }).success).toBe(true);
    });
});

describe('httpToDomain*Update carries a null through as a per-key clear', () => {
    it('accommodation: `facebook: null` becomes `socialNetworks: { facebook: null }` alone', () => {
        const domain = httpToDomainAccommodationUpdate({ facebook: null });

        expect(domain.socialNetworks).toStrictEqual({ facebook: null });
    });

    it('event organizer: emits ONLY the sent keys, so a merge keeps the rest', () => {
        const domain = httpToDomainEventOrganizerUpdate({ instagram: 'https://instagram.com/org' });

        expect(domain.socialNetworks).toStrictEqual({ instagram: 'https://instagram.com/org' });
    });

    it('event organizer: a null is NOT dropped by the presence check', () => {
        // The old check was truthiness (`a || b || c`), which discards `null`
        // and would have made a clear impossible even after the schema accepted it.
        const domain = httpToDomainEventOrganizerUpdate({ linkedin: null });

        expect(domain.socialNetworks).toStrictEqual({ linkedIn: null });
    });

    it('event organizer: emits no socialNetworks when no social key was sent', () => {
        expect(httpToDomainEventOrganizerUpdate({ name: 'Org' }).socialNetworks).toBeUndefined();
    });
});
