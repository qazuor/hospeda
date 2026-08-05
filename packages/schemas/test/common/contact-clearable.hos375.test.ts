/**
 * Regression tests for HOS-375 — clearing a `contactInfo` key must be
 * expressible, on the way in AND on the way out.
 *
 * `users.contactInfo` is a MERGEABLE JSONB column
 * (`UserModel.mergeableJsonbColumns`), which is what stops the web profile form
 * and the mobile `use-patch-user` hook — both of which send exactly
 * `{ mobilePhone }` — from deleting the other eight keys of the column. Among
 * those is `website`, which the web edit page reads back as the fallback for the
 * profile website field, so under replacement semantics a phone save destroyed a
 * value the next page load tried to display.
 *
 * Merge semantics invert how a key is CLEARED: an omitted key now means "leave
 * it alone", so deleting a value is an explicit `null`. Two schemas must accept
 * that null or the whole fix is inert:
 *
 *  - {@link ContactInfoSchema} (WRITE) — a rejection here 400s every "I deleted
 *    my phone" save, leaving the key permanently un-clearable.
 *  - {@link ContactInfoReadSchema} (READ) — the stored JSON null is what comes
 *    BACK on every later read, and the access family is applied by
 *    `stripWithSchema`, which FAIL-CLOSES to HTTP 500. A rejection here turns
 *    "this user once cleared their phone" into a permanent 500 on their own
 *    profile GET, locking them out of editing every other field.
 *
 * The bounds themselves are untouched: widening by `null` is ADDITIVE
 * (schema-compat policy), and a NON-null value is still validated exactly as
 * before — which the second block pins so this never degrades into
 * "contactInfo accepts anything".
 *
 * ACCOMMODATION is covered by its own block below. Six of the seven entities
 * that expose `contactInfo` on a read schema import the shared
 * {@link ContactInfoReadSchema}; accommodation is the ONE that keeps a local
 * read overlay (`AccommodationContactInfoReadSchema`, module-private in
 * `accommodation.access.schema.ts`), so widening the shared schema left it
 * behind — write accepted the null, read still fail-closed on it.
 *
 * @module test/common/contact-clearable.hos375
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ContactInfoReadSchema, ContactInfoSchema } from '../../src/common/contact.schema.js';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema
} from '../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationUpdateInputSchema } from '../../src/entities/accommodation/accommodation.crud.schema.js';
import { UserSelfSchema } from '../../src/entities/user/user.access.schema.js';
import { UserUpdateInputSchema } from '../../src/entities/user/user.crud.schema.js';

/** Every key of the shared contact JSONB value. */
const CONTACT_FIELDS = [
    'personalEmail',
    'workEmail',
    'homePhone',
    'workPhone',
    'mobilePhone',
    'whatsapp',
    'website',
    'preferredEmail',
    'preferredPhone'
] as const;

describe('ContactInfoSchema (WRITE) — an explicit null clears a key', () => {
    for (const field of CONTACT_FIELDS) {
        it(`accepts \`${field}: null\``, () => {
            const result = ContactInfoSchema.safeParse({ [field]: null });
            expect(result.success).toBe(true);
        });
    }

    it('accepts a null on every key at once', () => {
        const allNull = Object.fromEntries(CONTACT_FIELDS.map((f) => [f, null]));
        const result = ContactInfoSchema.safeParse(allNull);
        expect(result.success).toBe(true);
    });

    it('survives the whole update-input path the API validates against', () => {
        // `UserUpdateInputSchema` (= the protected/admin PATCH body) embeds this
        // shape. A null rejected here never reaches the model, so the merge
        // column would be un-clearable no matter what the DB layer does. This is
        // the EXACT payload the web profile form now sends on a cleared phone.
        const result = UserUpdateInputSchema.safeParse({ contactInfo: { mobilePhone: null } });
        expect(result.success).toBe(true);
    });
});

