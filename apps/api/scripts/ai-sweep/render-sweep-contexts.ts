/**
 * Renders the HOS-2095 AI sweep contexts with the REAL production builders.
 *
 * The sweep itself lives in `packages/ai-core/scripts/ai-sweep/`, and ai-core
 * must not depend on apps/api. So the sweep reads a GENERATED file
 * (`contexts.generated.json`) and this module, which may import the builders,
 * produces it: every case's context block is the output of
 * `buildMarkdownContext` / `buildVenueMarkdownContext` /
 * `buildExperienceMarkdownContext`, and every system message is the output of
 * `buildChatSystemMessage` over the in-code `DEFAULT_PROMPTS` + `DEFAULT_RULES`
 * composed with `composeSystemPrompt` — exactly what `routes/ai/protected/chat.ts`
 * hands the engine when no admin prompt overrides the defaults.
 *
 * PURE: no I/O, and never run on its own (render-sweep-contexts is a library).
 * The CLI next to it reads the inputs and writes the file:
 * `CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-contexts.ts`; `test/scripts/ai-sweep-contexts-parity.test.ts`
 * fails when the committed file no longer matches what this module renders.
 *
 * @module apps/api/scripts/ai-sweep/render-sweep-contexts
 */

import { composeSystemPrompt, DEFAULT_PROMPTS, DEFAULT_RULES } from '@repo/ai-core';
import {
    AccommodationTypeEnumSchema,
    ExperiencePoliciesSchema,
    ExperiencePriceUnitEnumSchema,
    ExperienceTypeEnumSchema,
    PriceRangeEnumSchema,
    VenueEntryKindEnumSchema,
    VenuePoliciesSchema,
    VenueTypeEnumSchema
} from '@repo/schemas';
import { z } from 'zod';
import { buildMarkdownContext } from '../../src/services/accommodation-ai-context.js';
import { buildExperienceMarkdownContext } from '../../src/services/ai-context/experience-ai-context.js';
import { buildChatSystemMessage } from '../../src/services/ai-context/owner-data-fence.js';
import { buildVenueMarkdownContext } from '../../src/services/ai-context/venue-ai-context.js';
import { toVenueNightContext } from '../../src/services/ai-context/venue-night-context.js';

/** The three listing-chat features the sweep measures. */
export const SWEEP_FEATURES = ['chat', 'chat_venue', 'chat_experience'] as const;

/** One sweep feature. */
export type SweepFeature = (typeof SWEEP_FEATURES)[number];

/** Locales a sweep case may declare as its page locale. */
export const SWEEP_LOCALES = ['es', 'en', 'pt'] as const;

const FaqSchema = z.object({ question: z.string().min(1), answer: z.string().min(1) });

/** Catalog curation of one amenity/feature slug (public catalog snapshot). */
const CurationSchema = z.object({
    isFeatured: z.boolean().nullable().optional(),
    displayWeight: z.number().nullable().optional()
});

/** `catalog-curation.json`: slug -> curation, as the public catalog serves it. */
export const CatalogCurationFileSchema = z.object({
    amenities: z.record(z.string(), CurationSchema),
    features: z.record(z.string(), CurationSchema)
});

/** Parsed curation file. */
export type CatalogCuration = z.infer<typeof CatalogCurationFileSchema>;

const AccommodationEntitySchema = z.object({
    kind: z.literal('accommodation'),
    /** Where the data came from (public URL or "synthetic"). */
    source: z.string().min(1),
    accommodation: z.object({
        name: z.string().min(1),
        summary: z.string(),
        description: z.string(),
        type: AccommodationTypeEnumSchema,
        destinationName: z.string().min(1),
        averageRating: z.number(),
        reviewsCount: z.number().int().nonnegative(),
        extraInfo: z
            .object({
                capacity: z.number().int().optional(),
                bedrooms: z.number().int().optional(),
                bathrooms: z.number().int().optional(),
                beds: z.number().int().optional()
            })
            .nullable(),
        price: z.object({ price: z.number(), currency: z.string() }).nullable()
    }),
    faqs: z.array(FaqSchema),
    /** Amenity slugs in the order the listing returns them (curation is joined in). */
    amenities: z.array(z.string().min(1)),
    features: z.array(z.string().min(1))
});

const VenueEntitySchema = z.object({
    kind: z.literal('venue'),
    source: z.string().min(1),
    venue: z.object({
        name: z.string().min(1),
        summary: z.string(),
        description: z.string(),
        type: VenueTypeEnumSchema,
        priceRange: PriceRangeEnumSchema.nullable(),
        menuUrl: z.string().nullable(),
        /** Raw JSONB value: the builder also accepts partial (pre-schema) rows. */
        openingHours: z.record(z.string(), z.unknown()).nullable(),
        averageRating: z.number().nullable(),
        reviewsCount: z.number().int().nullable(),
        policies: VenuePoliciesSchema.nullable()
    }),
    faqs: z.array(FaqSchema),
    menuItems: z.array(
        z.object({
            sectionName: z.string().nullable(),
            name: z.string().min(1),
            description: z.string().nullable(),
            priceCents: z.number().int().nullable(),
            isAvailable: z.boolean().nullable()
        })
    ),
    includeMenu: z.boolean(),
    /** The `nightInfo` columns plus the section availability the route would resolve. */
    night: z
        .object({
            available: z.boolean(),
            entryKind: VenueEntryKindEnumSchema.nullable(),
            entryNoteI18n: z.object({ es: z.string(), en: z.string(), pt: z.string() }).nullable(),
            /** Centavos, as the column stores it. */
            entryPriceFrom: z.number().int().nullable()
        })
        .nullable()
});

