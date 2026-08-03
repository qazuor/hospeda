/**
 * @file embedded-faq-identity.test.ts
 * @description Regression guard: the `faqs` array embedded in a parent entity
 * must PRESERVE each FAQ's `id`.
 *
 * The bug: all four parent entities typed the field as
 * `z.array(BaseFaqSchema)`. `BaseFaqSchema` is deliberately the identity-LESS
 * base — it is what `FaqCreatePayloadSchema` and `BaseFaqPublicSchema` are
 * `.pick()`ed from, and what the four per-entity subtypes extend by ADDING `id`
 * plus the owner foreign key. Typing the embedded array with the base therefore
 * made Zod strip the `id` off every FAQ on the way out, even though the FAQ rows
 * carry a real UUID and the service loads it.
 *
 * What that broke downstream (observed, not hypothetical): the commerce owner's
 * FAQ manager keys its rows and its "edit this one" state off `faq.id`, so with
 * every id blank, clicking Edit opened ALL FAQs at once, the generated DOM ids
 * collided, and save/delete posted an empty id. React also logged one duplicate
 * -key error per extra FAQ, which had been written off as unexplained.
 *
 * The fix is to type each embedded array with that entity's own FAQ subtype, not
 * to add `id` to the base — the base's identity-less shape is load-bearing for
 * the create payload and the public projection.
 *
 * @module test/common/embedded-faq-identity
 */

import { describe, expect, it } from 'vitest';
import { FaqCreatePayloadSchema } from '../../src/common/faq.schema.js';
import { AccommodationSchema } from '../../src/entities/accommodation/accommodation.schema.js';
import { DestinationSchema } from '../../src/entities/destination/destination.schema.js';
import { ExperienceSchema } from '../../src/entities/experience/experience.schema.js';
import { GastronomySchema } from '../../src/entities/gastronomy/gastronomy.schema.js';

const FAQ_ID = '34b02cb0-e06a-51c4-b742-04e8ff79299f';
const OWNER_ID = '686b70d4-aa3f-57c6-8958-a83eca33cd69';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

/** Audit + lifecycle fields every FAQ carries, so the subtype parses cleanly. */
const faqBaseFields = {
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: ACTOR_ID,
    updatedById: ACTOR_ID,
    deletedAt: null,
    deletedById: null,
    lifecycleState: 'ACTIVE',
    question: '¿Hacen reservas?',
    answer: 'Sí, aceptamos reservas para grupos de más de 4 personas.',
    category: null,
    displayOrder: 0
} as const;

/**
 * The four entities that embed a FAQ array, each with the foreign key its own
 * subtype requires.
 */
const CASES = [
    { name: 'Gastronomy', schema: GastronomySchema, fkField: 'gastronomyId' },
    { name: 'Experience', schema: ExperienceSchema, fkField: 'experienceId' },
    { name: 'Accommodation', schema: AccommodationSchema, fkField: 'accommodationId' },
    { name: 'Destination', schema: DestinationSchema, fkField: 'destinationId' }
] as const;

describe('embedded FAQ arrays preserve each FAQ id', () => {
    for (const { name, schema, fkField } of CASES) {
        it(`${name}: keeps \`id\` on every embedded FAQ instead of stripping it`, () => {
            const faq = { ...faqBaseFields, id: FAQ_ID, [fkField]: OWNER_ID };

            // Parse ONLY the faqs field: the parent schemas require a large set
            // of unrelated fields, and this guard is about one array's element
            // type. `.shape.faqs` is that exact array schema.
            const faqsSchema = (schema as unknown as { shape: Record<string, unknown> }).shape.faqs;
            const parsed = (
                faqsSchema as { parse: (v: unknown) => Array<Record<string, unknown>> }
            ).parse([faq]);

            // The whole point: `id` survives. Before the fix this was `undefined`
            // — Zod strips unknown keys, and the base schema does not declare it.
            expect(parsed[0]?.id).toBe(FAQ_ID);
            expect(parsed[0]?.[fkField]).toBe(OWNER_ID);
        });

        it(`${name}: two embedded FAQs stay distinguishable by id`, () => {
            const secondId = '191e0631-0dd7-5463-81d0-e2b44adc4600';
            const faqsSchema = (schema as unknown as { shape: Record<string, unknown> }).shape.faqs;
            const parsed = (
                faqsSchema as { parse: (v: unknown) => Array<Record<string, unknown>> }
            ).parse([
                { ...faqBaseFields, id: FAQ_ID, [fkField]: OWNER_ID },
                { ...faqBaseFields, id: secondId, [fkField]: OWNER_ID }
            ]);

            // With the base schema both ids came back `undefined`, so any
            // consumer keying off them — React `key`, DOM `id`, "which row is
            // being edited" — saw two identical rows.
            const ids = parsed.map((f) => f.id);
            expect(ids).toEqual([FAQ_ID, secondId]);
            expect(new Set(ids).size).toBe(2);
        });
    }

    for (const { name, schema, fkField } of CASES) {
        it(`${name}: still accepts a historic FAQ with no id, per the additive-only policy`, () => {
            // The fix DECLARES identity so Zod stops stripping it; it must not
            // REQUIRE it. Requiring `id`/the FK would tighten a published schema
            // — forbidden without a three-phase migration (see
            // `packages/schemas/CLAUDE.md`), and it broke the historic-shape
            // compat fixtures the first time this was written that way.
            const faqsSchema = (schema as unknown as { shape: Record<string, unknown> }).shape.faqs;
            const result = (
                faqsSchema as { safeParse: (v: unknown) => { success: boolean } }
            ).safeParse([{ ...faqBaseFields }]);

            expect(result.success, `${name}: an id-less FAQ must still parse`).toBe(true);
        });

        it(`${name}: accepts a FAQ carrying an id but no owner FK`, () => {
            // The two identity fields are independently optional: a payload that
            // has the id (all the consumer actually needs) but omits the
            // redundant back-reference must not be rejected.
            const faqsSchema = (schema as unknown as { shape: Record<string, unknown> }).shape.faqs;
            const result = (
                faqsSchema as {
                    safeParse: (v: unknown) => {
                        success: boolean;
                        data?: Array<Record<string, unknown>>;
                    };
                }
            ).safeParse([{ ...faqBaseFields, id: FAQ_ID }]);

            expect(result.success).toBe(true);
            expect(result.data?.[0]?.id).toBe(FAQ_ID);
            expect(result.data?.[0]?.[fkField]).toBeUndefined();
        });
    }

    it('does not push identity into the create payload, which must not carry an id', () => {
        // Guards the road not taken: adding `id` to `BaseFaqSchema` would have
        // leaked it into everything `.pick()`ed from it. A client creating a FAQ
        // does not choose its id.
        const createShape = (
            FaqCreatePayloadSchema as unknown as { shape: Record<string, unknown> }
        ).shape;
        expect(Object.keys(createShape)).not.toContain('id');
    });
});