describe('ContactInfoSchema (WRITE) — the bounds are NOT relaxed by the null', () => {
    it('still rejects a malformed mobilePhone', () => {
        // Non-vacuity for the block above: `.nullish()` must widen each field by
        // exactly one value, not turn it into `z.any()`.
        const result = ContactInfoSchema.safeParse({ mobilePhone: 'not-a-phone-number' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                'zodError.common.contact.mobilePhone.international'
            );
        }
    });

    it('still rejects a malformed homePhone and workPhone', () => {
        expect(ContactInfoSchema.safeParse({ homePhone: '0223-155-1234' }).success).toBe(false);
        expect(ContactInfoSchema.safeParse({ workPhone: 'abc' }).success).toBe(false);
    });

    it('still rejects a malformed whatsapp', () => {
        expect(ContactInfoSchema.safeParse({ whatsapp: '12 34' }).success).toBe(false);
    });

    it('still rejects a non-email personalEmail and workEmail', () => {
        expect(ContactInfoSchema.safeParse({ personalEmail: 'not-an-email' }).success).toBe(false);
        expect(ContactInfoSchema.safeParse({ workEmail: 'nope@' }).success).toBe(false);
    });

    it('still rejects a non-URL website', () => {
        expect(ContactInfoSchema.safeParse({ website: 'not-a-url' }).success).toBe(false);
    });

    it('still rejects a value outside the preferredEmail/preferredPhone enums', () => {
        // The enums are widened by `null` ONLY — an arbitrary string is still
        // not a member.
        expect(ContactInfoSchema.safeParse({ preferredEmail: 'CARRIER_PIGEON' }).success).toBe(
            false
        );
        expect(ContactInfoSchema.safeParse({ preferredPhone: '' }).success).toBe(false);
    });

    it('still rejects a non-string, non-null value', () => {
        expect(ContactInfoSchema.safeParse({ mobilePhone: 42 }).success).toBe(false);
    });

    it('still accepts a valid mobilePhone (the null did not break the happy path)', () => {
        const result = ContactInfoSchema.safeParse({ mobilePhone: '+15550123456' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mobilePhone).toBe('+15550123456');
        }
    });
});

describe('ContactInfoReadSchema (READ) — a stored JSON null must not 500 the GET', () => {
    for (const field of CONTACT_FIELDS) {
        it(`accepts a stored \`${field}: null\``, () => {
            const result = ContactInfoReadSchema.safeParse({ [field]: null });
            expect(result.success).toBe(true);
        });
    }

    it('accepts a fully cleared contactInfo through the self access overlay', () => {
        // `UserSelfSchema` is what `stripWithSchema` applies to the profile GET
        // the edit form rehydrates from. This is the shape stored right after a
        // user clears every contact field.
        const result = UserSelfSchema.safeParse({
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            slug: 'john-doe',
            contactInfo: Object.fromEntries(CONTACT_FIELDS.map((f) => [f, null]))
        });
        expect(result.success).toBe(true);
    });

    it('accepts the realistic post-clear mix of a null key beside a live one', () => {
        // The actual stored shape after "save a phone, then delete it" on an
        // account that also has a website: the cleared key is present-as-null,
        // the sibling survived. Both halves must pass the read strip.
        const result = UserSelfSchema.safeParse({
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            slug: 'john-doe',
            contactInfo: { mobilePhone: null, website: 'https://example.com' }
        });
        expect(result.success).toBe(true);
    });
});

/** Minimal structural view of a schema field — all these assertions need. */
interface ParseableSchema {
    readonly safeParse: (value: unknown) => { readonly success: boolean };
}

/**
 * Extracts the `contactInfo` field schema from an object schema. The field is
 * wrapped in `.nullish()`, which passes any non-null object value straight
 * through to the inner shape — so it can be `safeParse`d on its own, without
 * having to satisfy the dozens of unrelated required fields an accommodation
 * read schema carries.
 */
const getContactField = (schema: z.ZodTypeAny): ParseableSchema | undefined => {
    const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
    if (!shape || typeof shape !== 'object') return undefined;
    return shape.contactInfo as ParseableSchema | undefined;
};

/**
 * The accommodation READ schemas that carry the local overlay. Both are applied
 * by `stripWithSchema`: `AccommodationProtectedSchema` on the owner's editor GET
 * and the protected list, `AccommodationAdminSchema` on the admin getById and
 * the admin list. `createPaginatedResponse` strips per item, so one poisoned row
 * takes down a whole list page on either surface.
 */
