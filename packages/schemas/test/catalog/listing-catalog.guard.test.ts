import { describe, expect, it } from 'vitest';
import { PRODUCTION_PLAN_CATALOG } from '../../../../scripts/production-catalog/catalog.js';
import enReview from '../../../i18n/src/locales/en/review.json';
import esReview from '../../../i18n/src/locales/es/review.json';
import ptReview from '../../../i18n/src/locales/pt/review.json';
import { BUSINESS_LINE_RULES, BUSINESS_LINES } from '../../src/catalog/business-lines.js';
import { CATALOG_KEY_DEFINITIONS } from '../../src/catalog/key-catalog.js';
import { LISTING_SECTIONS } from '../../src/catalog/listing-sections.js';
import { REVIEW_RULES, reviewRatingSchemaFor } from '../../src/catalog/review-dimensions.js';
import { AccommodationUpdateInputSchema } from '../../src/entities/accommodation/accommodation.crud.schema.js';
import { ExperienceUpdateInputSchema } from '../../src/entities/experience/experience.crud.schema.js';
import { VenueUpdateInputSchema } from '../../src/entities/venue/venue.crud.schema.js';
import { AccommodationTypeEnum } from '../../src/enums/accommodation-type.enum.js';
import { ExperienceTypeEnum } from '../../src/enums/experience-type.enum.js';
import { VenueTypeEnum } from '../../src/enums/venue-type.enum.js';

