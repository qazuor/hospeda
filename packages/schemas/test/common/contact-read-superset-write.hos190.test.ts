/**
 * Cross-entity guardrail for the HOS-190 bug class: a READ (response/access)
 * schema must never REQUIRE a `contactInfo` field that the WRITE (create/update)
 * schema lets you omit.
 *
 * Why this matters: API responses are stripped against their declared schema by
 * `stripWithSchema` (`apps/api/src/utils/response-helpers.ts`), which FAIL-CLOSES
 * to HTTP 500 when a stored row does not satisfy the schema. `contactInfo` is a
 * shallow-merged JSONB column, so a legit PATCH that never touches the phone can
 * leave a row that satisfies WRITE but violates a stricter READ — and every GET
 * of that row 500s, locking the owner out of viewing AND editing it. The incident
 * was `contactInfo.mobilePhone` being required on read while optional on write.
 *
 * The fix relaxed the shared `ContactInfoSchema.mobilePhone` to `.optional()`
 * (so all entities inherit read⊇write for it). This test pins that invariant
 * across every entity read schema so the class cannot silently return: if anyone
 * re-requires `mobilePhone` (or any other contact field) on a read schema, a
 * stored `contactInfo` that omits it must still parse.
 *
 * @module test/common/contact-read-superset-write.hos190
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema
} from '../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationCreateInputSchema } from '../../src/entities/accommodation/accommodation.crud.schema.js';
import {
    EventAdminSchema,
    EventProtectedSchema
} from '../../src/entities/event/event.access.schema.js';
import { EventCreateInputSchema } from '../../src/entities/event/event.crud.schema.js';
import {
    EventOrganizerAdminSchema,
    EventOrganizerProtectedSchema,
    EventOrganizerPublicSchema
} from '../../src/entities/eventOrganizer/eventOrganizer.access.schema.js';
import { EventOrganizerCreateInputSchema } from '../../src/entities/eventOrganizer/eventOrganizer.crud.schema.js';
import {
    ExperienceAdminSchema,
    ExperienceProtectedSchema
} from '../../src/entities/experience/experience.access.schema.js';
import { ExperienceAdminCreateInputSchema } from '../../src/entities/experience/experience.crud.schema.js';
import {
    GastronomyAdminSchema,
    GastronomyProtectedSchema
} from '../../src/entities/gastronomy/gastronomy.access.schema.js';
import { GastronomyAdminCreateInputSchema } from '../../src/entities/gastronomy/gastronomy.crud.schema.js';
import {
    PostSponsorAdminSchema,
    PostSponsorProtectedSchema
} from '../../src/entities/postSponsor/postSponsor.access.schema.js';
import { PostSponsorCreateInputSchema } from '../../src/entities/postSponsor/postSponsor.crud.schema.js';
import { UserSelfSchema } from '../../src/entities/user/user.access.schema.js';
import { UserCreateInputSchema } from '../../src/entities/user/user.crud.schema.js';

/** Minimal structural view of a schema field — all this guardrail needs. */
interface ParseableSchema {
    readonly safeParse: (value: unknown) => { readonly success: boolean };
}

/**
 * Extracts the `contactInfo` field schema from an object schema, or `undefined`
 * when the schema does not expose one (e.g. a wrapped/effect schema, or a read
 * schema that intentionally strips contact info). The field is typically wrapped
 * in `.nullish()`, which passes any non-null/non-undefined object value straight
 * through to the inner shape — so it can be `safeParse`d directly.
 */
const getContactField = (schema: z.ZodTypeAny): ParseableSchema | undefined => {
    const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
    if (!shape || typeof shape !== 'object') return undefined;
    return shape.contactInfo as ParseableSchema | undefined;
};

/**
 * READ schemas that expose `contactInfo`. Each must accept a stored value that
 * omits `mobilePhone` (the incident) while another contact field is present.
 */
const READ_SCHEMAS: ReadonlyArray<{ name: string; schema: z.ZodTypeAny }> = [
    { name: 'AccommodationProtectedSchema', schema: AccommodationProtectedSchema },
    { name: 'AccommodationAdminSchema', schema: AccommodationAdminSchema },
    { name: 'EventOrganizerPublicSchema', schema: EventOrganizerPublicSchema },
    { name: 'EventOrganizerProtectedSchema', schema: EventOrganizerProtectedSchema },
    { name: 'EventOrganizerAdminSchema', schema: EventOrganizerAdminSchema },
    { name: 'EventProtectedSchema', schema: EventProtectedSchema },
    { name: 'EventAdminSchema', schema: EventAdminSchema },
    { name: 'PostSponsorProtectedSchema', schema: PostSponsorProtectedSchema },
    { name: 'PostSponsorAdminSchema', schema: PostSponsorAdminSchema },
    { name: 'ExperienceProtectedSchema', schema: ExperienceProtectedSchema },
    { name: 'ExperienceAdminSchema', schema: ExperienceAdminSchema },
    { name: 'GastronomyProtectedSchema', schema: GastronomyProtectedSchema },
    { name: 'GastronomyAdminSchema', schema: GastronomyAdminSchema },
    { name: 'UserSelfSchema', schema: UserSelfSchema }
];