const ExperienceEntitySchema = z.object({
    kind: z.literal('experience'),
    source: z.string().min(1),
    experience: z.object({
        name: z.string().min(1),
        summary: z.string(),
        description: z.string(),
        type: ExperienceTypeEnumSchema,
        durationMinutes: z.number().int().nullable(),
        /** Centavos, as the column stores it. */
        priceFrom: z.number().int().nullable(),
        priceUnit: ExperiencePriceUnitEnumSchema.nullable(),
        isPriceOnRequest: z.boolean().nullable(),
        meetingPoint: z.string().nullable(),
        meetingPointDirections: z.array(z.string()).nullable(),
        whatToBring: z.array(z.string()).nullable(),
        requirements: z.array(z.string()).nullable(),
        policies: ExperiencePoliciesSchema.nullable(),
        averageRating: z.number().nullable(),
        reviewsCount: z.number().int().nullable(),
        openingHours: z.record(z.string(), z.unknown()).nullable()
    }),
    faqs: z.array(FaqSchema),
    includeDirections: z.boolean()
});

/** One listing the sweep renders, discriminated by vertical. */
export const SweepEntitySchema = z.discriminatedUnion('kind', [
    AccommodationEntitySchema,
    VenueEntitySchema,
    ExperienceEntitySchema
]);

/** One parsed entity. */
export type SweepEntity = z.infer<typeof SweepEntitySchema>;

/** An entity input file (`accommodation-snapshots.json`, `synthetic-entities.json`). */
export const EntityFileSchema = z.object({
    entities: z.record(z.string(), SweepEntitySchema)
});

/** The fields of a fixture case this module needs (the rubric stays in ai-core). */
export const RenderableCaseSchema = z.object({
    id: z.string().min(1),
    feature: z.enum(SWEEP_FEATURES),
    entity: z.string().min(1),
    locale: z.enum(SWEEP_LOCALES).default('es')
});

/** One renderable case. */
export type RenderableCase = z.infer<typeof RenderableCaseSchema>;

/** One rendered case, as written to `contexts.generated.json`. */
export interface RenderedCase {
    readonly feature: SweepFeature;
    readonly entity: string;
    readonly locale: SweepLocale;
    readonly context: string;
}

/** One page locale. */
export type SweepLocale = (typeof SWEEP_LOCALES)[number];

/**
 * Everything production appends after the context block, per feature and locale:
 * `buildChatSystemMessage('', prompt, locale)`. The full system message of a case
 * is `context + suffix`, which {@link renderSweepCases} verifies against the real
 * builder for every case, so the sweep only concatenates and never re-implements.
 */
export type SystemSuffixes = Readonly<Record<SweepFeature, Readonly<Record<SweepLocale, string>>>>;

const FEATURE_BY_KIND: Readonly<Record<SweepEntity['kind'], SweepFeature>> = {
    accommodation: 'chat',
    venue: 'chat_venue',
    experience: 'chat_experience'
};

/**
 * Renders the context block of one entity with the real builder of its vertical.
 *
 * @param input.entity - The parsed entity.
 * @param input.curation - Catalog curation joined into amenity/feature rows.
 * @param input.locale - Page locale (labels and money).
 * @returns `{ context }`.
 */
export function renderEntityContext(input: {
    readonly entity: SweepEntity;
    readonly curation: CatalogCuration;
    readonly locale: SweepLocale;
}): { readonly context: string } {
    const { entity, curation, locale } = input;
    if (entity.kind === 'accommodation') {
        const a = entity.accommodation;
        const toRow = (slug: string, table: CatalogCuration['amenities']) => ({
            name: slug,
            isFeatured: table[slug]?.isFeatured ?? false,
            displayWeight: table[slug]?.displayWeight ?? 50
        });
        return {
            context: buildMarkdownContext(
                {
                    id: 'sweep',
                    name: a.name,
                    summary: a.summary,
                    description: a.description,
                    type: a.type,
                    destinationId: 'sweep',
                    ownerId: 'sweep',
                    averageRating: a.averageRating,
                    reviewsCount: a.reviewsCount,
                    destination: { name: a.destinationName },
                    extraInfo: a.extraInfo,
                    price: a.price,
                    policies: null
                },
                entity.faqs,
                entity.amenities.map((slug) => toRow(slug, curation.amenities)),
                entity.features.map((slug) => toRow(slug, curation.features)),
                [],
                locale
            )
        };
    }
    if (entity.kind === 'venue') {
        const night = entity.night
            ? toVenueNightContext({
                  row: {
                      entryKind: entity.night.entryKind,
                      entryNoteI18n: entity.night.entryNoteI18n,
                      entryPriceFrom: entity.night.entryPriceFrom,
                      policies: entity.venue.policies
                  },
                  available: entity.night.available,
                  locale
              })
            : null;
        return {
            context: buildVenueMarkdownContext(
                { id: 'sweep', ...entity.venue },
                entity.faqs,
                entity.menuItems,
                entity.includeMenu,
                night,
                locale
            )
        };
    }
    return {
        context: buildExperienceMarkdownContext(
            { id: 'sweep', ...entity.experience },
            entity.faqs,
            entity.includeDirections,
            locale
        )
    };
}