const verticals = ['venue', 'accommodation', 'experience'] as const;
type Catalog = typeof LISTING_SECTIONS;
type Section = {
    id: string;
    common: boolean;
    entitlementKey?: string;
    traits?: readonly { id: string; entitlementKey?: string }[];
    fields: readonly string[];
};
type Line = { value: string; sections: readonly string[]; public: boolean };
function violations(
    catalogInput: unknown,
    linesInput: unknown = BUSINESS_LINES,
    rulesInput: unknown = BUSINESS_LINE_RULES,
    reviewRulesInput: unknown = REVIEW_RULES,
    localesInput: unknown = {
        es: { review: esReview },
        en: { review: enReview },
        pt: { review: ptReview }
    }
): string[] {
    const catalog = catalogInput as Record<string, readonly Section[]>;
    const lines = linesInput as Record<string, readonly Line[]>;
    const rules = rulesInput as Record<
        string,
        {
            typeRules: Record<string, { allowed: readonly string[]; preselect: readonly string[] }>;
            excludes?: readonly (readonly string[])[];
            maxPerListing?: number;
        }
    >;
    const reviewRules = reviewRulesInput as Record<
        string,
        | {
              dimensions: readonly { id: string; labelKey: string; boundSection?: string }[];
              dimensionAveraging: string;
          }
        | undefined
    >;
    const locales = localesInput as Record<string, Record<string, { [key: string]: unknown }>>;
    const errors: string[] = [];
    for (const vertical of verticals) {
        const owned = catalog[vertical] ?? [];
        const businessLines = lines[vertical] ?? [];
        const ruleSet = rules[vertical] ?? { typeRules: {} };
        if (!businessLines.length) errors.push('r1');
        if (new Set(businessLines.map((line) => line.value)).size !== businessLines.length)
            errors.push('r2');
        for (const line of businessLines)
            if (line.sections.some((id) => !owned.some((section) => section.id === id)))
                errors.push('r3');
        for (const section of owned)
            if (
                !section.common &&
                !businessLines.some((line) => line.sections.includes(section.id))
            )
                errors.push('r4');
        const types =
            vertical === 'venue'
                ? Object.values(VenueTypeEnum)
                : vertical === 'experience'
                  ? Object.values(ExperienceTypeEnum)
                  : Object.values(AccommodationTypeEnum);
        const values = businessLines.map((line) => line.value);
        for (const type of types) {
            const entry = (
                ruleSet.typeRules as Record<
                    string,
                    { allowed: readonly string[]; preselect: readonly string[] }
                >
            )[type];
            if (
                !entry ||
                !entry.allowed.length ||
                !entry.preselect.length ||
                entry.allowed.some((x) => !values.includes(x)) ||
                entry.preselect.some((x) => !entry.allowed.includes(x))
            )
                errors.push('r5');
        }
        const prodKeys = new Set<string>(
            PRODUCTION_PLAN_CATALOG.filter((p) => p.vertical === vertical).flatMap((p) =>
                p.version.entitlements.map((e) => e.key)
            )
        );
        for (const section of owned)
            for (const key of [
                section.entitlementKey,
                ...(section.traits ?? []).map((trait) => trait.entitlementKey)
            ].filter(Boolean)) {
                if (
                    !CATALOG_KEY_DEFINITIONS.some((d) => d.key === key && d.scope === 'vertical') ||
                    !prodKeys.has(key as string)
                )
                    errors.push('r6');
            }
        const sectionIds = owned.map((s) => s.id);
        const traitIds = owned.flatMap((s) => (s.traits ?? []).map((t) => t.id));
        if (
            new Set(sectionIds).size !== sectionIds.length ||
            new Set(traitIds).size !== traitIds.length
        )
            errors.push('r7');
        if (!owned.length) errors.push('r8');
        if (businessLines.length === 1 && businessLines[0]?.public) errors.push('r9');
        const exclusions = ruleSet.excludes ?? [];
        if (
            exclusions.some(
                (pair) => pair.length !== 2 || pair.some((value) => !values.includes(value))
            ) ||
            Object.values(ruleSet.typeRules).some(
                (entry) =>
                    (ruleSet.maxPerListing !== undefined &&
                        entry.preselect.length > ruleSet.maxPerListing) ||
                    exclusions.some((pair) =>
                        pair.every((value) => entry.preselect.includes(value))
                    )
            )
        )
            errors.push('r10');
        const schema =
            vertical === 'venue'
                ? VenueUpdateInputSchema
                : vertical === 'experience'
                  ? ExperienceUpdateInputSchema
                  : AccommodationUpdateInputSchema;
        const fields = owned.flatMap((section) => section.fields);
        if (
            new Set(fields).size !== fields.length ||
            Object.keys(schema.shape).some(
                (field) => field !== 'businessLines' && !fields.includes(field as never)
            ) ||
            fields.some((field) => !(field in schema.shape)) ||
            (vertical === 'venue' &&
                (!owned.find((section) => section.id === 'menu')?.fields.includes('menuUrl') ||
                    owned.find((section) => section.id === 'price')?.fields.includes('menuUrl')))
        )
            errors.push(`r11:${vertical}`);
    }
    const reviewErrors: string[] = [];
    for (const vertical of verticals) {
        const declared = reviewRules[vertical];
        // Only the verticals whose reviews the shared listing base recalculates
        // declare ReviewRules (DEC-FAC-073); accommodation has its own review
        // pipeline, so a declaration there would be read by nothing.
        const recalculatedByListingBase = vertical === 'venue' || vertical === 'experience';
        if (recalculatedByListingBase && !declared) {
            reviewErrors.push(`r12:declaration:${vertical}`);
            continue;
        }
        if (!recalculatedByListingBase && declared) {
            reviewErrors.push(`r12:undeclared-vertical:${vertical}`);
            continue;
        }
        if (!declared) continue;
        const ids = declared.dimensions.map((dimension) => dimension.id);
        if (new Set(ids).size !== ids.length) reviewErrors.push(`r12:ids:${vertical}`);
        for (const dimension of declared.dimensions) {
            if (dimension.boundSection) {
                const section = (catalog[vertical] ?? []).find(
                    (item) => item.id === dimension.boundSection
                );
                if (!section) reviewErrors.push(`r12:bound-missing:${vertical}`);
                else if (section.common) reviewErrors.push(`r12:bound-common:${vertical}`);
            }
            const segments = dimension.labelKey.split('.');
            const hasLocaleLabel = (locale: string) => {
                const label = segments.reduce<unknown>(
                    (value, segment) => (value as Record<string, unknown> | undefined)?.[segment],
                    locales[locale]
                );
                return typeof label === 'string' && label.trim().length > 0;
            };
            if (['es', 'en', 'pt'].some((locale) => !hasLocaleLabel(locale)))
                reviewErrors.push(`r12:label:${vertical}:${dimension.id}`);
        }
        if (declared.dimensionAveraging === 'votedOnly') {
            const schema = reviewRatingSchemaFor({ vertical: vertical as 'venue' | 'experience' });
            const schemaKeys = Object.keys(
                (schema as { shape?: Record<string, unknown> }).shape ?? {}
            );
            if (schemaKeys.length !== ids.length || ids.some((id) => !schemaKeys.includes(id)))
                reviewErrors.push(`r12:schema:${vertical}`);
        }
    }
    errors.push(...reviewErrors);
    return errors;
}