/**
 * WRITE (create) schemas. Each must ALSO let you omit `mobilePhone`. Together
 * with READ_SCHEMAS this proves read⊇write for the contact-info class: neither
 * side requires a phone, so a row can never be written valid yet read invalid.
 */
const WRITE_SCHEMAS: ReadonlyArray<{ name: string; schema: z.ZodTypeAny }> = [
    { name: 'AccommodationCreateInputSchema', schema: AccommodationCreateInputSchema },
    { name: 'EventOrganizerCreateInputSchema', schema: EventOrganizerCreateInputSchema },
    { name: 'EventCreateInputSchema', schema: EventCreateInputSchema },
    { name: 'PostSponsorCreateInputSchema', schema: PostSponsorCreateInputSchema },
    { name: 'ExperienceAdminCreateInputSchema', schema: ExperienceAdminCreateInputSchema },
    { name: 'GastronomyAdminCreateInputSchema', schema: GastronomyAdminCreateInputSchema },
    { name: 'UserCreateInputSchema', schema: UserCreateInputSchema }
];

// A valid sibling contact value so the object is non-empty but still lacks
// mobilePhone — the exact shape a shallow JSONB merge can leave behind.
const CONTACT_WITHOUT_MOBILE = { whatsapp: '+5493435551234' } as const;

// Legacy/persisted phone values that FAIL the strict write regex but were once
// storable. A read schema must accept them (never 500); a write schema must not.
const LEGACY_CONTACT_VALUES: ReadonlyArray<{ label: string; value: Record<string, string> }> = [
    { label: 'AR local format without "+"', value: { mobilePhone: '0223-155-1234' } },
    { label: 'bare country code "+54"', value: { mobilePhone: '+54' } }
];

describe('HOS-190 guardrail — READ schemas never require contactInfo.mobilePhone', () => {
    for (const { name, schema } of READ_SCHEMAS) {
        it(`${name}.contactInfo accepts a value omitting mobilePhone`, () => {
            const field = getContactField(schema);
            expect(field, `${name} should expose a contactInfo field`).toBeDefined();
            if (!field) return;

            expect(field.safeParse({}).success, `${name}: empty contactInfo`).toBe(true);
            expect(
                field.safeParse(CONTACT_WITHOUT_MOBILE).success,
                `${name}: contactInfo with a sibling field but no mobilePhone`
            ).toBe(true);
        });
    }
});

describe('HOS-190 guardrail — READ schemas accept legacy phone formats (never 500)', () => {
    for (const { name, schema } of READ_SCHEMAS) {
        for (const { label, value } of LEGACY_CONTACT_VALUES) {
            it(`${name}.contactInfo accepts a ${label}`, () => {
                const field = getContactField(schema);
                expect(field, `${name} should expose a contactInfo field`).toBeDefined();
                if (!field) return;

                expect(
                    field.safeParse(value).success,
                    `${name}: read must not reject a persisted ${label}`
                ).toBe(true);
            });
        }
    }
});

describe('HOS-190 guardrail — WRITE schemas also allow omitting contactInfo.mobilePhone', () => {
    for (const { name, schema } of WRITE_SCHEMAS) {
        it(`${name}.contactInfo accepts a value omitting mobilePhone`, () => {
            const field = getContactField(schema);
            expect(field, `${name} should expose a contactInfo field`).toBeDefined();
            if (!field) return;

            expect(field.safeParse({}).success, `${name}: empty contactInfo`).toBe(true);
            expect(
                field.safeParse(CONTACT_WITHOUT_MOBILE).success,
                `${name}: contactInfo with a sibling field but no mobilePhone`
            ).toBe(true);
        });
    }
});

describe('HOS-190 guardrail — WRITE schemas still reject a bare country-code phone', () => {
    for (const { name, schema } of WRITE_SCHEMAS) {
        it(`${name}.contactInfo rejects a bare "+54" (strict format stays on write)`, () => {
            const field = getContactField(schema);
            expect(field, `${name} should expose a contactInfo field`).toBeDefined();
            if (!field) return;

            expect(
                field.safeParse({ mobilePhone: '+54' }).success,
                `${name}: write must reject a bare country code`
            ).toBe(false);
        });
    }
});