const ACCOMMODATION_READ_SCHEMAS: ReadonlyArray<{ name: string; schema: z.ZodTypeAny }> = [
    { name: 'AccommodationProtectedSchema', schema: AccommodationProtectedSchema },
    { name: 'AccommodationAdminSchema', schema: AccommodationAdminSchema }
];

describe('Accommodation contactInfo (WRITE) — an explicit null clears a key', () => {
    for (const field of CONTACT_FIELDS) {
        it(`AccommodationUpdateInputSchema accepts \`${field}: null\``, () => {
            // This is what `PATCH /api/v1/admin/accommodations/:id` validates the
            // body against. It ALREADY accepts the null (the shared write schema
            // was widened); it is asserted here so the write/read pair is pinned
            // in one place — a null that validates on write and fail-closes on
            // read is exactly the bug.
            const result = AccommodationUpdateInputSchema.safeParse({
                contactInfo: { [field]: null }
            });
            expect(result.success).toBe(true);
        });
    }
});

describe('Accommodation contactInfo (READ) — a stored JSON null must not 500 the GET', () => {
    for (const { name, schema } of ACCOMMODATION_READ_SCHEMAS) {
        for (const field of CONTACT_FIELDS) {
            it(`${name} accepts a stored \`${field}: null\``, () => {
                const contact = getContactField(schema);
                expect(contact, `${name} should expose a contactInfo field`).toBeDefined();
                if (!contact) return;

                expect(
                    contact.safeParse({ [field]: null }).success,
                    `${name}: read must not fail-close on a cleared ${field}`
                ).toBe(true);
            });
        }

        it(`${name} accepts a fully cleared contactInfo`, () => {
            const contact = getContactField(schema);
            expect(contact, `${name} should expose a contactInfo field`).toBeDefined();
            if (!contact) return;

            const allNull = Object.fromEntries(CONTACT_FIELDS.map((f) => [f, null]));
            expect(contact.safeParse(allNull).success, `${name}: every key cleared`).toBe(true);
        });

        it(`${name} accepts the realistic post-clear mix of a null key beside a live one`, () => {
            const contact = getContactField(schema);
            expect(contact, `${name} should expose a contactInfo field`).toBeDefined();
            if (!contact) return;

            // The stored shape after "the host saved a website, then deleted the
            // phone": the cleared key is present-as-null, the sibling survived.
            expect(
                contact.safeParse({ mobilePhone: null, website: 'https://example.com' }).success,
                `${name}: null key beside a live sibling`
            ).toBe(true);
        });
    }
});

describe('Accommodation contactInfo (READ) — the null did not turn the overlay into z.any()', () => {
    for (const { name, schema } of ACCOMMODATION_READ_SCHEMAS) {
        it(`${name} still rejects a non-string, non-null contact value`, () => {
            // Non-vacuity for the block above: `.nullish()` widens each key by
            // exactly one value. A read overlay that accepted anything would
            // pass every assertion above while asserting nothing.
            const contact = getContactField(schema);
            expect(contact, `${name} should expose a contactInfo field`).toBeDefined();
            if (!contact) return;

            expect(contact.safeParse({ mobilePhone: 42 }).success, `${name}: number`).toBe(false);
            expect(contact.safeParse({ website: { url: 'x' } }).success, `${name}: object`).toBe(
                false
            );
        });

        it(`${name} still rejects a preferredEmail outside the enum`, () => {
            const contact = getContactField(schema);
            expect(contact, `${name} should expose a contactInfo field`).toBeDefined();
            if (!contact) return;

            expect(
                contact.safeParse({ preferredEmail: 'CARRIER_PIGEON' }).success,
                `${name}: the enum is widened by null ONLY`
            ).toBe(false);
        });

        it(`${name} still accepts a legacy non-null phone (HOS-190 leniency intact)`, () => {
            const contact = getContactField(schema);
            expect(contact, `${name} should expose a contactInfo field`).toBeDefined();
            if (!contact) return;

            expect(
                contact.safeParse({ mobilePhone: '0223-155-1234' }).success,
                `${name}: legacy AR local format`
            ).toBe(true);
        });
    }
});