/**
 * Builds the system message production sends for one feature: the real
 * `buildChatSystemMessage` over the in-code default prompt and rules, composed
 * with `composeSystemPrompt` as `routes/ai/protected/chat.ts` does.
 *
 * @param input.feature - The chat feature.
 * @param input.context - The rendered context block.
 * @param input.locale - Page locale (the language FALLBACK, see the builder).
 * @returns `{ system }`.
 */
export function renderSystemMessage(input: {
    readonly feature: SweepFeature;
    readonly context: string;
    readonly locale: SweepLocale;
}): { readonly system: string } {
    const resolvedPrompt = composeSystemPrompt({
        content: DEFAULT_PROMPTS[input.feature],
        rules: DEFAULT_RULES[input.feature]
    });
    return { system: buildChatSystemMessage(input.context, resolvedPrompt, input.locale) };
}

/**
 * Renders the suffix table (see {@link SystemSuffixes}).
 *
 * @returns `{ suffixes }`.
 */
export function renderSystemSuffixes(): { readonly suffixes: SystemSuffixes } {
    const byLocale = (feature: SweepFeature): Record<SweepLocale, string> => ({
        es: renderSystemMessage({ feature, context: '', locale: 'es' }).system,
        en: renderSystemMessage({ feature, context: '', locale: 'en' }).system,
        pt: renderSystemMessage({ feature, context: '', locale: 'pt' }).system
    });
    return {
        suffixes: {
            chat: byLocale('chat'),
            chat_venue: byLocale('chat_venue'),
            chat_experience: byLocale('chat_experience')
        }
    };
}

/**
 * Renders every case. Throws on an unknown entity, on a feature that does not
 * match the entity's vertical, and when `context + suffix` is not byte-identical
 * to the real `buildChatSystemMessage` output, so a typo or a builder change
 * never yields a silently wrong prompt.
 *
 * @param input.cases - The cases from `fixtures.json`.
 * @param input.entities - Every entity, keyed by id.
 * @param input.curation - Catalog curation.
 * @returns `{ suffixes, cases }`, cases keyed by id in input order.
 */
export function renderSweepCases(input: {
    readonly cases: readonly RenderableCase[];
    readonly entities: Readonly<Record<string, SweepEntity>>;
    readonly curation: CatalogCuration;
}): {
    readonly suffixes: SystemSuffixes;
    readonly cases: Readonly<Record<string, RenderedCase>>;
} {
    const { suffixes } = renderSystemSuffixes();
    const out: Record<string, RenderedCase> = {};
    for (const c of input.cases) {
        const entity = input.entities[c.entity];
        if (!entity) throw new Error(`Case "${c.id}": unknown entity "${c.entity}".`);
        if (FEATURE_BY_KIND[entity.kind] !== c.feature) {
            throw new Error(
                `Case "${c.id}": feature "${c.feature}" does not match entity kind "${entity.kind}".`
            );
        }
        const { context } = renderEntityContext({
            entity,
            curation: input.curation,
            locale: c.locale
        });
        const { system } = renderSystemMessage({ feature: c.feature, context, locale: c.locale });
        if (system !== context + suffixes[c.feature][c.locale]) {
            throw new Error(
                `Case "${c.id}": buildChatSystemMessage is no longer "context + suffix"; update the sweep composition.`
            );
        }
        out[c.id] = { feature: c.feature, entity: c.entity, locale: c.locale, context };
    }
    return { suffixes, cases: out };
}

/**
 * Merges entity files, refusing a duplicated id.
 *
 * @param input.files - Parsed entity files.
 * @returns `{ entities }`.
 */
export function mergeEntityFiles(input: {
    readonly files: ReadonlyArray<z.infer<typeof EntityFileSchema>>;
}): { readonly entities: Readonly<Record<string, SweepEntity>> } {
    const entities: Record<string, SweepEntity> = {};
    for (const file of input.files) {
        for (const [id, entity] of Object.entries(file.entities)) {
            if (entities[id]) throw new Error(`Duplicated entity id "${id}".`);
            entities[id] = entity;
        }
    }
    return { entities };
}