describe('G-FAC-02 listing catalog integrity', () => {
    it('satisfies all twelve catalog rules', () =>
        expect(violations(LISTING_SECTIONS)).toEqual([]));
    it.each([
        'r1',
        'r2',
        'r3',
        'r4',
        'r5',
        'r6',
        'r7',
        'r8',
        'r9',
        'r10',
        'r11'
    ])('%s catches an injected content mutation', (rule) => {
        const copy = structuredClone(LISTING_SECTIONS) as unknown as {
            [K in keyof Catalog]: Array<Record<string, unknown>>;
        };
        const lines = structuredClone(BUSINESS_LINES) as unknown as Record<
            string,
            Array<Record<string, unknown>>
        >;
        const rules = structuredClone(BUSINESS_LINE_RULES) as unknown as Record<
            string,
            { typeRules: Record<string, unknown>; excludes?: unknown[]; maxPerListing?: number }
        >;
        const venueLines = lines.venue as Array<Record<string, unknown>>;
        const venueSections = copy.venue as Array<Record<string, unknown>>;
        if (rule === 'r1') lines.venue = [];
        if (rule === 'r2')
            venueLines.push(structuredClone(venueLines[0]) as Record<string, unknown>);
        if (rule === 'r3') venueLines[0]!.sections = ['nonexistent'];
        if (rule === 'r4') venueLines[0]!.sections = ['nightInfo'];
        if (rule === 'r5')
            delete (rules.venue as { typeRules: Record<string, unknown> }).typeRules[
                VenueTypeEnum.BOLICHE
            ];
        if (rule === 'r6') venueSections[0]!.entitlementKey = 'unknown_entitlement';
        if (rule === 'r7') venueSections[1]!.id = venueSections[0]!.id;
        if (rule === 'r8') copy.venue = [];
        if (rule === 'r9')
            (
                (lines.accommodation as Array<Record<string, unknown>>)[0] as Record<
                    string,
                    unknown
                >
            ).public = true;
        if (rule === 'r10')
            Object.assign(rules.venue as object, {
                excludes: [['bogus', 'food']],
                maxPerListing: 1
            });
        if (rule === 'r11') venueSections[0]!.fields = [];
        expect(violations(copy, lines, rules).some((error) => error.startsWith(rule))).toBe(true);
    });
});

describe('G-FAC-02 rule 12 review dimensions', () => {
    it('satisfies review dimension integrity', () =>
        expect(violations(LISTING_SECTIONS)).toEqual([]));

    type MutableReviewRules = {
        venue: { dimensions: Array<{ id: string; labelKey: string; boundSection?: string }> };
        experience?: { dimensions: Array<{ id: string; labelKey: string; boundSection?: string }> };
        accommodation?: {
            vertical: string;
            dimensions: Array<{ id: string; labelKey: string; boundSection?: string }>;
            dimensionAveraging: string;
        };
    };

    it.each([
        [
            'rules declared for accommodation',
            (rules: MutableReviewRules) => {
                rules.accommodation = {
                    vertical: 'accommodation',
                    dimensions: [],
                    dimensionAveraging: 'votedOnly'
                };
            }
        ],
        [
            'missing experience rules',
            (rules: MutableReviewRules) => {
                delete rules.experience;
            }
        ],
        [
            'duplicate dimension id',
            (rules: MutableReviewRules) => {
                rules.venue.dimensions[1]!.id = 'food';
            }
        ],
        [
            'schema not derived from dimensions',
            (rules: MutableReviewRules) => {
                rules.venue.dimensions.pop();
            }
        ],
        [
            'common section binding',
            (rules: MutableReviewRules) => {
                rules.venue.dimensions[0]!.boundSection = 'price';
            }
        ],
        [
            'unknown section binding',
            (rules: MutableReviewRules) => {
                rules.venue.dimensions[0]!.boundSection = 'missing';
            }
        ],
        [
            'missing Portuguese label',
            (rules: MutableReviewRules) => {
                rules.venue.dimensions[0]!.labelKey = 'review.dimensions.missing';
            }
        ]
    ])('rejects %s (rule 12 mutation)', (_name, mutate) => {
        const reviewRules = structuredClone(REVIEW_RULES) as unknown as MutableReviewRules;
        mutate(reviewRules);
        expect(
            violations(LISTING_SECTIONS, BUSINESS_LINES, BUSINESS_LINE_RULES, reviewRules).some(
                (error) => error.startsWith('r12:')
            )
        ).toBe(true);
    });

    it('rejects a label missing only in Portuguese', () => {
        const locales = structuredClone({
            es: { review: esReview },
            en: { review: enReview },
            pt: { review: ptReview }
        }) as unknown as {
            es: { review: { dimensions: Record<string, unknown> } };
            en: { review: { dimensions: Record<string, unknown> } };
            pt: { review: { dimensions: Record<string, unknown> } };
        };
        delete locales.pt.review.dimensions.food;
        expect(
            violations(
                LISTING_SECTIONS,
                BUSINESS_LINES,
                BUSINESS_LINE_RULES,
                REVIEW_RULES,
                locales
            ).some((error) => error.startsWith('r12:label:'))
        ).toBe(true);
    });
});
